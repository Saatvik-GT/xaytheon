import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { css, layerHue } from '../../viz/spectrum'

interface Props {
  points: [number, number, number][]
  z: [number, number]
  onZ: (z: [number, number]) => void
}

const SIZE = 320

/**
 * The decoder's whole input space. Each dot is a real test digit, placed by
 * the encoder and coloured by its true label; drag the crosshair anywhere.
 */
export function LatentInput({ points, z, onZ }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [touring, setTouring] = useState(false)
  const dragging = useRef(false)

  const bounds = useMemo(() => {
    let m = 0
    for (const [x, y] of points) m = Math.max(m, Math.abs(x), Math.abs(y))
    return Math.min(4, Math.ceil(Math.max(2, m) * 2) / 2)
  }, [points])
  const toPx = (v: number) => ((v + bounds) / (2 * bounds)) * SIZE
  const fromPx = (p: number) => (p / SIZE) * 2 * bounds - bounds

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = SIZE * dpr
    c.height = SIZE * dpr
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.strokeStyle = 'rgb(255 255 255 / 0.08)'
    ctx.lineWidth = 1
    for (let v = -Math.floor(bounds); v <= bounds; v++) {
      ctx.beginPath()
      ctx.moveTo(toPx(v) + 0.5, 0)
      ctx.lineTo(toPx(v) + 0.5, SIZE)
      ctx.moveTo(0, SIZE - toPx(v) + 0.5)
      ctx.lineTo(SIZE, SIZE - toPx(v) + 0.5)
      ctx.stroke()
    }
    const hues = Array.from({ length: 10 }, (_, i) => css(layerHue(i, 10), 0.7))
    for (const [x, y, label] of points) {
      ctx.fillStyle = hues[label]
      ctx.fillRect(toPx(x) - 1, SIZE - toPx(y) - 1, 2, 2)
    }
  }, [points, bounds]) // eslint-disable-line react-hooks/exhaustive-deps

  const nearest = useMemo(() => {
    const d = points.map(([x, y, l]) => [(x - z[0]) ** 2 + (y - z[1]) ** 2, l] as const).sort((a, b) => a[0] - b[0]).slice(0, 9)
    const votes = new Array(10).fill(0)
    for (const [, l] of d) votes[l]++
    return votes.indexOf(Math.max(...votes))
  }, [points, z])

  const set = useCallback((x: number, y: number) => {
    const c = (v: number) => Math.max(-bounds, Math.min(bounds, v))
    onZ([Math.round(c(x) * 1000) / 1000, Math.round(c(y) * 1000) / 1000])
  }, [bounds, onZ])

  const fromEvent = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    set(fromPx(((e.clientX - r.left) / r.width) * SIZE), fromPx(SIZE - ((e.clientY - r.top) / r.height) * SIZE))
  }

  // Tour: a slow Lissajous loop through the space; every frame re-runs the decoder.
  useEffect(() => {
    if (!touring) return
    let raf = 0
    const t0 = performance.now()
    const tick = () => {
      const t = (performance.now() - t0) / 1000
      set(Math.sin(t * 0.55) * bounds * 0.72, Math.sin(t * 0.37 + 1) * bounds * 0.72)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [touring, bounds, set])

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.25 : 0.05
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    const v = d[e.key]
    if (!v) return
    e.preventDefault()
    setTouring(false)
    set(z[0] + v[0], z[1] + v[1])
  }

  return (
    <div className="latent">
      <div
        className="latent-pad"
        role="slider"
        tabIndex={0}
        aria-label="Latent point. Arrow keys move it, Shift for bigger steps"
        aria-valuetext={`z = ${z[0].toFixed(2)}, ${z[1].toFixed(2)}`}
        onKeyDown={onKey}
      >
        <canvas
          ref={canvas}
          style={{ width: '100%', aspectRatio: '1' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            dragging.current = true
            setTouring(false)
            fromEvent(e)
          }}
          onPointerMove={(e) => dragging.current && fromEvent(e)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        />
        <span className="latent-cross" style={{ left: `${(toPx(z[0]) / SIZE) * 100}%`, top: `${100 - (toPx(z[1]) / SIZE) * 100}%` }} aria-hidden="true" />
      </div>
      <div className="latent-bar">
        <span className="mono latent-z">z = ({z[0].toFixed(2).replace('-', '−')}, {z[1].toFixed(2).replace('-', '−')})</span>
        <span className="latent-near" title="Most common label among the 9 nearest test digits">neighbours: <b>{nearest}</b></span>
        <button className="btn btn-sm" onClick={() => setTouring((v) => !v)} aria-pressed={touring}>
          {touring ? <><Pause /> Stop</> : <><Play /> Tour</>}
        </button>
      </div>
      <ol className="latent-legend" aria-label="Dot colours by digit">
        {Array.from({ length: 10 }, (_, i) => (
          <li key={i}><i style={{ background: css(layerHue(i, 10)) }} />{i}</li>
        ))}
      </ol>
    </div>
  )
}
