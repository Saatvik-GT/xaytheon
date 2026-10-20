import { useEffect, useRef, useState } from 'react'
import { Scissors } from 'lucide-react'
import type { Activation } from '../engine/runtime'
import type { CuttableLayout, Layout } from '../engine/tensor'
import { css, emit, paint, rampFor, type RGB } from '../viz/spectrum'
import { Heatmap } from '../viz/Heatmap'

/** Which head and query position is being read; shared with the text input so it can light up. */
export interface AttentionFocus {
  head: number
  query: number
  weights: Float32Array
}

interface Props {
  act: Activation
  layout: Extract<Layout, { kind: 'attention' }>
  hue: RGB
  cutUnits: Set<number>
  onToggle: (unit: number, layout: CuttableLayout) => void
  tokens?: string[]
  focus: AttentionFocus | null
  onFocus?: (f: AttentionFocus | null) => void
  head: number
  onHead?: (h: number) => void
}

export function AttentionView({ act, layout, hue, cutUnits, onToggle, tokens, focus, onFocus, head: headProp, onHead }: Props) {
  const data = act.data!
  const { units: heads, t: T } = layout
  const [localHead, setLocalHead] = useState(headProp)
  const head = onHead ? headProp : localHead
  const setHead = onHead ?? setLocalHead
  const canvas = useRef<HTMLCanvasElement>(null)
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null)
  const per = T * T

  useEffect(() => {
    if (head >= heads) setHead(0)
  }, [head, heads])

  // Draw the focused head's matrix, scaled to its own max so faint patterns still show.
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(T, T)
    let max = 0
    for (let i = head * per; i < (head + 1) * per; i++) if (data[i] > max) max = data[i]
    paint(img, data, head * per, max || 1, rampFor(hue))
    ctx.putImageData(img, 0, 0)
  }, [data, head, T, per, hue])

  const row = (q: number) => data.subarray(head * per + q * T, head * per + (q + 1) * T)

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const q = Math.min(T - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * T)))
    const k = Math.min(T - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * T)))
    setHoverCell([q, k])
    onFocus?.({ head, query: q, weights: row(q) })
  }

  // When the text input asks about a query, follow it here.
  const q = focus && focus.head === head ? focus.query : hoverCell?.[0] ?? null
  const k = hoverCell?.[1] ?? null
  const char = (i: number) => (tokens?.[i] ?? String(i))

  return (
    <div className="attention">
      <p className="units-hint">
        {heads} heads, each a {T}×{T} pattern: row = the character reading, column = the character read. Click a head to cut it.
      </p>
      <div className="attn-heads" role="group" aria-label="Attention heads">
        {Array.from({ length: heads }, (_, h) => {
          const isCut = cutUnits.has(h)
          let max = 0
          for (let i = h * per; i < (h + 1) * per; i++) if (data[i] > max) max = data[i]
          return (
            <div key={h} className={`attn-head${h === head ? ' is-focused' : ''}${isCut ? ' is-cut' : ''}`}>
              <button className="attn-head-view" onClick={() => setHead(h)} aria-pressed={h === head} aria-label={`Focus head ${h}`}>
                <Heatmap data={data} offset={h * per} w={T} h={T} scale={max || 1} hue={hue} />
              </button>
              <div className="attn-head-bar">
                <span className="mono attn-head-name">head {h}</span>
                <button
                  className={`btn btn-sm${isCut ? ' btn-primary' : ' btn-quiet'}`}
                  aria-pressed={isCut}
                  onClick={() => onToggle(h, layout)}
                >
                  <Scissors /> Cut
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="attn-focus">
        <div className="attn-focus-head">
          <span className="pane-title">Head {head}</span>
          <span className="attn-readout" aria-live="polite">
            {q !== null && k !== null && hoverCell
              ? `“${char(q)}” (${q}) reads “${char(k)}” (${k}): ${(data[head * per + q * T + k] * 100).toFixed(1)}%`
              : 'Hover the matrix, or the characters in the input'}
          </span>
        </div>
        <div className="attn-matrix" style={{ '--t': T } as React.CSSProperties}>
          {tokens && tokens.length === T && T <= 48 && (
            <>
              <ol className="attn-cols mono" aria-hidden="true">{tokens.map((t, i) => <li key={i} className={i === k ? 'is-on' : ''}>{t}</li>)}</ol>
              <ol className="attn-rows mono" aria-hidden="true">{tokens.map((t, i) => <li key={i} className={i === q ? 'is-on' : ''}>{t}</li>)}</ol>
            </>
          )}
          <canvas
            ref={canvas}
            width={T}
            height={T}
            className="attn-canvas heatmap"
            role="img"
            aria-label={`Attention pattern of head ${head}`}
            onPointerMove={onMove}
            onPointerLeave={() => {
              setHoverCell(null)
              onFocus?.(null)
            }}
          />
          {q !== null && <span className="attn-row-mark" style={{ top: `${(q / T) * 100}%`, height: `${100 / T}%`, borderColor: css(emit(hue, 0.9)) }} aria-hidden="true" />}
        </div>
      </div>
    </div>
  )
}
