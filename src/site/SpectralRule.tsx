import { useEffect, useRef, useState } from 'react'
import { css, EMISSION_LINES, wavelengthRGB } from '../viz/spectrum'

/**
 * The hero's light, landed on the page: the same twelve emission lines the
 * prism splits its beam into, laid flat from red (input) to violet (output).
 * They light up once, in order, as they come into view: a forward pass.
 */
export function SpectralRule({ caption }: { caption?: [string, string] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div className={`spectral-rule${on ? ' is-on' : ''}`} ref={ref} aria-hidden="true">
      <div className="spectral-track">
        {EMISSION_LINES.map((l, i) => {
          const c = css(wavelengthRGB(l.nm))
          return (
            <i
              key={l.nm}
              style={{
                left: `${((700 - l.nm) / 300) * 100}%`,
                height: `${10 + l.intensity * 16}px`,
                background: c,
                boxShadow: `0 0 ${6 + l.intensity * 10}px ${c}`,
                animationDelay: `${i * 70}ms`,
              }}
            />
          )
        })}
      </div>
      {caption && (
        <div className="spectral-caption mono">
          <span>{caption[0]}</span>
          <span>{caption[1]}</span>
        </div>
      )}
    </div>
  )
}
