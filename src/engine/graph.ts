import {
  type Field, Reader, Writer, WIRE_LEN, f32, floats, int64, int64s, num, str, sub,
} from './protobuf'

// ONNX protobuf field numbers (onnx/onnx.proto)
const MODEL = { producerName: 2, producerVersion: 3, graph: 7, opsetImport: 8 } as const
const GRAPH = { node: 1, initializer: 5, input: 11, output: 12, valueInfo: 13 } as const
const NODE = { input: 1, output: 2, name: 3, opType: 4, attribute: 5, domain: 7 } as const
const ATTR = { name: 1, f: 2, i: 3, s: 4, t: 5, g: 6, floats: 7, ints: 8, type: 20 } as const
const TENSOR = { dims: 1, dataType: 2, floatData: 4, name: 8, rawData: 9, dataLocation: 14 } as const

export type Dim = number | string // string = symbolic dim, e.g. "batch"

export interface TensorInfo {
  name: string
  elemType: number // onnx.TensorProto.DataType: 1 float, 7 int64, ...
  shape: Dim[] | null
}

export interface Weight {
  name: string
  shape: number[]
  dataType: number
}

export interface GraphNode {
  index: number
  name: string
  opType: string
  /** Scope path, e.g. "/blocks.0/attn" for "/blocks.0/attn/Softmax". */
  scope: string
  inputs: string[] // activation inputs only (weights filtered out)
  weights: Weight[]
  outputs: string[]
  attrs: Record<string, string>
  params: number
}

export interface ModelGraph {
  bytes: Uint8Array
  producer: string
  opset: number
  inputs: TensorInfo[]
  outputs: TensorInfo[]
  nodes: GraphNode[]
  totalParams: number
  /** Raw field layout, kept so `instrument` can splice without a full re-encode. */
  layout: {
    modelFields: Field[]
    graphFields: Field[]
    /** graphFields index -> output names of that NodeProto (Constant nodes included). */
    nodeOutputs: Map<number, string[]>
    initializers: Map<string, Field>
  }
}

export const ELEM_TYPE_NAMES: Record<number, string> = {
  1: 'float32', 2: 'uint8', 3: 'int8', 6: 'int32', 7: 'int64', 9: 'bool', 10: 'float16', 11: 'float64',
}

function tensorInfo(buf: Uint8Array, vi: Field): TensorInfo {
  const fs = sub(buf, vi).fields()
  let name = ''
  let elemType = 1
  let shape: Dim[] | null = null
  for (const f of fs) {
    if (f.num === 1) name = str(buf, f)
    if (f.num === 2) {
      const tensor = sub(buf, f).fields().find((x) => x.num === 1) // TypeProto.tensor_type
      if (!tensor) continue
      for (const t of sub(buf, tensor).fields()) {
        if (t.num === 1) elemType = num(buf, t)
        if (t.num === 2) {
          shape = sub(buf, t).fields().filter((d) => d.num === 1).map((d) => {
            const df = sub(buf, d).fields()
            const value = df.find((x) => x.num === 1)
            const param = df.find((x) => x.num === 2)
            return value ? Number(int64(buf, value)) : param ? str(buf, param) : '?'
          })
        }
      }
    }
  }
  return { name, elemType, shape }
}

function tensorHeader(buf: Uint8Array, t: Field): { name: string; dims: number[]; dataType: number; fields: Field[] } {
  const fs = sub(buf, t).fields()
  const nameF = fs.find((f) => f.num === TENSOR.name)
  const typeF = fs.find((f) => f.num === TENSOR.dataType)
  return { name: nameF ? str(buf, nameF) : '', dims: int64s(buf, fs, TENSOR.dims), dataType: typeF ? num(buf, typeF) : 0, fields: fs }
}

function attrToString(buf: Uint8Array, fs: Field[]): string {
  const typeF = fs.find((f) => f.num === ATTR.type)
  const type = typeF ? num(buf, typeF) : 0
  const get = (n: number) => fs.find((f) => f.num === n)
  switch (type) {
    case 1: { const f = get(ATTR.f); return f ? String(+f32(buf, f).toFixed(4)) : '0' }
    case 2: { const f = get(ATTR.i); return f ? String(int64(buf, f)) : '0' }
    case 3: { const f = get(ATTR.s); return f ? str(buf, f) : '' }
    case 4: { const f = get(ATTR.t); return f ? `tensor[${tensorHeader(buf, f).dims.join('×')}]` : 'tensor' }
    case 5: return 'subgraph'
    case 6: return `[${floats(buf, fs, ATTR.floats).map((x) => +x.toFixed(3)).join(', ')}]`
    case 7: return `[${int64s(buf, fs, ATTR.ints).join(', ')}]`
    default: return '…'
  }
}

