import type { AttentionFocus } from '../AttentionView'

interface Props {
  text: string
  onText: (t: string) => void
  /** The characters actually fed to the model (the last `context`, in vocabulary). */
  tokens: string[]
  context: number
  dropped: number
  focus: AttentionFocus | null
  onHoverToken: (i: number | null) => void
}

export const visible = (c: string) => (c === ' ' ? '␣' : c === '\n' ? '↵' : c)

/** Text in, characters out; when a head is focused, each character glows by how much it's being read. */
export function TextInput({ text, onText, tokens, context, dropped, focus, onHoverToken }: Props) {
  let max = 0
  if (focus) for (const w of focus.weights) if (w > max) max = w
  return (
    <div className="text-input">
      <label className="field-label" htmlFor="bard-text">Prompt</label>
      <textarea
        id="bard-text"
        className="text-area mono"
        value={text}
        spellCheck={false}
        rows={4}
        onChange={(e) => onText(e.target.value)}
      />
      <div className="token-head">
        <span className="field-label">What the model reads</span>
        <span className="mono token-count">{tokens.length}/{context} chars</span>
      </div>
      <ol className="token-strip mono" aria-label="Characters fed to the model" onPointerLeave={() => onHoverToken(null)}>
        {tokens.map((c, i) => {
          const w = focus && i < focus.weights.length ? focus.weights[i] / (max || 1) : 0
          const isQuery = focus?.query === i
          return (
            <li
              key={i}
              className={`token${isQuery ? ' is-query' : ''}${c === ' ' || c === '\n' ? ' is-space' : ''}`}
              style={focus ? { background: `rgb(255 255 255 / ${(w * 0.85).toFixed(3)})`, color: w > 0.5 ? '#000' : undefined } : undefined}
              onPointerEnter={() => onHoverToken(i)}
              title={`${i}: ${JSON.stringify(c)}`}
            >
              {visible(c)}
            </li>
          )
        })}
      </ol>
      <p className="input-note">
        {focus
          ? `Brightness shows how much character ${focus.query} attends to each earlier one in head ${focus.head}.`
          : 'Pick an attention layer, then hover a character to see what it reads.'}
        {dropped > 0 && ` ${dropped} character${dropped === 1 ? '' : 's'} outside the vocabulary were skipped.`}
      </p>
    </div>
  )
}
