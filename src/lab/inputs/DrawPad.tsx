import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Eraser, Undo2 } from 'lucide-react'

const PAD = 320

export interface DrawPadHandle {
  /** Show a 28x28 image (a dataset sample) on the pad as if it had been drawn. */
  show: (pixels: Float32Array, w: number, h: number) => void
  clear: () => void
}

interface Props {
  w: number
  h: number
  /**
   * How a stroke is framed before it reaches the model, matching each
   * dataset's own preprocessing:
   *  - mnist:     bounding box fit into 20 px, centred in 28 px
   *  - quickdraw: bounding box scaled to fill the frame, top-left aligned
   */
  fit: 'mnist' | 'quickdraw'
  onChange: (pixels: Float32Array) => void
  label?: string
  ref?: React.Ref<DrawPadHandle>
}

type Stroke = [number, number][]

export function DrawPad({ w, h, fit, onChange, label = 'Drawing pad', ref }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const preview = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const drawing = useRef(false)
  const [count, setCount] = useState(0)
  const brush = fit === 'quickdraw' ? 14 : 24

  const ctx = () => canvas.current!.getContext('2d', { willReadFrequently: true })!

  const redraw = useCallback(() => {
    const c = ctx()
    c.fillStyle = '#000'
    c.fillRect(0, 0, PAD, PAD)
    c.strokeStyle = '#fff'
    c.lineWidth = brush
    c.lineCap = 'round'
    c.lineJoin = 'round'
    for (const s of strokes.current) {
      c.beginPath()
      c.moveTo(...s[0])
      for (const p of s.slice(1)) c.lineTo(...p)
      if (s.length === 1) c.lineTo(s[0][0] + 0.1, s[0][1])
      c.stroke()
    }
  }, [brush])

  /** Downsample what's on the pad into the model's input, exactly as the dataset framed it. */
  const emit = useCallback(() => {
    const src = ctx().getImageData(0, 0, PAD, PAD).data
    let x0 = PAD, y0 = PAD, x1 = -1, y1 = -1
    for (let y = 0; y < PAD; y += 2)
      for (let x = 0; x < PAD; x += 2)
        if (src[(y * PAD + x) * 4] > 24) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    const out = preview.current!
    const o = out.getContext('2d', { willReadFrequently: true })!
    o.fillStyle = '#000'
    o.fillRect(0, 0, w, h)
    if (x1 >= 0) {
      x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2)
      const bw = Math.min(PAD, x1 + 3) - x0, bh = Math.min(PAD, y1 + 3) - y0
      o.imageSmoothingEnabled = true
      o.imageSmoothingQuality = 'high'
      if (fit === 'mnist') {
        const box = Math.round(Math.min(w, h) * (20 / 28))
        const s = box / Math.max(bw, bh)
        o.drawImage(canvas.current!, x0, y0, bw, bh, (w - bw * s) / 2, (h - bh * s) / 2, bw * s, bh * s)
      } else {
        const s = (Math.min(w, h) - 1) / Math.max(bw, bh)
        o.drawImage(canvas.current!, x0, y0, bw, bh, 0, 0, bw * s, bh * s)
      }
    }
    const px = o.getImageData(0, 0, w, h).data
    onChange(Float32Array.from({ length: w * h }, (_, i) => px[i * 4] / 255))
  }, [fit, w, h, onChange])

  const clear = useCallback(() => {
    strokes.current = []
    setCount(0)
    redraw()
    emit()
  }, [redraw, emit])

  useImperativeHandle(ref, () => ({
    clear,
    show: (pixels, sw, sh) => {
      strokes.current = []
      setCount(0)
      // Paint the sample big on the pad and straight into the preview.
      const tmp = document.createElement('canvas')
      tmp.width = sw
      tmp.height = sh
      const t = tmp.getContext('2d')!
      const img = t.createImageData(sw, sh)
      pixels.forEach((v, i) => img.data.set([v * 255, v * 255, v * 255, 255], i * 4))
      t.putImageData(img, 0, 0)
      const c = ctx()
      c.imageSmoothingEnabled = true
      c.drawImage(tmp, 0, 0, PAD, PAD)
      const o = preview.current!.getContext('2d')!
      o.putImageData(img, 0, 0)
      onChange(pixels)
    },
  }), [clear, onChange])

  useEffect(() => {
    redraw()
    emit()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * PAD, ((e.clientY - r.top) / r.height) * PAD]
  }

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    strokes.current.push([pos(e)])
    setCount(strokes.current.length)
    redraw()
    emit()
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const s = strokes.current[strokes.current.length - 1]
    // Coalesced events keep fast strokes smooth.
    const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent]
    const r = canvas.current!.getBoundingClientRect()
    for (const ev of evs) s.push([((ev.clientX - r.left) / r.width) * PAD, ((ev.clientY - r.top) / r.height) * PAD])
    redraw()
    emit()
  }
  const up = () => (drawing.current = false)

  const undo = () => {
    strokes.current.pop()
    setCount(strokes.current.length)
    redraw()
    emit()
  }

  return (
    <div className="drawpad">
      <canvas
        ref={canvas}
        width={PAD}
        height={PAD}
        className="drawpad-canvas"
        aria-label={label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <figure className="drawpad-preview" title="What the model receives">
        <canvas ref={preview} width={w} height={h} />
        <figcaption className="mono">{w}×{h}</figcaption>
      </figure>
      <div className="drawpad-tools">
        <button className="btn btn-sm btn-icon" onClick={undo} disabled={count === 0} aria-label="Undo last stroke" title="Undo">
          <Undo2 />
        </button>
        <button className="btn btn-sm" onClick={clear} aria-label="Clear the pad">
          <Eraser /> Clear
        </button>
      </div>
    </div>
  )
}
