import { useEffect, useRef, useState } from 'react'
import { css, EMISSION_LINES, wavelengthRGB } from '../viz/spectrum'
import type { PrismReadout, PrismScene } from './prism'

interface Props {
  /** The element whose pointer steers the light (the whole hero). */
  trackRef: React.RefObject<HTMLElement | null>
  onReadout?: (r: PrismReadout) => void
}

/** Clicks on real controls shouldn't also fire a pass. */
const isControl = (t: EventTarget | null) => t instanceof Element && !!t.closest('a, button, label, input, textarea, select')

/**
 * Hosts the WebGL prism. three.js loads lazily, rendering pauses whenever the
 * hero is off-screen or the tab is hidden, and a static drawing stands in if
 * WebGL isn't available. A mouse steers the light by hovering; a tap moves it
 * and sends a pass; a click anywhere that isn't a control sends a pass too.
 */
export function PrismCanvas({ trackRef, onReadout }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readout = useRef(onReadout)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    readout.current = onReadout
  }, [onReadout])

  useEffect(() => {
    const canvas = canvasRef.current
    const track = trackRef.current
    if (!canvas || !track) return
    let scene: PrismScene | null = null
    let disposed = false
    const cleanups: (() => void)[] = []

    void import('./prism').then(({ PrismScene }) => {
      if (disposed) return
      try {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        scene = new PrismScene(canvas, { reducedMotion: reduced, onReadout: (r) => readout.current?.(r) })
      } catch {
        setFailed(true)
        return
      }
      const s = scene
      const fit = () => {
        const r = canvas.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) s.resize(r.width, r.height)
      }
      fit()
      const ro = new ResizeObserver(fit)
      ro.observe(canvas)
      cleanups.push(() => ro.disconnect())

      const at = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect()
        return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)] as const
      }
      const move = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return // touch: let the page scroll
        s.pointer(...at(e))
      }
      const down = (e: PointerEvent) => {
        if (isControl(e.target)) return
        s.pointer(...at(e))
        s.pulse()
      }
      track.addEventListener('pointermove', move)
      track.addEventListener('pointerdown', down)
      cleanups.push(() => {
        track.removeEventListener('pointermove', move)
        track.removeEventListener('pointerdown', down)
      })

      let onScreen = true
      const io = new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting
        s.setVisible(onScreen && !document.hidden)
      })
      io.observe(canvas)
      const vis = () => s.setVisible(onScreen && !document.hidden)
      document.addEventListener('visibilitychange', vis)
      cleanups.push(() => {
        io.disconnect()
        document.removeEventListener('visibilitychange', vis)
      })
      requestAnimationFrame(() => setReady(true))
    }, () => setFailed(true))

    return () => {
      disposed = true
      cleanups.forEach((c) => c())
      scene?.dispose()
    }
  }, [trackRef])

  return (
    <div className="prism" aria-hidden="true">
      {failed ? <StaticPrism /> : <canvas ref={canvasRef} className={ready ? 'is-ready' : ''} />}
    </div>
  )
}

/** Shown when WebGL is unavailable: the same twelve emission lines, drawn flat. */
function StaticPrism() {
  return (
    <svg className="prism-static" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
      {EMISSION_LINES.map((l, i) => (
        <path key={l.nm} d={`M455 330 L0 ${388 + i * 17}`} stroke={css(wavelengthRGB(l.nm))} strokeWidth="2" opacity={0.45 + 0.5 * l.intensity} />
      ))}
      <path d="M800 420 L560 300" stroke="#fff" strokeWidth="3" />
      <path d="M560 120 L700 400 L420 400 Z" fill="none" stroke="#d9d9d9" strokeWidth="2" />
    </svg>
  )
}
