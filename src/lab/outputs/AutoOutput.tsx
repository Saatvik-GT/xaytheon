import type { ModelGraph } from '../../engine/graph'
import type { Activations } from '../../engine/runtime'
import { layoutOf, stats } from '../../engine/tensor'
import { fmt, shapeText } from '../layers'
import { ClassOutput } from './ClassOutput'

/** For a model we know nothing about: class bars if the output looks like logits, a readout otherwise. */
export function AutoOutput({ model, base, cut }: { model: ModelGraph; base: Activations; cut: Activations | null }) {
  const name = model.outputs[0]?.name
  const out = name ? base.get(name) : undefined
  if (!out) return <p className="input-note">This model’s output isn’t a tensor Xaytheon can read.</p>
  const l = out.data ? layoutOf(out) : null
  if (out.data && l?.kind === 'vector' && l.units >= 2 && l.units <= 1000) {
    return (
      <>
        <ClassOutput base={out} cut={cut?.get(name) ?? null} />
        <p className="input-note">Read as logits over {l.units} classes, labelled by index.</p>
      </>
    )
  }
  const s = out.data ? stats(out.data) : null
  return (
    <dl className="io-list mono">
      <div><dt>{name}</dt><dd>{out.type} {shapeText(out.dims)}</dd></div>
      {s && <div><dt>range</dt><dd>{fmt(s.min)} to {fmt(s.max)}</dd></div>}
      {s && <div><dt>mean</dt><dd>{fmt(s.mean)}</dd></div>}
    </dl>
  )
}
