/**
 * The visible spectrum is Xaytheon's only colour: a layer's hue is the
 * wavelength it would land on if the network were a prism, red for the first
 * layer, violet for the last. Everything else is black, white and grey.
 */

export type RGB = [number, number, number] // 0..1

/** Approximate sRGB of a wavelength in nm (after Dan Bruton), gamma-corrected. */
export function wavelengthRGB(nm: number): RGB {
  let r = 0, g = 0, b = 0
  if (nm < 440) { r = -(nm - 440) / 60; b = 1 }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1 }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20 }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1 }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65 }
  else r = 1
  let k = 1
  if (nm < 420) k = 0.35 + (0.65 * (nm - 380)) / 40
  else if (nm > 700) k = 0.35 + (0.65 * (780 - nm)) / 80
  const gamma = (c: number) => (c <= 0 ? 0 : Math.pow(c * k, 0.8))
  return [gamma(r), gamma(g), gamma(b)]
}

const RED = 680
const VIOLET = 415

/** Wavelength for position t in [0, 1] along the network (0 = input side). */
export const layerWavelength = (t: number) => RED - Math.min(1, Math.max(0, t)) * (RED - VIOLET)

export function layerHue(index: number, count: number): RGB {
  return wavelengthRGB(layerWavelength(count <= 1 ? 0 : index / (count - 1)))
}

/**
 * Xaytheon's emission spectrum: twelve lines at irregular wavelengths and
 * strengths, red (input side) to violet (output side). The hero prism splits
 * its beam into exactly these lines, and the spectral rule draws them flat.
 */
export const EMISSION_LINES: { nm: number; intensity: number }[] = [
  { nm: 668, intensity: 0.5 },
  { nm: 656, intensity: 1 },
  { nm: 615, intensity: 0.55 },
  { nm: 589, intensity: 0.95 },
  { nm: 570, intensity: 0.5 },
  { nm: 546, intensity: 0.9 },
  { nm: 518, intensity: 0.6 },
  { nm: 501, intensity: 0.75 },
  { nm: 486, intensity: 0.85 },
  { nm: 458, intensity: 0.55 },
  { nm: 434, intensity: 0.75 },
  { nm: 416, intensity: 0.5 },
]

export const css = ([r, g, b]: RGB, a = 1) =>
  a === 1 ? `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})` : `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${a})`

/**
 * Emission ramp: black -> the hue -> white-hot. Activation is light, so a unit
 * that fires harder glows brighter and finally saturates to white.
 */
export function emit(hue: RGB, t: number): RGB {
  const x = Math.min(1, Math.max(0, t))
  if (x < 0.62) {
    const k = x / 0.62
    const e = k * k * (3 - 2 * k) * 0.92 + k * 0.08
    return [hue[0] * e, hue[1] * e, hue[2] * e]
  }
  const w = (x - 0.62) / 0.38
  return [hue[0] + (1 - hue[0]) * w, hue[1] + (1 - hue[1]) * w, hue[2] + (1 - hue[2]) * w]
}

/**
 * What negative values look like: the layer's own hue, mostly greyed out and
 * never reaching white. Sign stays readable without borrowing another
 * layer's colour, so hue keeps meaning only "where in the network".
 */
export function shade(hue: RGB): RGB {
  const grey = 0.3 * hue[0] + 0.59 * hue[1] + 0.11 * hue[2]
  const g = Math.max(0.45, grey)
  return [(hue[0] * 0.18 + g * 0.82) * 0.62, (hue[1] * 0.18 + g * 0.82) * 0.62, (hue[2] * 0.18 + g * 0.82) * 0.66]
}

/** Negative ramp: black up to the shade, never white-hot. */
export const emitNegative = (hue: RGB, t: number): RGB => {
  const s = shade(hue)
  const x = Math.min(1, Math.max(0, t))
  const e = x * x * (3 - 2 * x) * 0.85 + x * 0.15
  return [s[0] * e, s[1] * e, s[2] * e]
}

/** 256-entry lookup tables, so painting a big tensor is a table read per pixel. */
export interface Ramp {
  pos: Uint8ClampedArray // 256 * 3
  neg: Uint8ClampedArray
}

const ramps = new Map<string, Ramp>()

export function rampFor(hue: RGB): Ramp {
  const key = hue.map((v) => v.toFixed(3)).join()
  let r = ramps.get(key)
  if (r) return r
  const pos = new Uint8ClampedArray(256 * 3)
  const neg = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const p = emit(hue, i / 255)
    const n = emitNegative(hue, i / 255)
    pos.set([p[0] * 255, p[1] * 255, p[2] * 255], i * 3)
    neg.set([n[0] * 255, n[1] * 255, n[2] * 255], i * 3)
  }
  r = { pos, neg }
  ramps.set(key, r)
  return r
}

/**
 * Paint `w*h` values (from `offset`) into an ImageData. Values are scaled by
 * `scale` (the largest magnitude to show at full brightness); negatives show
 * as a grey shade of the same hue.
 */
export function paint(img: ImageData, values: Float32Array, offset: number, scale: number, ramp: Ramp) {
  const px = img.data
  const n = img.width * img.height
  const k = 255 / (scale || 1)
  for (let i = 0; i < n; i++) {
    const v = values[offset + i]
    const lut = v < 0 ? ramp.neg : ramp.pos
    const j = Number.isFinite(v) ? Math.min(255, Math.round((v < 0 ? -v : v) * k)) * 3 : 0
    const o = i * 4
    px[o] = lut[j]
    px[o + 1] = lut[j + 1]
    px[o + 2] = lut[j + 2]
    px[o + 3] = 255
  }
}