/** "/blocks.0/attn/Softmax" -> "/blocks.0/attn"; flat names have no scope. */
function scopeOf(name: string): string {
  const i = name.lastIndexOf('/')
  return i > 0 ? name.slice(0, i) : ''
}

export function parseModel(bytes: Uint8Array): ModelGraph {
  const modelFields = new Reader(bytes).fields()
  const graphF = modelFields.find((f) => f.num === MODEL.graph && f.wire === WIRE_LEN)
  if (!graphF) throw new Error('This file has no graph. Is it really an ONNX model?')

  let producer = ''
  let opset = 0
  for (const f of modelFields) {
    if (f.num === MODEL.producerName) producer = str(bytes, f)
    if (f.num === MODEL.producerVersion) producer += ` ${str(bytes, f)}`
    if (f.num === MODEL.opsetImport) {
      const fs = sub(bytes, f).fields()
      const domain = fs.find((x) => x.num === 1)
      const version = fs.find((x) => x.num === 2)
      const d = domain ? str(bytes, domain) : ''
      if ((d === '' || d === 'ai.onnx') && version) opset = Number(int64(bytes, version))
    }
  }

  const graphFields = sub(bytes, graphF).fields()
  const initShapes = new Map<string, Weight>()
  const initializers = new Map<string, Field>()
  for (const f of graphFields) {
    if (f.num !== GRAPH.initializer) continue
    const h = tensorHeader(bytes, f)
    initShapes.set(h.name, { name: h.name, shape: h.dims, dataType: h.dataType })
    initializers.set(h.name, f)
  }

  type RawNode = { at: number; fields: Field[]; inputs: string[]; outputs: string[]; name: string; opType: string; attrs: Field[][] }
  const raw: RawNode[] = []
  graphFields.forEach((f, at) => {
    if (f.num !== GRAPH.node) return
    const fs = sub(bytes, f).fields()
    const strings = (n: number) => fs.filter((x) => x.num === n).map((x) => str(bytes, x))
    raw.push({
      at,
      fields: fs,
      inputs: strings(NODE.input),
      outputs: strings(NODE.output),
      name: strings(NODE.name)[0] ?? '',
      opType: strings(NODE.opType)[0] ?? '?',
      attrs: fs.filter((x) => x.num === NODE.attribute).map((x) => sub(bytes, x).fields()),
    })
  })

  // Constant nodes produce weights too; treat their outputs like initializers.
  for (const n of raw) {
    if (n.opType !== 'Constant') continue
    const value = n.attrs.find((a) => {
      const nameF = a.find((x) => x.num === ATTR.name)
      return nameF && str(bytes, nameF) === 'value'
    })
    const t = value?.find((x) => x.num === ATTR.t)
    const h = t ? tensorHeader(bytes, t) : null
    if (n.outputs[0]) initShapes.set(n.outputs[0], { name: n.outputs[0], shape: h?.dims ?? [], dataType: h?.dataType ?? 0 })
  }

  const nodes: GraphNode[] = []
  let totalParams = 0
  const nodeOutputs = new Map<number, string[]>()
  for (const n of raw) {
    nodeOutputs.set(n.at, n.outputs)
    if (n.opType === 'Constant') continue
    const weights: Weight[] = []
    const inputs: string[] = []
    for (const i of n.inputs) {
      if (!i) continue
      const w = initShapes.get(i)
      if (w) weights.push(w)
      else inputs.push(i)
    }
    // Only float initializers count as learned parameters (int64 shape constants don't).
    const params = weights
      .filter((w) => w.dataType === 1 || w.dataType === 10 || w.dataType === 11)
      .reduce((acc, w) => acc + w.shape.reduce((a, b) => a * b, 1), 0)
    totalParams += params
    const attrs: Record<string, string> = {}
    for (const a of n.attrs) {
      const nameF = a.find((x) => x.num === ATTR.name)
      if (nameF) attrs[str(bytes, nameF)] = attrToString(bytes, a)
    }
    const name = n.name || `${n.opType}_${nodes.length}`
    nodes.push({
      index: nodes.length,
      name,
      opType: n.opType,
      scope: scopeOf(name),
      inputs,
      weights,
      outputs: n.outputs.filter(Boolean),
      attrs,
      params,
    })
  }

  const graphInputs = graphFields.filter((f) => f.num === GRAPH.input).map((f) => tensorInfo(bytes, f))
  return {
    bytes,
    producer: producer.trim(),
    opset,
    inputs: graphInputs.filter((i) => !initShapes.has(i.name)),
    outputs: graphFields.filter((f) => f.num === GRAPH.output).map((f) => tensorInfo(bytes, f)),
    nodes,
    totalParams,
    layout: { modelFields, graphFields, nodeOutputs, initializers },
  }
}

