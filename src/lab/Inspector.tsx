import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, Scissors } from 'lucide-react'
import { readWeight, type ModelGraph } from '../engine/graph'
import type { Activation } from '../engine/runtime'
import { histogram, layoutOf, robustScale, stats, unitNoun, unitStrength, type CuttableLayout, type Layout } from '../engine/tensor'
import { css, emit, emitNegative, type RGB } from '../viz/spectrum'
import { Heatmap } from '../viz/Heatmap'
import { AttentionView, type AttentionFocus } from './AttentionView'
import { fmt, shapeText, type Layer } from './layers'

interface Props {
  model: ModelGraph
  layer: Layer
  count: number
  base: Activation
  cut: Activation | null
  cutUnits: Set<number>
  onToggle: (unit: number, layout: CuttableLayout) => void
  onSetCut: (units: number[], layout: CuttableLayout) => void
  onStep: (delta: number) => void
  tokens?: string[]
  focus?: AttentionFocus | null
  onFocus?: (f: AttentionFocus | null) => void
  attnHead?: number
  onAttnHead?: (h: number) => void
}

type View = 'original' | 'cut' | 'diff'
const MAX_UNITS = 64

function difference(a: Activation, b: Activation): Activation {
  const d = new Float32Array(a.data!.length)
  for (let i = 0; i < d.length; i++) d[i] = Number.isFinite(a.data![i]) ? Math.abs(b.data![i] - a.data![i]) : 0
  return { ...a, data: d }
}

