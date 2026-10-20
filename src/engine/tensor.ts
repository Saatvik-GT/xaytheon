import type { Activation } from './runtime'

export interface Stats {
  min: number
  max: number
  mean: number
  std: number
  sparsity: number // fraction of exact zeros (dead / ReLU-gated units)
  meanAbs: number
}

export function stats(data: Float32Array): Stats {
  let min = Infinity, max = -Infinity, sum = 0, sumSq = 0, zeros = 0, abs = 0, n = 0
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (!Number.isFinite(v)) continue // masked attention scores are -inf by design
    n++
    if (v < min) min = v
    if (v > max) max = v
    sum += v
    sumSq += v * v
    abs += v < 0 ? -v : v
    if (v === 0) zeros++
  }
  if (!n) return { min: 0, max: 0, mean: 0, std: 0, sparsity: 0, meanAbs: 0 }
  const mean = sum / n
  return { min, max, mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)), sparsity: zeros / n, meanAbs: abs / n }
}

/**
 * The magnitude shown at full brightness: the 99.5th percentile of |a|, so one
 * outlier can't dim every map. Values above it saturate to white-hot.
 */
export function robustScale(data: Float32Array): number {
  const step = Math.max(1, Math.floor(data.length / 20000))
  const sample: number[] = []
  for (let i = 0; i < data.length; i += step) {
    const v = data[i]
    if (Number.isFinite(v)) sample.push(v < 0 ? -v : v)
  }
  if (!sample.length) return 1
  sample.sort((a, b) => a - b)
  return sample[Math.min(sample.length - 1, Math.floor(sample.length * 0.995))] || sample[sample.length - 1] || 1
}

export function histogram(data: Float32Array, bins: number, lo: number, hi: number): number[] {
  const counts = new Array(bins).fill(0)
  const w = hi - lo || 1
  for (let i = 0; i < data.length; i++) {
    if (Number.isFinite(data[i])) counts[Math.min(bins - 1, Math.max(0, Math.floor(((data[i] - lo) / w) * bins)))]++
  }
  return counts
}

export function softmax(logits: Float32Array, temperature = 1): Float32Array {
  let m = -Infinity
  for (const v of logits) if (v > m) m = v
  const e = logits.map((v) => Math.exp((v - m) / temperature))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

export const argmax = (v: ArrayLike<number>) => {
  let best = 0
  for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i
  return best
}

/**
 * How an activation is laid out on screen, and which axis its "units" live on:
 *  - maps:      [1, C, H, W]          C feature maps (conv channels)
 *  - attention: [1, H, T, T] Softmax  H heads, each a T x T attention pattern
 *  - tokens:    [1, T, D]             T x D heatmap; units are the D hidden dims
 *  - vector:    [1, N] or [N]         N neurons
 *  - grid:      anything else, flattened (no cutting)
 */
export type Layout =
  | { kind: 'maps'; units: number; h: number; w: number; axis: 1; rank: 4 }
  | { kind: 'attention'; units: number; t: number; axis: 1; rank: 4 }
  | { kind: 'tokens'; units: number; rows: number; axis: 2; rank: 3 }
  | { kind: 'vector'; units: number; axis: number; rank: number }
  | { kind: 'grid'; units: 0; rows: number; cols: number }

export type CuttableLayout = Exclude<Layout, { kind: 'grid' }>

export function layoutOf(act: Activation, opType = ''): Layout {
  const d = act.dims
  const rank = d.length
  if (rank === 4 && d[0] === 1 && opType === 'Softmax' && d[2] === d[3]) return { kind: 'attention', units: d[1], t: d[2], axis: 1, rank: 4 }
  if (rank === 4 && d[0] === 1) return { kind: 'maps', units: d[1], h: d[2], w: d[3], axis: 1, rank: 4 }
  if (rank === 3 && d[0] === 1) return { kind: 'tokens', units: d[2], rows: d[1], axis: 2, rank: 3 }
  if (rank === 2 && d[0] === 1) return { kind: 'vector', units: d[1], axis: 1, rank: 2 }
  if (rank === 1) return { kind: 'vector', units: d[0], axis: 0, rank: 1 }
  const n = d.reduce((a, b) => a * b, 1)
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)))
  return { kind: 'grid', units: 0, rows: Math.ceil(n / cols), cols }
}

export const unitNoun = (l: Layout, n = 2) => {
  const base = l.kind === 'maps' ? 'channel' : l.kind === 'attention' ? 'head' : l.kind === 'tokens' ? 'hidden dim' : 'neuron'
  return n === 1 ? base : `${base}s`
}

/** Mean |activation| per unit: how hard each channel / head / neuron is firing. */
export function unitStrength(act: Activation, l: Layout): Float32Array {
  const data = act.data
  if (!data || l.kind === 'grid') return new Float32Array()
  if (l.kind === 'maps' || l.kind === 'attention') {
    const per = l.kind === 'maps' ? l.h * l.w : l.t * l.t
    const out = new Float32Array(l.units)
    for (let c = 0; c < l.units; c++) {
      let s = 0
      for (let i = c * per, e = i + per; i < e; i++) if (Number.isFinite(data[i])) s += data[i] < 0 ? -data[i] : data[i]
      out[c] = s / per
    }
    return out
  }
  if (l.kind === 'tokens') {
    const out = new Float32Array(l.units)
    for (let r = 0; r < l.rows; r++)
      for (let c = 0; c < l.units; c++) {
        const v = data[r * l.units + c]
        out[c] += (v < 0 ? -v : v) / l.rows
      }
    return out
  }
  return data.map(Math.abs)
}

/** Relative L2 change caused by surgery: ‖a − b‖ / ‖b‖. */
export function drift(base: Activation | undefined, cut: Activation | undefined): number | null {
  if (!base?.data || !cut?.data || base.data.length !== cut.data.length) return null
  let num = 0, den = 0
  for (let i = 0; i < base.data.length; i++) {
    const b = base.data[i]
    if (!Number.isFinite(b)) continue
    const d = cut.data[i] - b
    num += d * d
    den += b * b
  }
  return Math.sqrt(num) / (Math.sqrt(den) || 1)
}
