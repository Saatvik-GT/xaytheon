import { ArrowRight } from 'lucide-react'
import type { Activation } from '../../engine/runtime'
import { argmax, softmax } from '../../engine/tensor'

interface Props {
  base: Activation
  cut: Activation | null
  labels?: string[]
  top?: number
}

const pct = (v: number) => (v * 100).toFixed(1)

/** Softmax over the logits. With surgery active: original as an outline, the cut model solid. */
export function ClassOutput({ base, cut, labels, top = 5 }: Props) {
  const p = softmax(base.data!)
  const q = cut?.data ? softmax(cut.data) : null
  const shown = q ?? p
  const best = argmax(shown)
  const was = argmax(p)
  const name = (i: number) => labels?.[i] ?? `class ${i}`
  const order = [...p.keys()].sort((a, b) => Math.max(p[b], q?.[b] ?? 0) - Math.max(p[a], q?.[a] ?? 0)).slice(0, top)

  return (
    <div className="classes">
      <div className="verdict">
        <span className="verdict-name">{name(best)}</span>
        <span className="verdict-conf mono">{pct(shown[best])}%</span>
      </div>
      {q && best !== was && (
        <p className="verdict-flip">
          Surgery changed the answer:{' '}
          <span className="flip-pair"><span>{name(was)}</span> <ArrowRight aria-hidden="true" /> <span>{name(best)}</span></span>
        </p>
      )}
      <ol className="class-bars" aria-label="Top predictions">
        {q && (
          <li className="class-head" aria-hidden="true">
            <span />
            <span />
            <span className="mono">%</span>
            <span className="mono">Δ pts</span>
          </li>
        )}
        {order.map((i) => {
          const d = q ? q[i] - p[i] : 0
          return (
            <li key={i}>
              <span className="class-name" title={name(i)}>{name(i)}</span>
              <span className="class-track" aria-hidden="true">
                {q ? (
                  <>
                    <span className="class-fill ghost" style={{ transform: `scaleX(${p[i]})` }} />
                    <span className="class-fill" style={{ transform: `scaleX(${q[i]})` }} />
                  </>
                ) : (
                  <span className="class-fill" style={{ transform: `scaleX(${p[i]})` }} />
                )}
              </span>
              <span className="class-pct mono">{pct(shown[i])}</span>
              {q && (
                <span className={`class-delta mono${Math.abs(d) < 0.0005 ? ' is-zero' : ''}`}>
                  {Math.abs(d) < 0.0005 ? '0.0' : `${d > 0 ? '+' : '−'}${pct(Math.abs(d))}`}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {q && <p className="legend"><i className="legend-ghost" /> original <i className="legend-solid" /> after surgery</p>}
    </div>
  )
}