export function Inspector(props: Props) {
  const { model, layer, count, base, cut, cutUnits, onToggle, onSetCut, onStep } = props
  const [view, setView] = useState<View>('original')
  const [tab, setTab] = useState<'activations' | 'weights'>('activations')
  const [sorted, setSorted] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [allAttrs, setAllAttrs] = useState(false)

  useEffect(() => {
    if (!cut) setView('original')
  }, [cut])
  useEffect(() => {
    setShowAll(false)
    setTab('activations')
  }, [layer.tensor])

  const act = view === 'original' || !cut?.data ? base : view === 'cut' ? cut : difference(base, cut)
  const info = useMemo(() => {
    if (!act.data) return null
    const layout = layoutOf(act, layer.node.opType)
    const s = stats(act.data)
    return { layout, s, scale: robustScale(act.data), hist: histogram(act.data, 64, s.min, s.max), strength: unitStrength(base, layoutOf(base, layer.node.opType)) }
  }, [act, base, layer.node.opType])

  const weight = layer.node.weights.find((w) => w.dataType === 1 && w.shape.length >= 2)
  const attrs = Object.entries(layer.node.attrs)

  return (
    <section className="inspector" aria-label={`Layer ${layer.index}: ${layer.node.opType}`}>
      <header className="insp-head">
        <div className="insp-title">
          <span className="op-chip mono" style={{ '--hue': css(layer.hue) } as React.CSSProperties}>{layer.node.opType}</span>
          <h2 className="insp-name mono" title={layer.node.name}>{layer.node.name}</h2>
          <span className="insp-step">
            <button className="btn btn-sm btn-quiet btn-icon" onClick={() => onStep(-1)} disabled={layer.index === 0} aria-label="Previous layer"><ChevronLeft /></button>
            <span className="mono insp-pos">{layer.index + 1}/{count}</span>
            <button className="btn btn-sm btn-quiet btn-icon" onClick={() => onStep(1)} disabled={layer.index === count - 1} aria-label="Next layer"><ChevronRight /></button>
          </span>
        </div>
        <dl className="insp-facts mono">
          <div><dt>out</dt><dd>{shapeText(base.dims)}</dd></div>
          {layer.node.params > 0 && <div><dt>params</dt><dd>{layer.node.params.toLocaleString()}</dd></div>}
          {layer.node.weights.map((w) => <div key={w.name}><dt>{w.shape.length === 1 ? 'b' : 'w'}</dt><dd>{shapeText(w.shape)}</dd></div>)}
          {(allAttrs ? attrs : attrs.slice(0, 4)).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          {attrs.length > 4 && (
            <button className="insp-more" onClick={() => setAllAttrs((v) => !v)}>{allAttrs ? 'fewer' : `+${attrs.length - 4} more`}</button>
          )}
        </dl>
      </header>

      {!info ? (
        <p className="insp-empty">This output is <code>{base.type}</code>: shape bookkeeping or indices, not a learned activation.</p>
      ) : (
        <>
          <div className="insp-stats">
            <Stat k="min" v={fmt(info.s.min)} />
            <Stat k="max" v={fmt(info.s.max)} />
            <Stat k="mean" v={fmt(info.s.mean)} />
            <Stat k="std" v={fmt(info.s.std)} />
            <Stat k="zeros" v={`${(info.s.sparsity * 100).toFixed(1)}%`} hint="Exact zeros, usually units a ReLU switched off" />
          </div>
          <Histogram counts={info.hist} lo={info.s.min} hi={info.s.max} hue={layer.hue} />

          <div className="insp-toolbar">
            <div className="seg" role="tablist" aria-label="What to show">
              <button role="tab" aria-selected={tab === 'activations'} onClick={() => setTab('activations')}>Activations</button>
              {weight && <button role="tab" aria-selected={tab === 'weights'} onClick={() => setTab('weights')}>Weights</button>}
            </div>
            {tab === 'activations' && cut && (
              <div className="seg" role="group" aria-label="Which model">
                <button aria-pressed={view === 'original'} onClick={() => setView('original')}>Original</button>
                <button aria-pressed={view === 'cut'} onClick={() => setView('cut')}>After surgery</button>
                <button aria-pressed={view === 'diff'} onClick={() => setView('diff')}>Difference</button>
              </div>
            )}
            <span className="insp-toolbar-gap" />
            {tab === 'activations' && info.layout.kind !== 'grid' && (
              <UnitActions layout={info.layout} strength={info.strength} cutUnits={cutUnits} sorted={sorted} onSort={() => setSorted((v) => !v)} onSetCut={onSetCut} />
            )}
          </div>

          {tab === 'weights' && weight ? (
            <WeightView model={model} name={weight.name} shape={weight.shape} hue={layer.hue} />
          ) : (
            <Units
              act={act}
              layout={info.layout}
              scale={info.scale}
              hue={layer.hue}
              strength={info.strength}
              cutUnits={cutUnits}
              sorted={sorted}
              showAll={showAll}
              onShowAll={() => setShowAll((v) => !v)}
              onToggle={onToggle}
              tokens={props.tokens}
              focus={props.focus}
              onFocus={props.onFocus}
              attnHead={props.attnHead ?? 0}
              onAttnHead={props.onAttnHead}
            />
          )}
        </>
      )}
    </section>
  )
}

function Stat({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="stat" title={hint}>
      <span className="stat-k">{k}</span>
      <span className="stat-v mono">{v}</span>
    </div>
  )
}

function Histogram({ counts, lo, hi, hue }: { counts: number[]; lo: number; hi: number; hue: RGB }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState(0)
  // Redraw when the canvas gets a size (it may first render inside a hidden mobile tab).
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ro = new ResizeObserver(([e]) => setSize(Math.round(e.contentRect.width)))
    ro.observe(c)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const c = ref.current
    if (!c || !size) return
    const w = c.clientWidth, h = c.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = w * dpr
    c.height = h * dpr
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    // Log scale: one spike of zeros (padding, dead ReLUs) would flatten everything else.
    const top = Math.log1p(Math.max(...counts)) || 1
    const bw = w / counts.length
    const mag = Math.max(Math.abs(lo), Math.abs(hi)) || 1
    counts.forEach((n, i) => {
      if (!n) return
      const center = lo + ((i + 0.5) / counts.length) * (hi - lo)
      const t = 0.25 + 0.7 * (Math.abs(center) / mag)
      const [r, g, b] = center < 0 ? emitNegative(hue, t + 0.1) : emit(hue, t)
      ctx.fillStyle = `rgb(${r * 255} ${g * 255} ${b * 255})`
      const bh = Math.max(1, (Math.log1p(n) / top) * (h - 2))
      ctx.fillRect(i * bw + 0.5, h - bh, Math.max(1, bw - 1), bh)
    })
    if (lo < 0 && hi > 0) {
      ctx.fillStyle = 'rgb(255 255 255 / 0.35)'
      ctx.fillRect(((0 - lo) / (hi - lo)) * w, 0, 1, h)
    }
  }, [counts, lo, hi, hue, size])
  return (
    <figure className="hist">
      <canvas ref={ref} aria-label="Distribution of values, log scale" role="img" />
      <figcaption className="mono"><span>{fmt(lo)}</span><span>log count</span><span>{fmt(hi)}</span></figcaption>
    </figure>
  )
}

