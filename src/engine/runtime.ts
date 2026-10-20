import * as ort from 'onnxruntime-web/wasm'
import wasmMjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'
import wasmBin from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { instrument, type Ablation, type ModelGraph, type TensorInfo } from './graph'

// The plain WASM build, served from this site (no CDN, ~14 MB, cached after the first visit).
// Threads would need cross-origin isolation, which static hosting can't promise.
const abs = (u: string) => new URL(u, window.location.href).href
ort.env.wasm.wasmPaths = { mjs: abs(wasmMjs), wasm: abs(wasmBin) }
ort.env.wasm.numThreads = 1

export { ort }

export interface Activation {
  name: string
  dims: number[]
  data: Float32Array | null // null for non-float tensors (shapes, indices…)
  type: string
}

export type Activations = Map<string, Activation>

export class XRaySession {
  private session: ort.InferenceSession

  private constructor(session: ort.InferenceSession) {
    this.session = session
  }

  static async create(model: ModelGraph, ablations: Ablation[] = []) {
    const bytes = instrument(model, ablations)
    const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] })
    return new XRaySession(session)
  }

  async run(feeds: Record<string, ort.Tensor>): Promise<Activations> {
    const out = await this.session.run(feeds)
    const acts: Activations = new Map()
    for (const [name, t] of Object.entries(out)) {
      acts.set(name, {
        name,
        dims: [...t.dims],
        type: t.type,
        data: t.type === 'float32' ? (t.data as Float32Array) : null,
      })
    }
    return acts
  }

  release() {
    void this.session.release()
  }
}

/** Resolve symbolic dims to something concrete: batch-like dims -> 1, others -> 16. */
export function concreteShape(info: TensorInfo): number[] {
  return (info.shape ?? [1]).map((d, i) => (typeof d === 'number' && d > 0 ? d : i === 0 ? 1 : 16))
}

/** Seeded Gaussian noise, so "random input" is reproducible. */
export function randomTensor(info: TensorInfo, seed = 7): ort.Tensor {
  const dims = concreteShape(info)
  const n = dims.reduce((a, b) => a * b, 1)
  let s = seed >>> 0
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32
  if (info.elemType === 7) {
    return new ort.Tensor('int64', BigInt64Array.from({ length: n }, () => BigInt(Math.floor(rand() * 64))), dims)
  }
  const data = Float32Array.from({ length: n }, () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand()))
  return new ort.Tensor('float32', data, dims)
}

export const floatTensor = (data: Float32Array, dims: number[]) => new ort.Tensor('float32', data, dims)
export const tokenTensor = (ids: number[]) => new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length])
