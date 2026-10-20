import { parseModel, type ModelGraph } from '../engine/graph'
import { custom, type ModelEntry, type ModelMeta } from './registry'

export interface Loaded {
  graph: ModelGraph
  meta: ModelMeta
}

const cache = new Map<string, Promise<Loaded>>()

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`

async function fetchBytes(url: string, onProgress?: (loaded: number, total: number) => void): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Couldn't download the model (HTTP ${res.status}).`)
  const total = Number(res.headers.get('content-length')) || 0
  if (!res.body || !onProgress) return new Uint8Array(await res.arrayBuffer())
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress(loaded, total)
  }
  const out = new Uint8Array(loaded)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

/** Model bytes + metadata, parsed once per session per model. */
export function loadModel(entry: ModelEntry, onProgress?: (loaded: number, total: number) => void): Promise<Loaded> {
  if (entry.id === 'custom') {
    if (!custom.bytes) return Promise.reject(new Error('No model loaded. Open an .onnx file to inspect it.'))
    return Promise.resolve().then(() => ({ graph: parseModel(custom.bytes!), meta: {} }))
  }
  let p = cache.get(entry.id)
  if (!p) {
    p = Promise.all([
      fetchBytes(assetUrl(entry.url), onProgress),
      entry.meta ? fetch(assetUrl(entry.meta)).then((r) => (r.ok ? (r.json() as Promise<ModelMeta>) : {})) : Promise.resolve({}),
    ]).then(([bytes, meta]) => ({ graph: parseModel(bytes), meta }))
    p.catch(() => cache.delete(entry.id))
    cache.set(entry.id, p)
  }
  return p
}

/** base64 28x28 uint8 -> [0, 1] floats. */
export function decodePixels(b64: string): Float32Array {
  const bin = atob(b64)
  return Float32Array.from({ length: bin.length }, (_, i) => bin.charCodeAt(i) / 255)
}
