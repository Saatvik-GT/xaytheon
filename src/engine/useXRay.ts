import { useEffect, useRef, useState } from 'react'
import type { Ablation, ModelGraph } from './graph'
import { XRaySession, type Activations, type ort } from './runtime'

export type XRayStatus = 'idle' | 'compiling' | 'ready' | 'error'

export interface XRayResult {
  /** The input these activations came from. */
  feeds: Record<string, ort.Tensor> | null
  base: Activations | null
  cut: Activations | null // null when no units are cut
  status: XRayStatus
  error: string | null
  ms: number
}

/**
 * Owns two sessions, the untouched model and the "surgically" cut one, and
 * re-runs both whenever the input or the cuts change. Runs are coalesced: if
 * the input keeps changing (drawing, webcam), only the newest one runs next.
 */
export function useXRay(model: ModelGraph | null, feeds: Record<string, ort.Tensor> | null, ablations: Ablation[]): XRayResult {
  const [result, setResult] = useState<XRayResult>({ feeds: null, base: null, cut: null, status: 'idle', error: null, ms: 0 })
  const base = useRef<Promise<XRaySession> | null>(null)
  const cut = useRef<Promise<XRaySession> | null>(null)
  const busy = useRef(false)
  const pending = useRef<(() => Promise<void>) | null>(null)

  const schedule = (job: () => Promise<void>) => {
    pending.current = job
    if (busy.current) return
    busy.current = true
    void (async () => {
      while (pending.current) {
        const next = pending.current
        pending.current = null
        await next()
      }
      busy.current = false
    })()
  }

  useEffect(() => {
    if (!model) return
    setResult({ feeds: null, base: null, cut: null, status: 'compiling', error: null, ms: 0 })
    const s = XRaySession.create(model)
    base.current = s
    s.catch((e: unknown) => setResult((r) => ({ ...r, status: 'error', error: message(e) })))
    return () => void s.then((x) => x.release(), () => {})
  }, [model])

  const cutKey = JSON.stringify(ablations)
  useEffect(() => {
    if (!model || ablations.length === 0) {
      cut.current = null
      return
    }
    const s = XRaySession.create(model, ablations)
    cut.current = s
    // Release after a beat so an in-flight run on this session can finish.
    return () => void s.then((x) => setTimeout(() => x.release(), 2000), () => {})
  }, [model, cutKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!model || !feeds) return
    const b = base.current, c = cut.current
    schedule(async () => {
      try {
        const t0 = performance.now()
        const baseActs = await (await b!).run(feeds)
        const ms = performance.now() - t0
        const cutActs = c ? await (await c).run(feeds) : null
        setResult({ feeds, base: baseActs, cut: cutActs, status: 'ready', error: null, ms })
      } catch (e) {
        setResult((r) => ({ ...r, status: 'error', error: message(e) }))
      }
    })
  }, [model, feeds, cutKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return result
}

function message(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/external data|external_data/i.test(m)) return 'This model stores its weights in a separate file. Re-export it with the weights embedded (a single .onnx file).'
  return m
}
