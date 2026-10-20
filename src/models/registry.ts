/** The built-in models. Every number here comes from the training/export scripts' logs. */

export type InputKind = 'draw' | 'samples' | 'photo' | 'text' | 'latent' | 'generic'
export type OutputKind = 'classes' | 'nextchar' | 'image' | 'auto'

export interface Sample {
  label: number
  pixels: string // base64, 28x28 uint8
}

export interface ModelMeta {
  labels?: string[]
  samples?: Sample[]
  vocab?: string[]
  context?: number
  accuracy?: number
  points?: [number, number, number][]
  credit?: string
  top1?: number
  photos?: { file: string; name: string; credit: string }[]
}

export interface ModelEntry {
  id: string
  name: string
  /** What it is, in the field's own words. */
  title: string
  blurb: string
  family: string
  facts: string[]
  url: string
  meta?: string
  inputs: InputKind[]
  output: OutputKind
  /** How a drawing is framed before it's fed in (matches each dataset's own preprocessing). */
  fit?: 'mnist' | 'quickdraw'
  normalize?: 'imagenet'
  sizeKB: number
  thumb: string
  /** A wider image for the featured gallery card. */
  thumbWide?: string
}

export const MODELS: ModelEntry[] = [
  {
    id: 'digits',
    name: 'Digits',
    title: 'MNIST digit classifier',
    blurb: 'Draw a digit and watch 8, then 16 feature maps light up on the way to a verdict.',
    family: 'CNN',
    facts: ['52,138 params', '97.9% test accuracy'],
    url: 'models/mnist-cnn.onnx',
    meta: 'models/mnist-samples.json',
    inputs: ['draw', 'samples'],
    output: 'classes',
    fit: 'mnist',
    sizeKB: 205,
    thumb: 'cards/digits.png',
  },
  {
    id: 'doodles',
    name: 'Doodles',
    title: 'Quick, Draw! sketch classifier',
    blurb: 'Ten categories of 30-second sketches. Draw a cat, a clock or an umbrella.',
    family: 'CNN',
    facts: ['98,442 params', '96.7% held-out accuracy'],
    url: 'models/doodle-cnn.onnx',
    meta: 'models/doodle-meta.json',
    inputs: ['draw', 'samples'],
    output: 'classes',
    fit: 'quickdraw',
    sizeKB: 386,
    thumb: 'cards/doodles.png',
  },
  {
    id: 'wardrobe',
    name: 'Wardrobe',
    title: 'Fashion-MNIST classifier',
    blurb: 'Real test images of shirts, sneakers and bags. Find the channel that knows a heel.',
    family: 'CNN',
    facts: ['156,394 params', '89.7% test accuracy'],
    url: 'models/fashion-cnn.onnx',
    meta: 'models/fashion-samples.json',
    inputs: ['samples'],
    output: 'classes',
    sizeKB: 612,
    thumb: 'cards/wardrobe.png',
  },
  {
    id: 'vision',
    name: 'Vision',
    title: 'SqueezeNet 1.1, ImageNet',
    blurb: 'A real pretrained network with 1,000 ImageNet classes. Feed it a sample photo, your own image or your webcam, then open any of its 65 ops and cut the channels that see whiskers.',
    family: 'CNN',
    facts: ['1,235,496 params', '58.2% ImageNet top-1'],
    url: 'models/squeezenet.onnx',
    meta: 'models/squeezenet-meta.json',
    inputs: ['photo'],
    output: 'classes',
    normalize: 'imagenet',
    sizeKB: 4842,
    thumb: 'cards/vision.png',
    thumbWide: 'cards/vision-wide.png',
  },
  {
    id: 'bard',
    name: 'Bard',
    title: 'Character-level transformer',
    blurb: 'Three layers, twelve attention heads, trained on Shakespeare. Cut a head and watch it misspell.',
    family: 'Transformer',
    facts: ['3 layers × 4 heads', 'Tiny Shakespeare'],
    url: 'models/bard-gpt.onnx',
    meta: 'models/bard-meta.json',
    inputs: ['text'],
    output: 'nextchar',
    sizeKB: 1432,
    thumb: 'cards/bard.png',
  },
  {
    id: 'latent',
    name: 'Latent',
    title: 'Variational autoencoder, 2-D latent',
    blurb: 'A decoder that draws digits from two numbers. Drag through its latent space.',
    family: 'VAE decoder',
    facts: ['219,585 params', '2-D latent, MNIST'],
    url: 'models/latent-decoder.onnx',
    meta: 'models/latent-map.json',
    inputs: ['latent'],
    output: 'image',
    sizeKB: 859,
    thumb: 'cards/latent.png',
  },
]

export const modelById = (id: string) => MODELS.find((m) => m.id === id)

/** A model the user brought. Lives in memory only, never uploaded or stored. */
export const custom: { name: string; bytes: Uint8Array | null; version: number } = { name: '', bytes: null, version: 0 }

export function customEntry(): ModelEntry {
  return {
    id: 'custom',
    name: custom.name.replace(/\.onnx$/i, '') || 'Your model',
    title: 'Your model',
    blurb: '',
    family: 'ONNX',
    facts: [],
    url: '',
    inputs: ['generic'],
    output: 'auto',
    sizeKB: Math.round((custom.bytes?.length ?? 0) / 1024),
    thumb: '',
  }
}