function UnitActions({ layout, strength, cutUnits, sorted, onSort, onSetCut }: {
  layout: CuttableLayout | Layout
  strength: Float32Array
  cutUnits: Set<number>
  sorted: boolean
  onSort: () => void
  onSetCut: (units: number[], layout: CuttableLayout) => void
}) {
  if (layout.kind === 'grid') return null
  const top = () => {
    const k = Math.max(1, Math.round(layout.units / 4))
    return [...strength.keys()].sort((a, b) => strength[b] - strength[a]).slice(0, k)
  }
  return (
    <span className="unit-actions">
      <button className={`btn btn-sm${sorted ? '' : ' btn-quiet'}`} onClick={onSort} aria-pressed={sorted} title="Order units by mean |activation|">Sort by strength</button>
      <button className="btn btn-sm" onClick={() => onSetCut(top(), layout)} title="Cut the strongest quarter of this layer's units">
        <Scissors /> Cut top 25%
      </button>
      {cutUnits.size > 0 && (
        <button className="btn btn-sm btn-quiet" onClick={() => onSetCut([], layout)}>
          <RotateCcw /> Restore {cutUnits.size}
        </button>
      )}
    </span>
  )
}

interface UnitsProps {
  act: Activation
  layout: Layout
  scale: number
  hue: RGB
  strength: Float32Array
  cutUnits: Set<number>
  sorted: boolean
  showAll: boolean
  onShowAll: () => void
  onToggle: (unit: number, layout: CuttableLayout) => void
  tokens?: string[]
  focus?: AttentionFocus | null
  onFocus?: (f: AttentionFocus | null) => void
  attnHead: number
  onAttnHead?: (h: number) => void
}

