import { memo, useEffect, useRef } from 'react'
import { Scissors } from 'lucide-react'
import type { Activation, Activations } from '../engine/runtime'
import { drift, layoutOf, stats, unitStrength } from '../engine/tensor'
import { css, type RGB } from '../viz/spectrum'
import { Heatmap } from '../viz/Heatmap'
import { shapeText, shortName, type Layer } from './layers'

interface Props {
  layers: Layer[]
  base: Activations
  cut: Activations | null
  cuts: Map<string, Set<number>>
  selected: number
  onSelect: (i: number) => void
  showPlumbing: boolean
  onTogglePlumbing: () => void
}

/** A small picture of a layer: its strongest map, its token grid, or its neurons. */
const Thumb = memo(function Thumb({ act, hue, opType }: { act: Activation; hue: RGB; opType: string }) {
  if (!act.data) return <span className="thumb thumb-empty" />
  const l = layoutOf(act, opType)
  const s = stats(act.data)
  const scale = Math.max(Math.abs(s.min), Math.abs(s.max))
  if (l.kind === 'maps' || l.kind === 'attention') {
    const strength = unitStrength(act, l)
    let c = 0
    for (let i = 1; i < strength.length; i++) if (strength[i] > strength[c]) c = i
    const [w, h] = l.kind === 'maps' ? [l.w, l.h] : [l.t, l.t]
    return <Heatmap data={act.data} offset={c * w * h} w={w} h={h} scale={scale} hue={hue} className="thumb" />
  }
  if (l.kind === 'tokens') return <Heatmap data={act.data} w={l.units} h={l.rows} scale={scale} hue={hue} className="thumb thumb-stretch" />
  if (l.kind === 'vector') {
    const v = unitStrength(act, l)
    const n = Math.min(24, v.length)
    const step = v.length / n
    const vals = Array.from({ length: n }, (_, i) => {
      let m = 0
      for (let u = Math.floor(i * step); u < Math.floor((i + 1) * step); u++) m = Math.max(m, v[u])
      return m
    })
    const max = Math.max(...vals) || 1
    return (
      <svg className="thumb" viewBox={`0 0 ${n} 16`} preserveAspectRatio="none" aria-hidden="true">
        {vals.map((x, i) => <rect key={i} x={i + 0.15} width={0.7} y={16 - (x / max) * 15} height={(x / max) * 15} fill={css(hue)} />)}
      </svg>
    )
  }
  return <span className="thumb thumb-empty" />
})

export function LayerList({ layers, base, cut, cuts, selected, onSelect, showPlumbing, onTogglePlumbing }: Props) {
  const list = useRef<HTMLOListElement>(null)

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  let lastScope = ''
  return (
    <div className="layers">
      <div className="pane-head">
        <h2 className="pane-title">Layers <span className="pane-count mono">{layers.length}</span></h2>
        <label className="toggle">
          <input type="checkbox" checked={showPlumbing} onChange={onTogglePlumbing} />
          <span>Reshapes</span>
        </label>
      </div>
      <ol className="layer-list" ref={list}>
        {layers.map((l, i) => {
          const act = base.get(l.tensor)
          if (!act) return null
          const d = cut ? drift(act, cut.get(l.tensor)) : null
          const n = cuts.get(l.tensor)?.size ?? 0
          const scope = l.node.scope
          const header = scope && scope !== lastScope && layers.filter((x) => x.node.scope === scope).length > 1
          lastScope = scope
          return [
            header && <li key={`h-${scope}`} className="layer-scope mono" aria-hidden="true">{scope}</li>,
            <li key={l.tensor}>
              <button
                className={`layer-row${i === selected ? ' is-selected' : ''}`}
                data-index={i}
                aria-current={i === selected}
                onClick={() => onSelect(i)}
              >
                <span className="layer-index mono">{String(i).padStart(2, '0')}</span>
                <Thumb act={(cut ?? base).get(l.tensor) ?? act} hue={l.hue} opType={l.node.opType} />
                <span className="layer-text">
                  <span className="layer-op">
                    <i className="hue-dot" style={{ background: css(l.hue) }} aria-hidden="true" />
                    {l.node.opType}
                    {n > 0 && <span className="layer-cut mono" aria-label={`${n} cut`}><Scissors aria-hidden="true" />{n}</span>}
                  </span>
                  <span className="layer-meta mono">
                    <span className="layer-name">{shortName(l.node.name)}</span>
                    <span>{shapeText(act.dims)}</span>
                  </span>
                </span>
                {d !== null && d > 0.0005 && (
                  <span className="layer-drift mono" title="How far surgery moved this layer's output (relative L2)">
                    Δ{d >= 0.995 ? (d * 100).toFixed(0) : (d * 100).toFixed(1)}%
                  </span>
                )}
              </button>
            </li>,
          ]
        })}
      </ol>
    </div>
  )
}
