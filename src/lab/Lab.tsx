import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CircleAlert, RotateCcw, Scissors } from 'lucide-react'
import { floatTensor, tokenTensor, type Activation } from '../engine/runtime'
import { softmax, type CuttableLayout } from '../engine/tensor'
import { custom, customEntry, modelById, type ModelEntry } from '../models/registry'
import type { AttentionFocus } from './AttentionView'
import { DrawPad, type DrawPadHandle } from './inputs/DrawPad'
import { GenericInput } from './inputs/GenericInput'
import { LatentInput } from './inputs/LatentInput'
import { PhotoInput } from './inputs/PhotoInput'
import { SampleGrid, SampleImage } from './inputs/Samples'
import { TextInput } from './inputs/TextInput'
import { Inspector } from './Inspector'
import { LabBar } from './LabBar'
import { LayerList } from './LayerList'
import { visibleLayers, type Layer } from './layers'
import { AutoOutput } from './outputs/AutoOutput'
import { ClassOutput } from './outputs/ClassOutput'
import { ImageOutput } from './outputs/ImageOutput'
import { lastRow, NextChar } from './outputs/NextChar'
import { Spectrum } from './Spectrum'
import { useLab } from './useLab'
import { decodePixels } from '../models/load'

interface Props {
  id: string
  onOpenFile: (f: File) => void
}

export default function Lab({ id, onOpenFile }: Props) {
  const version = custom.version
  const entry = useMemo(() => (id === 'custom' ? (custom.bytes ? customEntry() : null) : modelById(id) ?? null), [id, version]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!entry) {
    return (
      <div className="lab lab-missing">
        <h1>{id === 'custom' ? 'No model is open.' : `There’s no model called “${id}”.`}</h1>
        <p>{id === 'custom' ? 'Your own models live only in memory, so a reload clears them. Open the file again to keep going.' : 'Pick one of the built-in models, or open your own .onnx file.'}</p>
        <div className="closing-actions">
          <a className="btn" href="#/"><ArrowLeft /> All models</a>
          <label className="btn btn-primary">Open an .onnx file<input type="file" accept=".onnx" onChange={(e) => e.target.files?.[0] && onOpenFile(e.target.files[0])} /></label>
        </div>
      </div>
    )
  }
  return <LabView key={`${entry.id}-${version}`} entry={entry} onOpenFile={onOpenFile} />
}

const OPENING_LINE = 'ROMEO:\nBut soft, what light through yonder window breaks?\nIt is the east, and '
type Pane = 'input' | 'inspect' | 'layers'

function firstInteresting(layers: Layer[], entry: ModelEntry): string | null {
  const want = entry.output === 'nextchar' ? /^Softmax$/ : entry.output === 'image' ? /ConvTranspose/ : /^(Conv|Gemm|MatMul)$/
  return (layers.find((l) => want.test(l.node.opType)) ?? layers[0])?.tensor ?? null
}

