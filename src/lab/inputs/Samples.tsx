import { useEffect, useMemo, useRef } from 'react'
import { decodePixels } from '../../models/load'
import type { Sample } from '../../models/registry'

/** A 28x28 dataset image as a tiny canvas. */
export function SampleImage({ pixels, size = 28 }: { pixels: Float32Array; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(size, size)
    pixels.forEach((v, i) => img.data.set([v * 255, v * 255, v * 255, 255], i * 4))
    ctx.putImageData(img, 0, 0)
  }, [pixels, size])
  return <canvas ref={ref} width={size} height={size} className="heatmap" aria-hidden="true" />
}

interface Props {
  samples: Sample[]
  labels?: string[]
  selected?: number | null
  onPick: (pixels: Float32Array, index: number) => void
  caption: string
}

/** A strip (or grid) of real dataset images; picking one feeds it to the model. */
export function SampleGrid({ samples, labels, selected, onPick, caption }: Props) {
  const decoded = useMemo(() => samples.map((s) => decodePixels(s.pixels)), [samples])
  return (
    <div className="samples">
      <p className="samples-caption">{caption}</p>
      <div className="samples-grid" role="group" aria-label={caption}>
        {samples.map((s, i) => {
          const name = labels?.[s.label] ?? String(s.label)
          return (
            <button
              key={i}
              className={`sample${selected === i ? ' is-selected' : ''}`}
              aria-pressed={selected === i}
              aria-label={`Sample: ${name}`}
              title={name}
              onClick={() => onPick(decoded[i], i)}
            >
              <SampleImage pixels={decoded[i]} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
