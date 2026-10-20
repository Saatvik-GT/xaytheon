import { useCallback, useRef, useState } from 'react'
import { ArrowRight, FileUp } from 'lucide-react'
import { labHref } from '../router'
import { GitHubIcon, Mark, REPO } from '../ui/Mark'
import { Gallery } from './Gallery'
import { HowItWorks } from './HowItWorks'
import { LiveDemo } from './LiveDemo'
import type { PrismReadout } from './prism'
import { PrismCanvas } from './PrismCanvas'

interface Props {
  onOpenFile: (f: File) => void
}

const scrollTo = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const deg = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}°`)

export function Landing({ onOpenFile }: Props) {
  const hero = useRef<HTMLElement>(null)
  const [optics, setOptics] = useState<PrismReadout | null>(null)
  const onReadout = useCallback((r: PrismReadout) => setOptics(r), [])

  return (
    <div className="site">
      <nav className="site-nav" aria-label="Main">
        <a className="brand" href="#/" aria-label="Xaytheon home">
          <Mark />
          <span className="brand-name">Xaytheon</span>
        </a>
        <div className="site-links">
          <a href="#models" onClick={scrollTo('models')}>Models</a>
          <a href="#how" onClick={scrollTo('how')}>How it works</a>
        </div>
        <div className="site-actions">
          <a className="btn btn-sm btn-quiet btn-icon" href={REPO} aria-label="Xaytheon on GitHub"><GitHubIcon /></a>
          <a className="btn btn-sm" href={labHref('digits')}>Open lab</a>
        </div>
      </nav>

      <header className="hero" ref={hero}>
        <PrismCanvas trackRef={hero} onReadout={onReadout} />
        <div className="hero-copy">
          <h1 className="wordmark">Xaytheon</h1>
          <p className="hero-line">An X-ray for<br />neural networks.</p>
          <p className="hero-lead">
            Open any ONNX model in your browser, watch every layer respond to your input,
            and cut neurons to see what breaks.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary btn-lg" href={labHref('digits')}>
              Open the lab <ArrowRight />
            </a>
            <label className="btn btn-lg">
              <FileUp /> Bring your own .onnx
              <input type="file" accept=".onnx" onChange={(e) => e.target.files?.[0] && onOpenFile(e.target.files[0])} />
            </label>
          </div>
        </div>
        <div className="hero-readout" aria-hidden="true">
          <span className="readout-hint">Move the light. Click to send a pass.</span>
          <span className="readout-tap">Tap to move the light and send a pass.</span>
          <dl className="readout-values mono">
            <div><dt>incidence</dt><dd>{deg(optics?.incidence)}</dd></div>
            <div><dt>deviation</dt><dd>{deg(optics?.deviation)}</dd></div>
            <div><dt>lines</dt><dd>{optics ? `${optics.lines}/12` : '—'}</dd></div>
          </dl>
        </div>
      </header>

      <main>
        <LiveDemo />
        <HowItWorks />
        <Gallery onOpenFile={onOpenFile} />

        <section className="section private" aria-labelledby="private-title">
          <div className="private-copy">
            <h2 id="private-title" className="section-title">Nothing leaves your device.</h2>
            <p className="section-lead">
              Models are parsed, rewritten and run in WebAssembly inside this tab. There is no server to send them to,
              no account and no storage. Close the tab and your model is gone.
            </p>
          </div>
          <dl className="specs">
            <div><dt>Runtime</dt><dd className="mono">onnxruntime-web 1.30, WebAssembly</dd></div>
            <div><dt>Format</dt><dd className="mono">.onnx, weights embedded</dd></div>
            <div><dt>Uploads</dt><dd className="mono">none</dd></div>
            <div><dt>Storage</dt><dd className="mono">none</dd></div>
            <div><dt>Source</dt><dd className="mono"><a href={REPO}>github.com/Saatvik-GT/xaytheon</a></dd></div>
          </dl>
        </section>

        <section className="section closing" aria-labelledby="closing-title">
          <h2 id="closing-title" className="section-title">Open a model and cut something.</h2>
          <div className="closing-actions">
            <a className="btn btn-primary btn-lg" href={labHref('digits')}>Open the lab <ArrowRight /></a>
            <label className="btn btn-lg">
              <FileUp /> Bring your own .onnx
              <input type="file" accept=".onnx" onChange={(e) => e.target.files?.[0] && onOpenFile(e.target.files[0])} />
            </label>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="footer-brand" href="#/" aria-label="Xaytheon home"><Mark /> Xaytheon</a>
        <p className="footer-note">MIT licensed. Built with onnxruntime-web and three.js.</p>
        <a className="footer-link" href={REPO}><GitHubIcon /> Source</a>
      </footer>
    </div>
  )
}