/** A learned float weight, decoded (raw_data or float_data). Null for anything else. */
export function readWeight(model: ModelGraph, name: string): Float32Array | null {
  const f = model.layout.initializers.get(name)
  if (!f) return null
  const h = tensorHeader(model.bytes, f)
  if (h.dataType !== 1) return null
  const rawF = h.fields.find((x) => x.num === TENSOR.rawData)
  if (rawF) {
    const copy = model.bytes.slice(rawF.start, rawF.end) // copy: the source offset may not be 4-byte aligned
    return new Float32Array(copy.buffer)
  }
  return Float32Array.from(floats(model.bytes, h.fields, TENSOR.floatData))
}

/** A cut: which units of a tensor to zero, along which axis of a tensor of what rank. */
export interface Ablation {
  tensor: string
  channels: number[]
  size: number
  axis: number
  rank: number
}

function encodeNode(w: Writer, inputs: string[], outputs: string[], name: string, opType: string) {
  const n = new Writer()
  for (const i of inputs) n.string(NODE.input, i)
  for (const o of outputs) n.string(NODE.output, o)
  n.string(NODE.name, name).string(NODE.opType, opType)
  w.bytes(GRAPH.node, n.finish())
}

function encodeMask(w: Writer, name: string, dims: number[], mask: Float32Array) {
  const t = new Writer()
  for (const d of dims) t.int(TENSOR.dims, d) // unpacked, ONNX's proto2 default
  t.int(TENSOR.dataType, 1)
  t.string(TENSOR.name, name)
  t.bytes(TENSOR.rawData, new Uint8Array(mask.buffer))
  w.bytes(GRAPH.initializer, t.finish())
}

/**
 * New model bytes where every node output is also a graph output, so one run
 * captures every activation, with ablation masks spliced in:
 *
 *   producer -> T__xay_pre -> Mul(mask) -> T -> (all original consumers)
 *
 * Outputs are added without type info; onnxruntime infers it.
 */
export function instrument(model: ModelGraph, ablations: Ablation[] = []): Uint8Array {
  const { bytes, layout } = model
  const byTensor = new Map(ablations.map((a) => [a.tensor, a]))
  const g = new Writer()

  layout.graphFields.forEach((f, at) => {
    const outs = layout.nodeOutputs.get(at)
    const cut = outs?.map((o) => byTensor.get(o)).find(Boolean)
    if (!outs || !cut) {
      g.raw(bytes.subarray(f.rawStart, f.rawEnd))
      return
    }
    // Re-encode this node with the cut output renamed, copying every other field verbatim.
    const pre = `${cut.tensor}__xay_pre`
    const n = new Writer()
    for (const nf of sub(bytes, f).fields()) {
      if (nf.num === NODE.output && str(bytes, nf) === cut.tensor) n.string(NODE.output, pre)
      else n.raw(bytes.subarray(nf.rawStart, nf.rawEnd))
    }
    g.bytes(GRAPH.node, n.finish())
    encodeNode(g, [pre, `${cut.tensor}__xay_mask`], [cut.tensor], `xaytheon_cut_${cut.tensor}`, 'Mul')
  })

  for (const ab of ablations) {
    const dims = Array.from({ length: ab.rank }, (_, i) => (i === ab.axis ? ab.size : 1))
    const mask = new Float32Array(ab.size).fill(1)
    for (const c of ab.channels) if (c < ab.size) mask[c] = 0
    encodeMask(g, `${ab.tensor}__xay_mask`, dims, mask)
  }

  const existing = new Set(model.outputs.map((o) => o.name))
  for (const n of model.nodes) {
    for (const o of n.outputs) {
      if (existing.has(o)) continue
      existing.add(o)
      g.bytes(GRAPH.output, new Writer().string(1, o).finish())
    }
  }

  const m = new Writer()
  for (const f of layout.modelFields) {
    if (f.num === MODEL.graph) m.bytes(MODEL.graph, g.finish())
    else m.raw(bytes.subarray(f.rawStart, f.rawEnd))
  }
  return m.finish()
}