function Units({ act, layout, scale, hue, strength, cutUnits, sorted, showAll, onShowAll, onToggle, tokens, focus, onFocus, attnHead, onAttnHead }: UnitsProps) {
  const data = act.data!
  if (layout.kind === 'grid') {
    const padded = data.length >= layout.rows * layout.cols ? data : (() => { const p = new Float32Array(layout.rows * layout.cols); p.set(data); return p })()
    return (
      <div className="units-grid-plain">
        <Heatmap data={padded} w={layout.cols} h={layout.rows} scale={scale} hue={hue} label="Activation values" />
        <p className="insp-note">This tensor has no unit axis to cut, so it is shown flattened.</p>
      </div>
    )
  }
  if (layout.kind === 'attention') {
    return <AttentionView act={act} layout={layout} hue={hue} cutUnits={cutUnits} onToggle={onToggle} tokens={tokens} focus={focus ?? null} onFocus={onFocus} head={attnHead} onHead={onAttnHead} />
  }

  const order = [...strength.keys()]
  if (sorted) order.sort((a, b) => strength[b] - strength[a])
  const cap = layout.kind === 'maps' ? MAX_UNITS : 256
  const shown = showAll ? order.slice(0, 2048) : order.slice(0, cap)
  const more = layout.units > cap && (
    <button className="btn btn-sm btn-quiet units-more" onClick={onShowAll}>
      {showAll ? `Show first ${cap}` : `Show all ${layout.units.toLocaleString()} ${unitNoun(layout)}`}
    </button>
  )
  const signed = data.some((v) => v < 0)
  const hint = (
    <p className="units-hint">
      {layout.units.toLocaleString()} {unitNoun(layout, layout.units)}. Click one to cut it; click again to restore.
      {signed && <span className="sign-key"> <i className="sign-pos" style={{ background: css(emit(hue, 0.85)) }} />positive <i className="sign-neg" style={{ background: css(emitNegative(hue, 1)) }} />negative</span>}
    </p>
  )

  if (layout.kind === 'maps') {
    return (
      <>
        {hint}
        <div className={`units-maps${layout.units <= 16 ? ' is-large' : ''}`} role="group" aria-label="Feature maps">
          {shown.map((c) => {
            const isCut = cutUnits.has(c)
            return (
              <button
                key={c}
                className={`unit-map${isCut ? ' is-cut' : ''}`}
                aria-pressed={isCut}
                aria-label={`Channel ${c}, mean |a| ${fmt(strength[c])}${isCut ? ', cut' : ''}`}
                title={`channel ${c} · mean |a| ${fmt(strength[c])}`}
                onClick={() => onToggle(c, layout)}
              >
                <Heatmap data={data} offset={c * layout.h * layout.w} w={layout.w} h={layout.h} scale={scale} hue={hue} />
                <span className="unit-label mono">{c}</span>
                {isCut && <span className="unit-cut" aria-hidden="true"><Scissors /></span>}
              </button>
            )
          })}
        </div>
        {more}
      </>
    )
  }

  // tokens: show the T x D grid with character rows, then the hidden dims as cuttable bars
  const max = Math.max(...strength) || 1
  return (
    <>
      {layout.kind === 'tokens' && (
        <div className="tokens-map">
          {tokens && tokens.length === layout.rows && (
            <ol className="tokens-rows mono" aria-hidden="true">
              {tokens.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          )}
          <Heatmap data={data} w={layout.units} h={layout.rows} scale={scale} hue={hue} className="tokens-heat" label="Hidden state per character" />
        </div>
      )}
      {hint}
      <div className="units-bars" role="group" aria-label={unitNoun(layout)}>
        {shown.map((u) => {
          const isCut = cutUnits.has(u)
          const t = strength[u] / max
          return (
            <button
              key={u}
              className={`unit-bar${isCut ? ' is-cut' : ''}`}
              aria-pressed={isCut}
              aria-label={`${unitNoun(layout, 1)} ${u}, ${fmt(layout.kind === 'vector' ? data[u] : strength[u])}${isCut ? ', cut' : ''}`}
              title={`${unitNoun(layout, 1)} ${u} · ${fmt(layout.kind === 'vector' ? data[u] : strength[u])}`}
              onClick={() => onToggle(u, layout)}
            >
              <span style={{ transform: isCut ? undefined : `scaleY(${Math.max(0.015, t)})`, background: isCut ? undefined : css(emit(hue, 0.3 + 0.65 * t)) }} />
            </button>
          )
        })}
      </div>
      {more}
    </>
  )
}

function WeightView({ model, name, shape, hue }: { model: ModelGraph; name: string; shape: number[]; hue: RGB }) {
  const w = useMemo(() => readWeight(model, name), [model, name])
  if (!w) return <p className="insp-note">These weights aren’t stored as plain float32, so they can’t be drawn.</p>
  const s = stats(w)
  const scale = Math.max(Math.abs(s.min), Math.abs(s.max))
  const caption = <p className="insp-note mono">{name} · {shapeText(shape)} · min {fmt(s.min)} · max {fmt(s.max)}</p>

  if (shape.length === 4 && shape[2] * shape[3] > 1) {
    // Conv kernels: one tile per output channel, averaged over its input channels.
    const [o, i, kh, kw] = shape
    const tiles = Array.from({ length: Math.min(o, 128) }, (_, oc) => {
      const t = new Float32Array(kh * kw)
      for (let ic = 0; ic < i; ic++) for (let k = 0; k < kh * kw; k++) t[k] += w[((oc * i + ic) * kh * kw) + k] / i
      return t
    })
    const tmax = Math.max(...tiles.map((t) => Math.max(...t.map(Math.abs)))) || 1
    return (
      <>
        {caption}
        <p className="units-hint">One {kh}×{kw} kernel per output channel{i > 1 ? `, averaged over ${i} input channels` : ''}. Grey means negative.</p>
        <div className="units-maps is-kernels" aria-label="Kernels">
          {tiles.map((t, oc) => (
            <figure key={oc} className="unit-map is-static">
              <Heatmap data={t} w={kw} h={kh} scale={tmax} hue={hue} />
              <span className="unit-label mono">{oc}</span>
            </figure>
          ))}
        </div>
      </>
    )
  }
  // A matrix: [out, in] (or 1x1 conv [out, in, 1, 1]).
  const rows = shape[0]
  const cols = shape.slice(1).reduce((a, b) => a * b, 1)
  return (
    <>
      {caption}
      <p className="units-hint">Rows are output units, columns are inputs. Grey means negative.</p>
      <div className="weight-matrix">
        <Heatmap data={w} w={cols} h={rows} scale={scale} hue={hue} label="Weight matrix" />
      </div>
    </>
  )
}
