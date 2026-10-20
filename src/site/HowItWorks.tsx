import { useState } from 'react'

type Step = 'instrument' | 'cut' | 'measure'

interface Line {
  op: string
  name: string
  io: string
  /** Which steps this line belongs to (highlighted when that step is active). */
  steps?: Step[]
  added?: boolean
}

const BEFORE: Line[] = [
  { op: 'Conv', name: '/conv1/Conv', io: 'image → conv1_out' },
  { op: 'Relu', name: '/Relu', io: 'conv1_out → relu1_out' },
  { op: 'MaxPool', name: '/MaxPool', io: 'relu1_out → pool1_out' },
  { op: '⋯', name: '6 more nodes', io: '' },
  { op: 'Gemm', name: '/fc2/Gemm', io: 'relu3_out → logits' },
  { op: 'output', name: 'logits', io: '[1×10]' },
]

const AFTER: Line[] = [
  { op: 'Conv', name: '/conv1/Conv', io: 'image → conv1_out__xay_pre', steps: ['cut'] },
  { op: 'Mul', name: 'xaytheon_cut_conv1_out', io: 'conv1_out__xay_pre × mask → conv1_out', steps: ['cut'], added: true },
  { op: 'Relu', name: '/Relu', io: 'conv1_out → relu1_out', steps: ['measure'] },
  { op: 'MaxPool', name: '/MaxPool', io: 'relu1_out → pool1_out', steps: ['measure'] },
  { op: '⋯', name: '6 more nodes', io: '', steps: ['measure'] },
  { op: 'Gemm', name: '/fc2/Gemm', io: 'relu3_out → logits', steps: ['measure'] },
  { op: 'output', name: 'logits', io: '[1×10]' },
  { op: 'output', name: '+ 9 more', io: 'conv1_out, relu1_out, pool1_out, …', steps: ['instrument'], added: true },
  { op: 'mask', name: 'conv1_out__xay_mask', io: '[1×8×1×1] = 1 1 0 1 1 0 1 1', steps: ['cut'], added: true },
]

const STEPS: { key: Step; title: string; body: string }[] = [
  {
    key: 'instrument',
    title: 'Instrument',
    body: 'An ONNX model only hands back its final outputs. Xaytheon appends every node’s output to the graph’s output list, so one session.run returns all of them: ten tensors from a single pass of this model.',
  },
  {
    key: 'cut',
    title: 'Cut',
    body: 'To cut channels 2 and 5, the producer’s output is renamed and a Mul against a mask is spliced in under the original name. Every consumer downstream now reads the cut tensor. Nothing else in the file changes.',
  },
  {
    key: 'measure',
    title: 'Measure',
    body: 'The original and the cut model run on the same input. Each layer below the cut reports how far it drifted, Δ = ‖a′ − a‖ / ‖a‖, and the spectrum shows the loss as dark absorption lines.',
  },
]

export function HowItWorks() {
  const [step, setStep] = useState<Step>('cut')
  const [file, setFile] = useState<'before' | 'after'>('after')
  const lines = file === 'before' ? BEFORE : AFTER

  return (
    <section className="section how" id="how" aria-labelledby="how-title">
      <div className="how-copy">
        <h2 id="how-title" className="section-title">Cut a neuron. Watch the damage spread.</h2>
        <p className="how-lead">
          Surgery is a graph rewrite, not a re-implementation. The model you load is the model that runs:
          Xaytheon edits its ONNX graph in place and lets the runtime do the rest.
        </p>
        <ol className="how-steps" role="tablist" aria-label="Steps" aria-orientation="vertical">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button
                role="tab"
                aria-selected={step === s.key}
                className="how-step"
                onClick={() => {
                  setStep(s.key)
                  setFile('after')
                }}
              >
                <span className="how-step-n mono" aria-hidden="true">{i + 1}</span>
                <span className="how-step-title">{s.title}</span>
              </button>
              {step === s.key && <p className="how-step-body">{s.body}</p>}
            </li>
          ))}
        </ol>
      </div>

      <div className="how-card">
        <div className="file-tabs" role="tablist" aria-label="Graph">
          {(['before', 'after'] as const).map((f) => (
            <button key={f} role="tab" aria-selected={file === f} className="mono" onClick={() => setFile(f)}>
              {f}.onnx
            </button>
          ))}
        </div>
        <ol className="graph-lines" aria-label={`${file} graph`}>
          {lines.map((l, i) => {
            const lit = file === 'after' && l.steps?.includes(step)
            return (
              <li key={i} className={`${lit ? 'is-lit' : ''}${l.added && file === 'after' ? ' is-added' : ''}`}>
                <span className="gl-mark mono" aria-hidden="true">{l.added && file === 'after' ? '+' : ''}</span>
                <span className="gl-op mono">{l.op}</span>
                <span className="gl-name mono">{l.name}</span>
                <span className="gl-io mono">{l.io}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
