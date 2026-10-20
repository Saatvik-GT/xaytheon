import { useEffect, useRef } from 'react'
import { paint, rampFor, type RGB } from './spectrum'

interface Props {
  data: Float32Array
  offset?: number
  w: number
  h: number
  /** Magnitude shown at full brightness. */
  scale: number
  hue: RGB
  className?: string
  label?: string
}

/** One activation map, painted pixel-exact; CSS scales it up with crisp edges. */
export function Heatmap({ data, offset = 0, w, h, scale, hue, className, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(w, h)
    paint(img, data, offset, scale, rampFor(hue))
    ctx.putImageData(img, 0, 0)
  }, [data, offset, w, h, scale, hue])
  return <canvas ref={ref} width={w} height={h} className={`heatmap ${className ?? ''}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
}
