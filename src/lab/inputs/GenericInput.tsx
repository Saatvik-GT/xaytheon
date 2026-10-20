import { useEffect, useState } from 'react'
import { Dices } from 'lucide-react'
import { ELEM_TYPE_NAMES, type ModelGraph } from '../../engine/graph'
import { concreteShape, randomTensor, type ort } from '../../engine/runtime'
import { PhotoInput } from './PhotoInput'

/** [1, C, H, W] float with 1 or 3 channels looks like an image. */
export function imageDims(model: ModelGraph): number[] | null {
  const i = model.inputs[0]
  if (!i) return null
  const d = concreteShape(i)
  return i.elemType === 1 && d.length === 4 && (d[1] === 1 || d[1] === 3) && d[2] >= 8 && d[3] >= 8 ? d : null
}

interface Props {
  model: ModelGraph
  onFeeds: (feeds: Record<string, ort.Tensor>) => void
}

/** For a model we know nothing about: an image picker when the input looks like one, seeded noise otherwise. */
export function GenericInput({ model, onFeeds }: Props) {
  const img = imageDims(model)
  const [mode, setMode] = useState<'image' | 'noise'>('noise')
  const [seed, setSeed] = useState(7)
  const [normalize, setNormalize] = useState(!!img && img[1] === 3)

  useEffect(() => {
    if (mode !== 'noise') return
    const feeds: Record<string, ort.Tensor> = {}
    model.inputs.forEach((i, k) => (feeds[i.name] = randomTensor(i, seed + k)))
    onFeeds(feeds)
  }, [mode, seed, model, onFeeds])

  return (
    <div className="generic">
      <dl className="io-list mono">
        {model.inputs.map((i) => (
          <div key={i.name}>
            <dt>{i.name}</dt>
            <dd>{ELEM_TYPE_NAMES[i.elemType] ?? `type ${i.elemType}`} [{(i.shape ?? []).join('×')}]</dd>
          </div>
        ))}
      </dl>
      {img && (
        <div className="seg" role="group" aria-label="Input source">
          <button aria-pressed={mode === 'image'} onClick={() => setMode('image')}>Image</button>
          <button aria-pressed={mode === 'noise'} onClick={() => setMode('noise')}>Noise</button>
        </div>
      )}
      {mode === 'image' && img ? (
        <>
          <PhotoInput key={String(normalize)} inputName={model.inputs[0].name} dims={img} normalize={normalize} onFeeds={onFeeds} />
          {img[1] === 3 && (
            <label className="toggle">
              <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} />
              <span>ImageNet mean/std normalisation</span>
            </label>
          )}
        </>
      ) : (
        <div className="noise">
          <p className="input-note">Seeded Gaussian noise for every input (integers 0–63 for int64 inputs). Same seed, same tensor.</p>
          <button className="btn btn-sm" onClick={() => setSeed((s) => s + 1)}>
            <Dices /> Reroll <span className="mono">seed {seed}</span>
          </button>
        </div>
      )}
    </div>
  )
}
