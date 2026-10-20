import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Scissors } from 'lucide-react'
import { floatTensor } from '../engine/runtime'
import { layoutOf, robustScale, unitNoun, unitStrength, type CuttableLayout } from '../engine/tensor'
import { DrawPad, type DrawPadHandle } from '../lab/inputs/DrawPad'
import { visibleLayers, shapeText } from '../lab/layers'
import { ClassOutput } from '../lab/outputs/ClassOutput'
import { Spectrum } from '../lab/Spectrum'
import { useLab } from '../lab/useLab'
import { decodePixels } from '../models/load'
import { modelById } from '../models/registry'
import { labHref } from '../router'
import { css } from '../viz/spectrum'
import { Heatmap } from '../viz/Heatmap'
import { SpectralRule } from './SpectralRule'

const DIGITS = modelById('digits')!
// A real MNIST test "7" (mnist-samples.json #14). Cutting the four strongest
// channels of conv2 turns it into a 3, which makes a good first experiment.
const OPENING_SAMPLE = 14
const OPENING_LAYER = '/conv2/Conv'

/**
 * The real MNIST model, running on the page. Loads only when scrolled near,
 * so the hero never waits on the runtime.
 */
export function LiveDemo() {
  const section = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = section.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section className="section demo" id="demo" ref={section} aria-labelledby="demo-title">
      <SpectralRule caption={['input', 'output']} />
      <h2 id="demo-title" className="section-title">Every layer, one pass.</h2>
      <p className="section-lead">
        Xaytheon rewrites the model so a single forward pass returns every intermediate tensor.
        This is a real CNN running on your device: draw over the digit, click a feature map to cut it,
        and watch the layers below it drift.
      </p>
      {near ? <DemoBench /> : <div className="demo-card demo-placeholder" />}
    </section>
  )
}

function DemoBench() {
  const lab = useLab(DIGITS)
  const { loaded, xray, cutSets, totalCut } = lab
  const pad = useRef<DrawPadHandle>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const layers = useMemo(() => (loaded ? visibleLayers(loaded.graph.nodes, xray.base, false) : []), [loaded, xray.base])

  // Open on a real digit, already lit, with conv2 in view.
  useEffect(() => {
    const s = loaded?.meta.samples?.[OPENING_SAMPLE]
    if (s && pad.current) pad.current.show(decodePixels(s.pixels), 28, 28)
  }, [loaded])
  const index = selected ?? Math.max(0, layers.findIndex((l) => l.node.name === OPENING_LAYER))

  const layer = layers[index]
  const act = layer ? xray.base?.get(layer.tensor) : undefined
  const shownAct = layer ? (xray.cut ?? xray.base)?.get(layer.tensor) : undefined
  const layout = act ? layoutOf(act, layer!.node.opType) : null
  const logits = loaded ? xray.base?.get(loaded.graph.outputs[0].name) : undefined
  const cutLogits = loaded ? xray.cut?.get(loaded.graph.outputs[0].name) ?? null : null
  const scale = act?.data ? robustScale(act.data) : 1
  const strength = act && layout ? unitStrength(act, layout) : null
  const k = layout && layout.kind !== 'grid' ? Math.max(1, Math.round(layout.units / 4)) : 0

  const cutStrongest = () => {
    if (!layer || !strength || !layout || layout.kind === 'grid') return
    const top = [...strength.keys()].sort((a, b) => strength[b] - strength[a]).slice(0, k)
    lab.setCut(layer.tensor, top, layout as CuttableLayout)
  }

  return (
    <div className="demo-card">
      <div className="card-bar">
        <span className="mono">mnist-cnn.onnx</span>
        <span className="mono card-bar-meta">
          {loaded ? `${loaded.graph.nodes.length} ops · ${loaded.graph.totalParams.toLocaleString()} params` : 'loading…'}
          {xray.ms > 0 && ` · ${xray.ms.toFixed(1)} ms`}
        </span>
      </div>
      <div className="demo-body">
        <div className="demo-input">
          <DrawPad ref={pad} w={28} h={28} fit="mnist" onChange={(px) => lab.setFeeds({ image: floatTensor(px, [1, 1, 28, 28]) })} label="Draw a digit" />
        </div>
        <div className="demo-readout">
          {xray.base && layers.length > 0 && layer ? (
            <>
              <Spectrum layers={layers} base={xray.base} cut={xray.cut} cuts={cutSets} selected={index} onSelect={setSelected} height={44} showDrift />
              <div className="demo-layer">
                <div className="demo-layer-head">
                  <span className="op-chip mono" style={{ '--hue': css(layer.hue) } as React.CSSProperties}>{layer.node.opType}</span>
                  <span className="mono demo-layer-name">{layer.node.name}</span>
                  <span className="mono dim">{act && shapeText(act.dims)}</span>
                </div>
                {layout?.kind === 'maps' && shownAct?.data ? (
                  <div className="demo-maps" role="group" aria-label="Feature maps" style={{ '--cols': layout.units <= 8 ? 4 : 8 } as React.CSSProperties}>
                    {Array.from({ length: layout.units }, (_, c) => {
                      const isCut = cutSets.get(layer.tensor)?.has(c)
                      return (
                        <button
                          key={c}
                          className={`map-tile${isCut ? ' is-cut' : ''}`}
                          aria-pressed={!!isCut}
                          aria-label={`Channel ${c}${isCut ? ', cut' : ''}. Mean activation ${strength?.[c].toFixed(3)}`}
                          onClick={() => lab.toggleCut(layer.tensor, c, layout as CuttableLayout)}
                        >
                          <Heatmap data={shownAct.data!} offset={c * layout.h * layout.w} w={layout.w} h={layout.h} scale={scale} hue={layer.hue} />
                          <span className="map-index mono">{c}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="demo-hint">This layer is a vector. Pick a convolution band in the spectrum to see its feature maps.</p>
                )}
              </div>
            </>
          ) : (
            <div className="demo-loading">{lab.loadError ?? xray.error ?? 'Starting the runtime…'}</div>
          )}
        </div>
        <div className="demo-output">
          {logits?.data ? <ClassOutput base={logits} cut={cutLogits} labels={loaded?.meta.labels} top={4} /> : <div className="demo-loading" />}
        </div>
      </div>
      <div className="card-bar card-bar-foot">
        <span>{totalCut > 0 ? `${totalCut} unit${totalCut === 1 ? '' : 's'} cut` : 'Nothing cut yet'}</span>
        <span className="card-bar-actions">
          {totalCut > 0 ? (
            <button className="btn btn-sm btn-quiet" onClick={() => lab.clearCuts()}>
              <RotateCcw /> Restore
            </button>
          ) : (
            layout && layout.kind !== 'grid' && (
              <button className="btn btn-sm" onClick={cutStrongest}>
                <Scissors /> Cut the {k} strongest {unitNoun(layout, k)}
              </button>
            )
          )}
          <a className="btn btn-sm" href={labHref('digits')}>Open in the lab <ArrowRight /></a>
        </span>
      </div>
    </div>
  )
}
