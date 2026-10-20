import { useEffect, useMemo, useRef, useState } from 'react'
import type { Activations } from '../engine/runtime'
import { drift, layoutOf, stats, unitStrength } from '../engine/tensor'
import { emit } from '../viz/spectrum'
import { shapeText, shortName, type Layer } from './layers'

interface Props {
  layers: Layer[]
  base: Activations
  cut: Activations | null
  cuts: Map<string, Set<number>>
  selected: number
  onSelect: (i: number) => void
  height?: number
  /** Print each layer's drift under its band (for short models, like the landing demo). */
  showDrift?: boolean
}

/**
 * The model as an emission spectrum. One band per layer, in that layer's hue.
 * Inside a band every unit is a line whose brightness is how hard it fires.
 * Cut units become black absorption lines, and with surgery active the
 * bands show the cut model, so you can watch light go out downstream.
 */
export function Spectrum({ layers, base, cut, cuts, selected, onSelect, height = 56, showDrift = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const gap = layers.length > 40 ? 1 : 2
  const band = width > 0 ? (width - gap * (layers.length - 1)) / layers.length : 0

  const drifts = useMemo(
    () => layers.map((l) => (cut ? drift(base.get(l.tensor), cut.get(l.tensor)) : null)),
    [layers, base, cut],
  )

  useEffect(() => {
    const c = canvas.current
    if (!c || width === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.round(width * dpr)
    c.height = Math.round(height * dpr)
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    layers.forEach((layer, i) => {
      const x0 = i * (band + gap)
      const b = base.get(layer.tensor)
      const a = (cut ?? base).get(layer.tensor)
      if (!b?.data || !a?.data) return
      const layout = layoutOf(b, layer.node.opType)
      const baseS = unitStrength(b, layout)
      const s = cut ? unitStrength(a, layout) : baseS
      let max = 0
      for (const v of baseS) if (v > max) max = v
      const dead = cuts.get(layer.tensor)
      if (s.length === 0) {
        // No units to resolve: one even glow by overall energy.
        const e = Math.min(1, stats(a.data).meanAbs / (stats(b.data).meanAbs || 1)) * 0.55
        const [r, g, bl] = emit(layer.hue, e)
        ctx.fillStyle = `rgb(${r * 255} ${g * 255} ${bl * 255})`
        ctx.fillRect(x0, 0, band, height)
        return
      }
      // A layer with one or two units would always read white-hot; show it in its hue instead.
      const ceiling = s.length <= 2 ? 0.6 : 0.96
      const color = (v: number) => {
        const [r, g, bl] = emit(layer.hue, (max > 0 ? Math.sqrt(v / max) : 0) * ceiling)
        return `rgb(${r * 255} ${g * 255} ${bl * 255})`
      }
      const uw = band / s.length
      if (uw >= 1) {
        // Every unit gets its own line; wide ones are separated by a hairline of dark.
        const sep = uw >= 4 ? 1 : 0
        for (let u = 0; u < s.length; u++) {
          if (dead?.has(u)) continue // absorbed: stays black
          ctx.fillStyle = color(s[u])
          ctx.fillRect(x0 + u * uw, 0, Math.max(1, uw - sep), height)
        }
      } else {
        // More units than pixels: each column shows its brightest unit, and any cut unit shows as a dark line.
        const cols = Math.max(1, Math.floor(band))
        const per = s.length / cols
        for (let col = 0; col < cols; col++) {
          let v = 0
          let absorbed = false
          for (let u = Math.floor(col * per); u < Math.floor((col + 1) * per); u++) {
            if (dead?.has(u)) absorbed = true
            else if (s[u] > v) v = s[u]
          }
          if (absorbed) continue
          ctx.fillStyle = color(v)
          ctx.fillRect(x0 + col * (band / cols), 0, band / cols + 0.25, height)
        }
      }
    })
  }, [layers, base, cut, cuts, width, height, band, gap])

  const sel = layers[selected]
  const label = (i: number) => {
    const l = layers[i]
    const a = base.get(l.tensor)
    return `${String(i).padStart(2, '0')} ${l.node.opType} ${shortName(l.node.name)}${a ? ` ${shapeText(a.dims)}` : ''}`
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') onSelect(Math.min(layers.length - 1, selected + 1))
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') onSelect(Math.max(0, selected - 1))
    else if (e.key === 'Home') onSelect(0)
    else if (e.key === 'End') onSelect(layers.length - 1)
    else return
    e.preventDefault()
  }

  const tip = hover ?? null
  const tipX = tip !== null ? Math.min(Math.max(tip * (band + gap) + band / 2, 120), width - 120) : 0

  return (
    <div className="spectrum">
      <div
        ref={wrap}
        className="spectrum-bands"
        style={{ height }}
        role="listbox"
        aria-label="Layers as a spectrum"
        aria-activedescendant={sel ? `band-${selected}` : undefined}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerLeave={() => setHover(null)}
      >
        <canvas ref={canvas} style={{ width: '100%', height }} aria-hidden="true" />
        {layers.map((l, i) => (
          <div
            key={l.tensor}
            id={`band-${i}`}
            role="option"
            aria-selected={i === selected}
            aria-label={label(i)}
            className={`spectrum-hit${i === selected ? ' is-selected' : ''}`}
            style={{ left: i * (band + gap), width: Math.max(band, 1) }}
            onPointerEnter={() => setHover(i)}
            onClick={() => onSelect(i)}
          />
        ))}
        {tip !== null && layers[tip] && (
          <div className="spectrum-tip" style={{ left: tipX }}>
            <span className="mono">{label(tip)}</span>
            {drifts[tip] !== null && drifts[tip]! > 0.0005 && <span className="mono tip-drift">Δ {(drifts[tip]! * 100).toFixed(1)}%</span>}
          </div>
        )}
      </div>
      {showDrift && cut && (
        <div className="spectrum-drift mono" aria-label="Drift per layer after surgery">
          {layers.map((l, i) => {
            const d = drifts[i]
            return (
              <span key={l.tensor} style={{ left: i * (band + gap), width: band }} title={`${l.node.opType}: output moved ${d === null ? '—' : (d * 100).toFixed(1) + '%'}`}>
                {d !== null && d > 0.0005 ? `Δ${d >= 0.995 ? (d * 100).toFixed(0) : (d * 100).toFixed(d < 0.1 ? 1 : 0)}%` : cuts.get(l.tensor)?.size ? 'cut' : ''}
              </span>
            )
          })}
        </div>
      )}
      <div className="spectrum-axis mono">
        {(() => {
          const x = Math.min(Math.max(selected * (band + gap) + band / 2, 48), width - 48)
          return (
            <>
              <span style={{ visibility: x < 120 ? 'hidden' : undefined }}>input</span>
              {sel && <span className="spectrum-sel" style={{ left: x }}>{String(selected).padStart(2, '0')} · {sel.node.opType}</span>}
              <span style={{ visibility: x > width - 120 ? 'hidden' : undefined }}>output</span>
            </>
          )
        })()}
      </div>
    </div>
  )
}
