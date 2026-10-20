import { useEffect, useRef } from 'react'
import type { Activation } from '../../engine/runtime'

function Picture({ act, label }: { act: Activation; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [, , h, w] = act.dims
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx || !act.data) return
    const img = ctx.createImageData(w, h)
    for (let i = 0; i < w * h; i++) {
      const v = Math.max(0, Math.min(1, act.data[i])) * 255
      img.data.set([v, v, v, 255], i * 4)
    }
    ctx.putImageData(img, 0, 0)
  }, [act, w, h])
  return (
    <figure className="decoded">
      <canvas ref={ref} width={w} height={h} className="heatmap" role="img" aria-label={label} />
      <figcaption>{label}</figcaption>
    </figure>
  )
}

/** The decoder's drawing; with surgery, the original and the cut model side by side. */
export function ImageOutput({ base, cut }: { base: Activation; cut: Activation | null }) {
  return (
    <div className={`decoded-pair${cut ? ' is-pair' : ''}`}>
      <Picture act={base} label={cut ? 'Original' : 'Decoded image'} />
      {cut && <Picture act={cut} label="After surgery" />}
    </div>
  )
}
