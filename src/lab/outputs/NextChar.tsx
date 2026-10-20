import { Pause, PenLine, Plus } from 'lucide-react'
import type { Activation } from '../../engine/runtime'
import { softmax } from '../../engine/tensor'
import { visible } from '../inputs/TextInput'

interface Props {
  base: Activation
  cut: Activation | null
  vocab: string[]
  temperature: number
  onTemperature: (t: number) => void
  writing: boolean
  onNext: () => void
  onWrite: () => void
  onStop: () => void
}

/** Distribution over the next character, from the last position's logits. */
export function lastRow(act: Activation): Float32Array {
  const [, T, V] = act.dims
  return act.data!.subarray((T - 1) * V, T * V)
}

export function NextChar({ base, cut, vocab, temperature, onTemperature, writing, onNext, onWrite, onStop }: Props) {
  const p = softmax(lastRow(base), temperature)
  const q = cut?.data ? softmax(lastRow(cut), temperature) : null
  const shown = q ?? p
  const order = [...shown.keys()].sort((a, b) => shown[b] - shown[a]).slice(0, 8)

  return (
    <div className="nextchar">
      <ol className="char-bars" aria-label="Most likely next characters">
        {order.map((i) => (
          <li key={i}>
            <span className="char-glyph mono">{visible(vocab[i])}</span>
            <span className="class-track" aria-hidden="true">
              {q && <span className="class-fill ghost" style={{ transform: `scaleX(${p[i]})` }} />}
              <span className="class-fill" style={{ transform: `scaleX(${shown[i]})` }} />
            </span>
            <span className="class-pct mono">{(shown[i] * 100).toFixed(1)}</span>
          </li>
        ))}
      </ol>
      <label className="range">
        <span className="range-head">
          <span>Temperature</span>
          <span className="mono">{temperature.toFixed(2)}</span>
        </span>
        <input type="range" min={0.2} max={1.6} step={0.05} value={temperature} onChange={(e) => onTemperature(Number(e.target.value))} />
      </label>
      <div className="nextchar-actions">
        <button className="btn btn-sm" onClick={onNext} disabled={writing}><Plus /> Next character</button>
        {writing ? (
          <button className="btn btn-sm btn-primary" onClick={onStop}><Pause /> Stop</button>
        ) : (
          <button className="btn btn-sm btn-primary" onClick={onWrite}><PenLine /> Write 120</button>
        )}
      </div>
      {q && <p className="input-note">Writing uses the cut model, so you can hear what each head was doing.</p>}
    </div>
  )
}
