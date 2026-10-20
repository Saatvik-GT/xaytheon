import { ArrowRight } from 'lucide-react'
import { assetUrl } from '../models/load'
import { MODELS } from '../models/registry'
import { labHref } from '../router'
import { css, layerHue } from '../viz/spectrum'

const size = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`)

/** The real pretrained model leads, wide; the rest follow in a single grid. */
const ORDER = ['vision', 'digits', 'doodles', 'wardrobe', 'bard', 'latent']

export function Gallery({ onOpenFile }: { onOpenFile: (f: File) => void }) {
  const models = ORDER.map((id) => MODELS.find((m) => m.id === id)!).filter(Boolean)
  return (
    <section className="section gallery" id="models" aria-labelledby="models-title">
      <div className="gallery-head">
        <h2 id="models-title" className="section-title">Six models to take apart.</h2>
        <p className="gallery-lead">
          Trained or exported by the scripts in this repository and small enough to load in seconds.
          Every picture is the model’s own activations on a real input.
        </p>
      </div>
      <ul className="gallery-grid">
        {models.map((m, i) => (
          <li key={m.id} className={i === 0 ? 'is-featured' : undefined}>
            <a className="model-card" href={labHref(m.id)}>
              <span className="model-thumb">
                <picture>
                  {i === 0 && m.thumbWide && <source media="(min-width: 721px)" srcSet={assetUrl(m.thumbWide)} />}
                  <img src={assetUrl(m.thumb)} alt="" loading="lazy" width={480} height={300} />
                </picture>
              </span>
              <span className="model-body">
                <span className="model-name">{m.name}{i === 0 && <ArrowRight className="model-go" aria-hidden="true" />}</span>
                <span className="model-title">{m.title}</span>
                <span className="model-blurb">{m.blurb}</span>
                <span className="model-meta mono">{[m.family, ...m.facts, size(m.sizeKB)].join(' · ')}</span>
              </span>
            </a>
          </li>
        ))}
        <li>
          <label className="model-card own-card">
            <span className="model-thumb own-thumb">
              <DropArt />
            </span>
            <span className="model-body">
              <span className="model-name">Your model</span>
              <span className="model-title">Any .onnx file</span>
              <span className="model-blurb">
                Drop it anywhere on the page, or choose it here. It is parsed and run in this tab and never uploaded.
              </span>
              <span className="btn btn-sm own-btn">Choose a file</span>
            </span>
            <input type="file" accept=".onnx" className="sr-only" onChange={(e) => e.target.files?.[0] && onOpenFile(e.target.files[0])} />
          </label>
        </li>
      </ul>
    </section>
  )
}

/** Your model as the prism: a beam enters the file and leaves as a spectrum. */
function DropArt() {
  const rays = Array.from({ length: 9 }, (_, i) => i)
  return (
    <svg viewBox="0 0 480 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="drop-beam" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>
      <path d="M0 160 L176 150" stroke="url(#drop-beam)" strokeWidth="2.5" strokeLinecap="round" />
      {rays.map((i) => (
        <path key={i} d={`M300 150 L480 ${108 + i * 12}`} stroke={css(layerHue(i, rays.length))} strokeWidth="1.6" strokeOpacity="0.85" />
      ))}
      <path d="M182 72h76l38 38v116a6 6 0 0 1-6 6H182a6 6 0 0 1-6-6V78a6 6 0 0 1 6-6Z" fill="#050505" stroke="#6b6b6b" strokeWidth="1.2" strokeDasharray="5 5" />
      <path d="M258 72v32a6 6 0 0 0 6 6h32" fill="none" stroke="#6b6b6b" strokeWidth="1.2" />
      <text x="236" y="176" textAnchor="middle" fill="#ededed" fontFamily="var(--mono)" fontSize="16">.onnx</text>
    </svg>
  )
}
