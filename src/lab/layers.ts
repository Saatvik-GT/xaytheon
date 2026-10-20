import type { GraphNode } from '../engine/graph'
import type { Activation, Activations } from '../engine/runtime'
import { layoutOf, type Layout } from '../engine/tensor'
import { layerHue, type RGB } from '../viz/spectrum'

/** Ops that only move data around. Hidden by default so the layer list reads like the model. */
const PLUMBING = new Set(['Reshape', 'Transpose', 'Flatten', 'Squeeze', 'Unsqueeze', 'Identity', 'Split', 'Dropout', 'Cast', 'Shape', 'Gather', 'Concat', 'Slice', 'Range', 'Equal', 'Expand', 'ConstantOfShape', 'Where'])

export interface Layer {
  node: GraphNode
  /** Position among visible layers. */
  index: number
  tensor: string
  hue: RGB
}

/**
 * The layers worth showing: nodes whose first output is a float activation,
 * minus pure plumbing (unless asked). Concat and Gather stay when they produce
 * real activations (SqueezeNet's fire modules, embedding lookups).
 */
export function visibleLayers(nodes: GraphNode[], acts: Activations | null, showPlumbing: boolean): Layer[] {
  const keep = nodes.filter((n) => {
    const out = n.outputs[0]
    const a = acts?.get(out)
    if (acts && (!a || !a.data)) return showPlumbing && !!a
    if (showPlumbing) return true
    if (!PLUMBING.has(n.opType)) return true
    // Concat of feature maps / embedding Gather are real layers, not plumbing.
    return (n.opType === 'Concat' || n.opType === 'Gather') && !!a?.data && a.dims.length >= 3
  })
  return keep.map((node, index) => ({ node, index, tensor: node.outputs[0], hue: layerHue(index, keep.length) }))
}

export function layoutFor(layer: Layer, act: Activation): Layout {
  return layoutOf(act, layer.node.opType)
}

export const shapeText = (dims: number[]) => `[${dims.join('×')}]`

/** "/blocks.0/attn/Softmax" -> "Softmax"; keeps short names readable in tight rows. */
export const shortName = (name: string) => name.split('/').filter(Boolean).pop() ?? name

export const fmt = (v: number) => {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : '—'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e4 || a < 1e-3)) return v.toExponential(1).replace('-', '−')
  return (a >= 100 ? v.toFixed(1) : v.toFixed(3)).replace('-', '−')
}
