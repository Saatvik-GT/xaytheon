import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Ablation } from '../engine/graph'
import type { ort } from '../engine/runtime'
import type { CuttableLayout } from '../engine/tensor'
import { useXRay } from '../engine/useXRay'
import { loadModel, type Loaded } from '../models/load'
import type { ModelEntry } from '../models/registry'

export interface Cut {
  units: Set<number>
  layout: CuttableLayout
}

export type Feeds = Record<string, ort.Tensor>

/** Everything a lab needs: the loaded model, its input, the cuts, and both runs. */
export function useLab(entry: ModelEntry | null) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [progress, setProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feeds, setFeeds] = useState<Feeds | null>(null)
  const [cuts, setCuts] = useState<Map<string, Cut>>(new Map())

  useEffect(() => {
    if (!entry) return
    let live = true
    setLoaded(null)
    setLoadError(null)
    setFeeds(null)
    setCuts(new Map())
    setProgress({ loaded: 0, total: entry.sizeKB * 1024 })
    loadModel(entry, (l, t) => live && setProgress({ loaded: l, total: t || entry.sizeKB * 1024 }))
      .then((m) => live && setLoaded(m))
      .catch((e: unknown) => live && setLoadError(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [entry])

  const ablations: Ablation[] = useMemo(
    () =>
      [...cuts]
        .filter(([, c]) => c.units.size > 0)
        .map(([tensor, c]) => ({
          tensor,
          channels: [...c.units].sort((a, b) => a - b),
          size: c.layout.units,
          axis: c.layout.axis,
          rank: c.layout.rank,
        })),
    [cuts],
  )

  const xray = useXRay(loaded?.graph ?? null, feeds, ablations)

  const toggleCut = useCallback((tensor: string, unit: number, layout: CuttableLayout) => {
    setCuts((prev) => {
      const next = new Map(prev)
      const units = new Set(next.get(tensor)?.units)
      if (units.has(unit)) units.delete(unit)
      else units.add(unit)
      if (units.size) next.set(tensor, { units, layout })
      else next.delete(tensor)
      return next
    })
  }, [])

  const setCut = useCallback((tensor: string, units: number[], layout: CuttableLayout) => {
    setCuts((prev) => {
      const next = new Map(prev)
      if (units.length) next.set(tensor, { units: new Set(units), layout })
      else next.delete(tensor)
      return next
    })
  }, [])

  const clearCuts = useCallback((tensor?: string) => {
    setCuts((prev) => {
      if (!tensor) return new Map()
      const next = new Map(prev)
      next.delete(tensor)
      return next
    })
  }, [])

  const cutSets = useMemo(() => new Map([...cuts].map(([k, v]) => [k, v.units])), [cuts])
  const totalCut = ablations.reduce((a, b) => a + b.channels.length, 0)

  return { loaded, progress, loadError, feeds, setFeeds, cuts, cutSets, totalCut, toggleCut, setCut, clearCuts, xray }
}