function LabView({ entry, onOpenFile }: { entry: ModelEntry; onOpenFile: (f: File) => void }) {
  const lab = useLab(entry)
  const { loaded, xray, cutSets, totalCut } = lab
  const graph = loaded?.graph ?? null
  const meta = loaded?.meta
  const inputName = graph?.inputs[0]?.name ?? ''
  const outputName = graph?.outputs[0]?.name ?? ''

  const [showPlumbing, setShowPlumbing] = useState(false)
  const [selectedTensor, setSelectedTensor] = useState<string | null>(null)
  const [pane, setPane] = useState<Pane>('input')
  const [focus, setFocus] = useState<AttentionFocus | null>(null)
  const [attnHead, setAttnHead] = useState(0)

  const layers = useMemo(() => (graph ? visibleLayers(graph.nodes, xray.base, showPlumbing) : []), [graph, xray.base, showPlumbing])
  useEffect(() => {
    if (layers.length && (!selectedTensor || !layers.some((l) => l.tensor === selectedTensor))) setSelectedTensor(firstInteresting(layers, entry))
  }, [layers, selectedTensor, entry])
  const selected = Math.max(0, layers.findIndex((l) => l.tensor === selectedTensor))
  const layer = layers[selected]
  const select = useCallback((i: number) => {
    const l = layers[Math.max(0, Math.min(layers.length - 1, i))]
    if (l) setSelectedTensor(l.tensor)
  }, [layers])

  // ── Inputs that live in the lab (text, latent point, chosen sample) ──
  const [text, setText] = useState(OPENING_LINE)
  const [temperature, setTemperature] = useState(0.8)
  const [writing, setWriting] = useState(0)
  const [z, setZ] = useState<[number, number]>([0.5, -0.3])
  const [sample, setSample] = useState<number | null>(null)
  const pad = useRef<DrawPadHandle>(null)

  const vocab = meta?.vocab
  const context = meta?.context ?? 64
  const tokenInfo = useMemo(() => {
    if (!vocab) return null
    const index = new Map(vocab.map((c, i) => [c, i]))
    const kept = [...text].filter((c) => index.has(c))
    const ctx = kept.slice(-context)
    if (!ctx.length) ctx.push('\n')
    return { chars: ctx, ids: ctx.map((c) => index.get(c)!), dropped: [...text].length - kept.length }
  }, [text, vocab, context])

  const setFeeds = lab.setFeeds
  useEffect(() => {
    if (entry.inputs[0] === 'text' && tokenInfo && graph) setFeeds({ [inputName]: tokenTensor(tokenInfo.ids) })
  }, [tokenInfo, graph, inputName, entry, setFeeds])
  useEffect(() => {
    if (entry.inputs[0] === 'latent' && graph) setFeeds({ [inputName]: floatTensor(Float32Array.from(z), [1, 2]) })
  }, [z, graph, inputName, entry, setFeeds])
  // Sample-only models start on their first real test image.
  useEffect(() => {
    if (entry.inputs[0] === 'samples' && graph && meta?.samples?.length && sample === null) {
      setSample(0)
      setFeeds({ [inputName]: floatTensor(decodePixels(meta.samples[0].pixels), [1, 1, 28, 28]) })
    }
  }, [entry, graph, meta, sample, inputName, setFeeds])

  const feedImage = useCallback((px: Float32Array) => setFeeds({ [inputName]: floatTensor(px, [1, 1, 28, 28]) }), [inputName, setFeeds])

  // ── Writing with Bard: sample from the (cut, if any) model, append, wait for the next run ──
  const sampleNext = useCallback((logits: Activation) => {
    const p = softmax(lastRow(logits), temperature)
    let r = Math.random()
    let i = 0
    for (; i < p.length - 1; i++) {
      r -= p[i]
      if (r <= 0) break
    }
    setText((t) => t + vocab![i])
  }, [temperature, vocab])

  // Each run is consumed once: without this, the re-render that decrements `writing`
  // would sample again from the same logits and double every character.
  const consumed = useRef<unknown>(null)
  useEffect(() => {
    if (!writing || !xray.base || xray.feeds !== lab.feeds || consumed.current === xray) return
    const logits = (xray.cut ?? xray.base).get(outputName)
    if (!logits?.data) return
    consumed.current = xray
    sampleNext(logits)
    setWriting((n) => n - 1)
  }, [xray, writing, lab.feeds, outputName, sampleNext])

  // Hovering a character in the text asks the focused attention head what that character reads.
  const onHoverToken = (i: number | null) => {
    if (i === null || !layer || layer.node.opType !== 'Softmax') {
      if (i === null) setFocus(null)
      return
    }
    const act = (xray.cut ?? xray.base)?.get(layer.tensor)
    if (!act?.data) return
    const T = act.dims[2]
    if (i >= T) return
    const off = attnHead * T * T + i * T
    setFocus({ head: attnHead, query: i, weights: act.data.subarray(off, off + T) })
  }

  // ── Rendering ──
  const base = xray.base
  const outBase = base?.get(outputName)
  const outCut = xray.cut?.get(outputName) ?? null
  const status = lab.loadError ?? xray.error
  const loading = !graph && !lab.loadError
  const pct = lab.progress.total ? Math.min(100, (lab.progress.loaded / lab.progress.total) * 100) : 0

  const inputPanel = graph && (
    <>
      {entry.inputs[0] === 'draw' && (
        <>
          <DrawPad ref={pad} w={28} h={28} fit={entry.fit ?? 'mnist'} onChange={(px) => { setSample(null); feedImage(px) }} label={`Draw for ${entry.name}`} />
          {meta?.labels && entry.fit === 'quickdraw' && <p className="input-note">It knows: {meta.labels.join(', ')}.</p>}
        </>
      )}
      {entry.inputs[0] === 'samples' && meta?.samples && (
        <>
          {sample !== null && (
            <figure className="sample-hero">
              <SampleImage pixels={decodePixels(meta.samples[sample].pixels)} />
              <figcaption><span>{meta.labels?.[meta.samples[sample].label]}</span><span className="mono">true label</span></figcaption>
            </figure>
          )}
          <SampleGrid
            samples={meta.samples}
            labels={meta.labels}
            selected={sample}
            caption="Fashion-MNIST test images, three per class"
            onPick={(px, i) => {
              setSample(i)
              feedImage(px)
            }}
          />
        </>
      )}
      {entry.inputs[0] === 'photo' && (
        <PhotoInput inputName={inputName} dims={[1, 3, 224, 224]} normalize={entry.normalize === 'imagenet'} photos={meta?.photos} onFeeds={setFeeds} />
      )}
      {entry.inputs[0] === 'text' && tokenInfo && (
        <TextInput text={text} onText={(t) => { setWriting(0); setText(t) }} tokens={tokenInfo.chars} context={context} dropped={tokenInfo.dropped} focus={focus} onHoverToken={onHoverToken} />
      )}
      {entry.inputs[0] === 'latent' && meta?.points && <LatentInput points={meta.points} z={z} onZ={setZ} />}
      {entry.inputs[0] === 'generic' && <GenericInput model={graph} onFeeds={setFeeds} />}
    </>
  )

  // Dataset samples for drawing models sit below the prediction, so the verdict stays on screen.
  const extraPanel = graph && entry.inputs[0] === 'draw' && meta?.samples && (
    <SampleGrid
      samples={meta.samples}
      labels={meta.labels}
      selected={sample}
      caption={entry.fit === 'quickdraw' ? 'Or start from a real Quick, Draw! sketch' : 'Or start from a real MNIST test digit'}
      onPick={(px, i) => {
        pad.current?.show(px, 28, 28)
        setSample(i)
      }}
    />
  )

  const outputTitle = entry.output === 'nextchar' ? 'Next character' : entry.output === 'image' ? 'Decoded' : entry.output === 'classes' ? 'Prediction' : 'Output'
  const outputPanel = base && graph && (
    <>
      {entry.output === 'classes' && outBase?.data && <ClassOutput base={outBase} cut={outCut} labels={meta?.labels} top={5} />}
      {entry.output === 'nextchar' && outBase?.data && vocab && (
        <NextChar
          base={outBase}
          cut={outCut}
          vocab={vocab}
          temperature={temperature}
          onTemperature={setTemperature}
          writing={writing > 0}
          onNext={() => {
            const l = (xray.cut ?? xray.base)?.get(outputName)
            if (l) sampleNext(l)
          }}
          onWrite={() => setWriting(120)}
          onStop={() => setWriting(0)}
        />
      )}
      {entry.output === 'image' && outBase?.data && <ImageOutput base={outBase} cut={outCut} />}
      {entry.output === 'auto' && <AutoOutput model={graph} base={base} cut={xray.cut} />}
    </>
  )

  return (
    <div className="lab">
      <LabBar entry={entry} onOpenFile={onOpenFile} />

      <header className="lab-head">
        <div className="lab-id">
          <h1 className="lab-title">{entry.name}</h1>
          <p className="lab-sub">{entry.title}</p>
        </div>
        {graph && (
          <dl className="lab-facts">
            <div><dt>ops</dt><dd className="mono">{graph.nodes.length}</dd></div>
            <div><dt>params</dt><dd className="mono">{graph.totalParams.toLocaleString()}</dd></div>
            <div><dt>opset</dt><dd className="mono">{graph.opset || '—'}</dd></div>
            <div><dt>one pass</dt><dd className="mono">{xray.ms > 0 ? `${xray.ms.toFixed(1)} ms` : '—'}</dd></div>
          </dl>
        )}
        <div className={`lab-cuts${totalCut ? ' is-active' : ''}`} aria-live="polite">
          {totalCut > 0 ? (
            <>
              <Scissors aria-hidden="true" />
              <span><b className="mono">{totalCut}</b> unit{totalCut === 1 ? '' : 's'} cut in {lab.cuts.size} layer{lab.cuts.size === 1 ? '' : 's'}</span>
              <button className="btn btn-sm" onClick={() => lab.clearCuts()}><RotateCcw /> Restore all</button>
            </>
          ) : (
            <span className="lab-cuts-empty">Click any unit to cut it.</span>
          )}
        </div>
      </header>

      {loading && (
        <div className="lab-loading" role="status">
          <div className="progress"><span style={{ transform: `scaleX(${pct / 100})` }} /></div>
          <span className="mono">Loading {entry.name} · {(lab.progress.loaded / 1048576).toFixed(1)} / {((lab.progress.total || entry.sizeKB * 1024) / 1048576).toFixed(1)} MB</span>
        </div>
      )}
      {status && <div className="lab-error" role="alert"><CircleAlert aria-hidden="true" /><span>{status}</span></div>}

      {base && layers.length > 0 && (
        <div className="lab-spectrum">
          <Spectrum layers={layers} base={base} cut={xray.cut} cuts={cutSets} selected={selected} onSelect={select} height={52} />
        </div>
      )}

      {graph && (
        <>
          <div className="lab-tabs seg" role="tablist" aria-label="Lab panels">
            {(['input', 'inspect', 'layers'] as const).map((p) => (
              <button key={p} role="tab" aria-selected={pane === p} onClick={() => setPane(p)}>
                {p === 'input' ? 'Input & output' : p === 'inspect' ? 'Inspect' : 'Layers'}
              </button>
            ))}
          </div>
          <main className="lab-main" data-pane={pane}>
            <aside className="lab-col lab-col-input" aria-label="Input and output">
              <section className="pane">
                <div className="pane-head"><h2 className="pane-title">Input</h2></div>
                {inputPanel}
              </section>
              <section className="pane">
                <div className="pane-head"><h2 className="pane-title">{outputTitle}</h2></div>
                {outputPanel || <p className="input-note">{xray.status === 'compiling' ? 'Starting the runtime…' : 'Give the model an input.'}</p>}
              </section>
              {extraPanel && <section className="pane">{extraPanel}</section>}
            </aside>

            <div className="lab-col lab-col-inspect">
              {layer && base?.get(layer.tensor) ? (
                <Inspector
                  model={graph}
                  layer={layer}
                  count={layers.length}
                  base={base.get(layer.tensor)!}
                  cut={xray.cut?.get(layer.tensor) ?? null}
                  cutUnits={cutSets.get(layer.tensor) ?? new Set()}
                  onToggle={(u, l: CuttableLayout) => lab.toggleCut(layer.tensor, u, l)}
                  onSetCut={(us, l) => lab.setCut(layer.tensor, us, l)}
                  onStep={(d) => select(selected + d)}
                  tokens={tokenInfo?.chars.map((c) => (c === ' ' ? '␣' : c === '\n' ? '↵' : c))}
                  focus={focus}
                  onFocus={setFocus}
                  attnHead={attnHead}
                  onAttnHead={setAttnHead}
                />
              ) : (
                <div className="inspector inspector-empty">
                  <p>{xray.status === 'compiling' ? 'Starting the runtime…' : 'Give the model an input to light it up.'}</p>
                </div>
              )}
            </div>

            <aside className="lab-col lab-col-layers" aria-label="Layers">
              {base && (
                <LayerList
                  layers={layers}
                  base={base}
                  cut={xray.cut}
                  cuts={cutSets}
                  selected={selected}
                  onSelect={(i) => {
                    select(i)
                    if (window.matchMedia('(max-width: 900px)').matches) setPane('inspect')
                  }}
                  showPlumbing={showPlumbing}
                  onTogglePlumbing={() => setShowPlumbing((v) => !v)}
                />
              )}
            </aside>
          </main>
        </>
      )}
    </div>
  )
}
