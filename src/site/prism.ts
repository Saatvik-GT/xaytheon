import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { EMISSION_LINES, wavelengthRGB } from '../viz/spectrum'

/**
 * Xaytheon's prism: a laminated glass block that reads light the way the lab
 * reads a network.
 *
 * The light rides an arc on the right of the glass and your pointer's height
 * steers it, on a critically damped spring, so it glides and never snaps. The
 * beam is traced through the glass per wavelength (Snell's law, Cauchy
 * dispersion), and every surface splits it by a softened Fresnel reflectance,
 * so lines fade in and out smoothly as total internal reflection takes over.
 *
 * The light is an emission spectrum, twelve lines, so it leaves the glass as
 * separate lines rather than a rainbow. Inside, nine layers of the laminate
 * light up in their layer colour where the beam crosses them, and a pulse (a
 * forward pass) runs input to output every few seconds or on click.
 *
 * The glass is rendered in two passes: everything behind the front surface
 * goes into a buffer, then the front surface refracts it. Back faces use total
 * internal reflection, which is what makes the edges read as thick glass.
 */

type V2 = [number, number]

const BACK = 0 // layer drawn into the refraction buffer
const FRONT = 1 // layer drawn only in the final pass
const LAYERS = 9 // laminate planes inside the glass
const PULSE_SPEED = 13 // scene units per second
const PULSE_EVERY = 7 // seconds between automatic passes
const FAN_LENGTH = 34
const MAX_RIBBONS = 200

// Cauchy dispersion, exaggerated from crown glass so the lines separate visibly.
const cauchy = (nm: number) => 1.48 + 0.046 / Math.pow(nm / 1000, 2)

const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1]
const add = (a: V2, b: V2, k = 1): V2 => [a[0] + b[0] * k, a[1] + b[1] * k]
const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]]
const len = (a: V2) => Math.hypot(a[0], a[1])
const norm = (a: V2): V2 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function refract(i: V2, n: V2, eta: number): V2 | null {
  const cosi = -dot(n, i)
  const k = 1 - eta * eta * (1 - cosi * cosi)
  if (k < 0) return null
  return norm(add([i[0] * eta, i[1] * eta], n, eta * cosi - Math.sqrt(k)))
}

const reflect = (i: V2, n: V2): V2 => add(i, n, -2 * dot(i, n))

/** Unpolarised Fresnel reflectance from index n1 into n2; 1 past the critical angle. */
function fresnel(cosi: number, n1: number, n2: number): number {
  const c = Math.abs(cosi)
  const sint = (n1 / n2) * Math.sqrt(Math.max(0, 1 - c * c))
  if (sint >= 1) return 1
  const cost = Math.sqrt(1 - sint * sint)
  const rs = (n1 * c - n2 * cost) / (n1 * c + n2 * cost)
  const rp = (n1 * cost - n2 * c) / (n1 * cost + n2 * c)
  return (rs * rs + rp * rp) / 2
}

/**
 * Fresnel averaged over a few degrees of incidence. A real beam has width, so a
 * line crossing the critical angle fades over a couple of degrees instead of
 * switching off between two frames.
 */
function fresnelSoft(cosi: number, n1: number, n2: number): number {
  const a = Math.acos(Math.min(1, Math.abs(cosi)))
  let sum = 0
  for (const d of [-0.05, -0.025, 0, 0.025, 0.05]) sum += fresnel(Math.cos(clamp(a + d, 0, Math.PI / 2)), n1, n2)
  return sum / 5
}

/** One step of a critically damped spring (implicit, stable at any dt). Returns [value, velocity]. */
function spring(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  const f = 1 + 2 * dt * omega
  const hoo = dt * omega * omega
  const hhoo = dt * hoo
  const inv = 1 / (f + hhoo)
  return [(f * x + dt * v + hhoo * target) * inv, (v + hoo * (target - x)) * inv]
}

interface Face { a: V2; b: V2; n: V2 }

function faces(side: number): Face[] {
  const R = side / Math.sqrt(3)
  const r = R / 2
  const T: V2 = [0, R], BL: V2 = [-side / 2, -r], BR: V2 = [side / 2, -r]
  return ([[BR, T], [T, BL], [BL, BR]] as [V2, V2][]).map(([a, b]) => ({ a, b, n: norm([b[1] - a[1], -(b[0] - a[0])]) }))
}

function hit(p: V2, d: V2, fs: Face[], skip = -1): { t: number; face: number; at: V2 } | null {
  let best: { t: number; face: number; at: V2 } | null = null
  fs.forEach((f, i) => {
    if (i === skip) return
    const e: V2 = [f.b[0] - f.a[0], f.b[1] - f.a[1]]
    const den = d[0] * e[1] - d[1] * e[0]
    if (Math.abs(den) < 1e-9) return
    const w: V2 = [f.a[0] - p[0], f.a[1] - p[1]]
    const t = (w[0] * e[1] - w[1] * e[0]) / den
    const s = (w[0] * d[1] - w[1] * d[0]) / den
    if (t > 1e-6 && s >= 0 && s <= 1 && (!best || t < best.t)) best = { t, face: i, at: add(p, d, t) }
  })
  return best
}

/** A drawn piece of the light path, with its path distance from the source (for the pulse). */
interface Seg { a: V2; b: V2; s0: number; s1: number; w: number; line: number }
/** Light leaving the glass. */
interface Out { at: V2; dir: V2; s0: number; w: number; line: number }

interface Trace {
  source: V2
  dir: V2
  entry: V2
  entryFace: number
  entryS: number
  incidence: number
  reflectance: number
  inside: Seg[]
  outs: Out[]
  /** The middle line's first internal leg: drives the laminate glow and the readout. */
  midExit: V2 | null
  midLen: number
  deviation: number | null
}

const MID = EMISSION_LINES.reduce((best, l, i) => (Math.abs(l.nm - 546) < Math.abs(EMISSION_LINES[best].nm - 546) ? i : best), 0)

function traceLight(fs: Face[], source: V2, aim: V2): Trace | null {
  const dir = norm(sub(aim, source))
  const first = hit(source, dir, fs)
  if (!first) return null
  const face = fs[first.face]
  const cosi = -dot(dir, face.n)
  const entryS = len(sub(first.at, source))
  const inside: Seg[] = []
  const outs: Out[] = []
  let midExit: V2 | null = null
  let midLen = 0
  let deviation: number | null = null
  let reflectance = 0

  EMISSION_LINES.forEach((line, k) => {
    const n = cauchy(line.nm)
    const r0 = fresnelSoft(cosi, 1, n)
    reflectance += r0 / EMISSION_LINES.length
    const d0 = refract(dir, face.n, 1 / n)
    if (!d0) return
    // Follow the light inside, splitting it at every surface into transmitted and reflected parts.
    const walk = (p: V2, d: V2, from: number, w: number, s: number, depth: number) => {
      const h = hit(p, d, fs, from)
      if (!h) return
      inside.push({ a: p, b: h.at, s0: s, s1: s + h.t, w, line: k })
      const nOut = fs[h.face].n
      const R = fresnelSoft(dot(d, nOut), n, 1)
      const out = refract(d, [-nOut[0], -nOut[1]], n)
      if (out && w * (1 - R) > 0.004) {
        outs.push({ at: h.at, dir: out, s0: s + h.t, w: w * (1 - R), line: k })
        if (k === MID && depth === 0) {
          midExit = h.at
          deviation = Math.acos(clamp(dot(dir, out), -1, 1))
        }
      }
      if (k === MID && depth === 0) {
        midLen = h.t
        if (!midExit) midExit = h.at
      }
      if (w * R > 0.02 && depth < 2) walk(h.at, reflect(d, nOut), h.face, w * R, s + h.t, depth + 1)
    }
    walk(first.at, d0, first.face, 1 - r0, entryS, 0)
  })

  // If the 546 nm line reflected inside before leaving, read its deviation off the path it did take.
  if (deviation === null) {
    const best = outs.filter((o) => o.line === MID).sort((a, b) => b.w - a.w)[0]
    if (best) deviation = Math.acos(clamp(dot(dir, best.dir), -1, 1))
  }

  return { source, dir, entry: first.at, entryFace: first.face, entryS, incidence: Math.acos(clamp(cosi, -1, 1)), reflectance, inside, outs, midExit, midLen, deviation }
}

// Line colours, balanced so all twelve together sum to white.
const LINE_COLORS: THREE.Color[] = (() => {
  const raw = EMISSION_LINES.map((l) => wavelengthRGB(l.nm).map((c) => c * l.intensity))
  const sum = raw.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0])
  return raw.map((c) => new THREE.Color(c[0] / sum[0], c[1] / sum[1], c[2] / sum[2]))
})()

/**
 * Preallocated geometry for beams and glows, rewritten in place each time the
 * light moves. Allocating fresh GPU buffers every frame is what makes motion hitch.
 */
class RibbonBuffer {
  readonly geometry = new THREE.BufferGeometry()
  private count = 0
  private readonly pos: Float32Array
  private readonly uv: Float32Array
  private readonly col: Float32Array
  private readonly gain: Float32Array
  private readonly s: Float32Array
  private readonly delay: Float32Array
  private readonly fade: Float32Array

  constructor(maxQuads: number) {
    const n = maxQuads * 6
    const attr = (name: string, size: number) => {
      const a = new THREE.BufferAttribute(new Float32Array(n * size), size)
      a.setUsage(THREE.DynamicDrawUsage)
      this.geometry.setAttribute(name, a)
      return a.array as Float32Array
    }
    this.pos = attr('position', 3)
    this.uv = attr('aUv', 2)
    this.col = attr('aColor', 3)
    this.gain = attr('aGain', 1)
    this.s = attr('aS', 1)
    this.delay = attr('aDelay', 1)
    this.fade = attr('aFade', 1)
    this.geometry.setDrawRange(0, 0)
  }

  reset() {
    this.count = 0
  }

  vertex(x: number, y: number, u: number, v: number, c: THREE.Color, gain: number, s: number, delay: number, fade: number) {
    if (this.count >= this.pos.length / 3) return
    const i = this.count++
    this.pos[i * 3] = x
    this.pos[i * 3 + 1] = y
    this.pos[i * 3 + 2] = 0
    this.uv[i * 2] = u
    this.uv[i * 2 + 1] = v
    this.col[i * 3] = c.r
    this.col[i * 3 + 1] = c.g
    this.col[i * 3 + 2] = c.b
    this.gain[i] = gain
    this.s[i] = s
    this.delay[i] = delay
    this.fade[i] = fade
  }

  commit() {
    for (const name of ['position', 'aUv', 'aColor', 'aGain', 'aS', 'aDelay', 'aFade']) this.geometry.getAttribute(name).needsUpdate = true
    this.geometry.setDrawRange(0, this.count)
  }
}

const RIBBON_VERT = /* glsl */ `
  attribute vec2 aUv;
  attribute vec3 aColor;
  attribute float aGain;
  attribute float aS;
  attribute float aDelay;
  attribute float aFade;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vGain;
  varying float vS;
  varying float vDelay;
  varying float vFade;
  void main() {
    vUv = aUv; vColor = aColor; vGain = aGain; vS = aS; vDelay = aDelay; vFade = aFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

// A beam: a hot core in a soft body. Lines leaving the glass fade with distance and
// lift as they separate; the pulse is a bright packet travelling along the path.
const RIBBON_FRAG = /* glsl */ `
  uniform float uSpread;
  uniform float uPulse;
  uniform float uPulseGain;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vGain;
  varying float vS;
  varying float vDelay;
  varying float vFade;
  void main() {
    float x = vUv.x;
    float core = exp(-x * x * 11.0);
    float body = exp(-x * x * 2.2) * 0.24;
    float along = smoothstep(0.0, 0.012, vUv.y) * mix(1.0, pow(1.0 - vUv.y, 1.35), vFade);
    float vivid = 1.0 + uSpread * smoothstep(0.0, 0.3, vUv.y);
    float d = (vS - (uPulse - vDelay)) / 0.9;
    float pulse = uPulseGain * exp(-d * d);
    gl_FragColor = vec4(vColor * (core + body) * along * vGain * vivid * (1.0 + pulse), 1.0);
  }`

const GLOW_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vGain;
  void main() {
    float d = length(vUv);
    gl_FragColor = vec4(vColor * vGain * (exp(-d * d * 6.0) + exp(-d * d * 48.0) * 1.6), 1.0);
  }`

const DUST_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixel;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixel;
    vAlpha = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aPhase * 7.13)) + aPhase * 6.283);
    vColor = aColor;
  }`

const DUST_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.25, 0.0, dot(c, c));
    gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
  }`

const GLASS_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vNormalL;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vNormalL = normal;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`

// Shared lighting: a dark studio seen in the glass's reflections (soft strips,
// small hard lights for glints, a dim wall behind that only internally
// reflected light can see) and the beam's light scattered where it meets the glass.
const GLASS_COMMON = /* glsl */ `
  uniform vec2 uEntry;
  uniform vec2 uExit;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vNormalL;
  varying vec3 vLocal;
  vec3 studio(vec3 r) {
    float top = smoothstep(0.35, 0.9, r.y) * 1.7;
    float left = smoothstep(0.4, 0.92, -r.x) * 1.35;
    float right = smoothstep(0.4, 0.92, r.x) * 1.15;
    float floorBounce = smoothstep(0.4, 0.92, -r.y) * 0.75;
    float glintA = pow(max(dot(r, normalize(vec3(-0.62, 0.62, 0.48))), 0.0), 150.0) * 32.0;
    float glintB = pow(max(dot(r, normalize(vec3(0.7, -0.38, 0.6))), 0.0), 150.0) * 22.0;
    float glintC = pow(max(dot(r, normalize(vec3(0.05, 0.85, 0.52))), 0.0), 150.0) * 18.0;
    float key = pow(max(dot(r, normalize(vec3(-0.5, 0.42, 0.76))), 0.0), 60.0) * 2.4;
    float backWall = smoothstep(0.2, 0.98, -r.z) * 0.3;
    return vec3(top + left + right + floorBounce + backWall) + vec3(glintA + glintB + glintC + key);
  }
  float fresnelS(vec3 n, vec3 v) {
    return 0.04 + 0.96 * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
  }
  float scatter() {
    float a = length(vLocal.xy - uEntry);
    float b = length(vLocal.xy - uExit);
    return exp(-a * a / 0.22) + exp(-b * b / 0.32) * 0.6;
  }
  vec3 wavelength(float nm) {
    vec3 c;
    if (nm < 440.0) c = vec3(-(nm - 440.0) / 60.0, 0.0, 1.0);
    else if (nm < 490.0) c = vec3(0.0, (nm - 440.0) / 50.0, 1.0);
    else if (nm < 510.0) c = vec3(0.0, 1.0, -(nm - 510.0) / 20.0);
    else if (nm < 580.0) c = vec3((nm - 510.0) / 70.0, 1.0, 0.0);
    else if (nm < 645.0) c = vec3(1.0, -(nm - 645.0) / 65.0, 0.0);
    else c = vec3(1.0, 0.0, 0.0);
    float k = nm < 420.0 ? 0.35 + 0.65 * (nm - 380.0) / 40.0 : 1.0;
    return pow(clamp(c * k, 0.0, 1.0), vec3(0.8));
  }`

const GLASS_BACK_FRAG = /* glsl */ `
  ${GLASS_COMMON}
  void main() {
    // Seen from inside the glass: past the critical angle a surface reflects everything.
    vec3 N = -normalize(vNormal);
    vec3 I = -normalize(cameraPosition - vWorld);
    float cosi = abs(dot(I, N));
    float sint = 1.5 * sqrt(max(0.0, 1.0 - cosi * cosi));
    float partial = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
    float reflectance = sint >= 1.0 ? 1.0 : mix(partial, 1.0, smoothstep(0.8, 1.0, sint));
    vec3 R = reflect(I, N);
    vec3 c = studio(R) * reflectance * 0.42 + vec3(1.0, 0.98, 0.96) * scatter() * (0.05 + reflectance * 0.35);
    gl_FragColor = vec4(c, 1.0);
  }`

const GLASS_FRONT_FRAG = /* glsl */ `
  uniform sampler2D uBack;
  uniform vec2 uRes;
  uniform float uSpan;
  uniform float uPulseIn;
  ${GLASS_COMMON}
  void main() {
    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 I = -V;
    float F = fresnelS(N, V);
    vec2 uv = gl_FragCoord.xy / uRes;
    float k = 0.075;
    vec3 tr = refract(I, N, 1.0 / 1.46);
    vec3 tg = refract(I, N, 1.0 / 1.50);
    vec3 tb = refract(I, N, 1.0 / 1.55);
    vec3 behind = vec3(
      texture2D(uBack, uv + (tr.xy - I.xy) * k).r,
      texture2D(uBack, uv + (tg.xy - I.xy) * k).g,
      texture2D(uBack, uv + (tb.xy - I.xy) * k).b);
    vec3 c = behind * 0.84 * (1.0 - F) + studio(reflect(I, N)) * F + vec3(1.0, 0.98, 0.96) * scatter() * (0.03 + F * 1.6);

    // The laminate: ${LAYERS} thin layers inside the glass. Where the beam crosses one it
    // lights up in that layer's colour (input red to output violet), and it flares when a pass goes by.
    if (vNormalL.z > 0.5) {
      float spacing = uSpan / ${LAYERS + 1}.0;
      float j = floor((vLocal.x + uSpan * 0.5) / spacing + 0.5);
      float xPlane = -uSpan * 0.5 + j * spacing;
      float onPlane = exp(-pow((vLocal.x - xPlane) / 0.013, 2.0));
      vec2 ab = uExit - uEntry;
      float tt = clamp(dot(vLocal.xy - uEntry, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
      float nearBeam = exp(-pow(length(vLocal.xy - (uEntry + ab * tt)) / 0.16, 2.0));
      float tPlane = clamp((xPlane - uEntry.x) / (abs(ab.x) > 1e-3 ? ab.x : 1e-3), 0.0, 1.0);
      float flash = uPulseIn >= 0.0 ? exp(-pow((tPlane - uPulseIn) / 0.09, 2.0)) * 3.0 : 0.0;
      float real = step(0.5, j) * step(j, ${LAYERS}.5);
      c += wavelength(680.0 - tPlane * 265.0) * onPlane * real * (0.014 + nearBeam * (0.5 + flash));
    }
    gl_FragColor = vec4(c, 1.0);
  }`

export interface PrismReadout {
  incidence: number // degrees
  deviation: number | null // degrees, for the 546 nm line
  lines: number
}

export interface PrismOptions {
  reducedMotion: boolean
  onReadout?: (r: PrismReadout) => void
}

export class PrismScene {
  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private bloom: UnrealBloomPass
  private back: THREE.WebGLRenderTarget
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
  private group = new THREE.Group()
  private frontMat: THREE.ShaderMaterial
  private beamBuf = new RibbonBuffer(MAX_RIBBONS)
  private fanBuf = new RibbonBuffer(MAX_RIBBONS)
  private glowBuf = new RibbonBuffer(8)
  private dust: THREE.Points
  private sparks: THREE.Points
  private sparkSeeds: Float32Array
  private pulseUniforms = { uPulse: { value: -1000 }, uPulseGain: { value: 0 } }
  private fs: Face[] = []
  private side = 5.2
  private R: number
  private aim: V2
  private sector: [number, number]
  private rRange: [number, number] = [8, 12]

  // The light's place on its arc: angle and radius, each on a critically damped spring.
  private theta: number
  private thetaV = 0
  private thetaTarget: number
  private radius = 7
  private radiusV = 0
  private radiusTarget = 7
  private source: V2 = [0, 0]
  private parallax: V2 = [0, 0]
  private parallaxTarget: V2 = [0, 0]
  private basePos = new THREE.Vector3()
  private baseRot = new THREE.Euler(0.06, -0.2, 0)
  private lastPointer = -1e9
  private pulseAt = -1 // scene time a pass started
  private nextPulse = 1.6
  private trace: Trace | null = null
  private raf = 0
  private running = false
  private visible = true
  private last = 0
  private elapsed = 0
  private reduced: boolean
  private onReadout?: (r: PrismReadout) => void
  private lastReadout = ''
  private dirty = true

  constructor(canvas: HTMLCanvasElement, opts: PrismOptions) {
    this.reduced = opts.reducedMotion
    this.onReadout = opts.onReadout
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 1)
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.scene.background = new THREE.Color(0x000000)
    this.camera.position.set(0, 0, 14)
    this.back = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType })

    this.fs = faces(this.side)
    this.R = this.side / Math.sqrt(3)
    this.aim = [0, this.R / 4]
    // The arc the light rides: from just above the lower-right corner up to about
    // 34 degrees off the entry face's normal. Any steeper and everything reflects
    // inside and leaves as one white beam.
    const toBR = Math.atan2(-this.R / 2 - this.aim[1], this.side / 2 - this.aim[0])
    const normal = Math.atan2(this.fs[0].n[1], this.fs[0].n[0])
    this.sector = [toBR + 0.12, normal - 0.6]
    this.theta = this.thetaTarget = this.sector[0] + 0.2

    // The glass: a bevelled, laminated solid.
    const shape = new THREE.Shape([new THREE.Vector2(0, this.R), new THREE.Vector2(-this.side / 2, -this.R / 2), new THREE.Vector2(this.side / 2, -this.R / 2)])
    const depth = 2.1
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.15, bevelSegments: 7, curveSegments: 1 })
    geo.translate(0, 0, -depth / 2)
    const shared = { uEntry: { value: new THREE.Vector2(99, 99) }, uExit: { value: new THREE.Vector2(99, 99) } }
    const backMat = new THREE.ShaderMaterial({
      vertexShader: GLASS_VERT, fragmentShader: GLASS_BACK_FRAG, uniforms: shared,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    })
    this.frontMat = new THREE.ShaderMaterial({
      vertexShader: GLASS_VERT, fragmentShader: GLASS_FRONT_FRAG,
      uniforms: { ...shared, uBack: { value: this.back.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uSpan: { value: this.side }, uPulseIn: { value: -1 } },
      side: THREE.FrontSide,
    })
    const backFaces = new THREE.Mesh(geo, backMat)
    backFaces.layers.set(BACK)
    const frontFaces = new THREE.Mesh(geo, this.frontMat)
    frontFaces.layers.set(FRONT)
    this.group.add(backFaces, frontFaces)

    // The light. Beams and lines sit in the refraction buffer too, so the part inside
    // the glass is seen through it (depth-tested against the front faces).
    const ribbonMat = (spread: number) => new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG,
      uniforms: { uSpread: { value: spread }, ...this.pulseUniforms },
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    })
    const beams = new THREE.Mesh(this.beamBuf.geometry, ribbonMat(0))
    const fan = new THREE.Mesh(this.fanBuf.geometry, ribbonMat(0.7))
    const glows = new THREE.Mesh(this.glowBuf.geometry, new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERT, fragmentShader: GLOW_FRAG,
      blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    }))
    glows.renderOrder = 10
    glows.layers.set(FRONT)
    for (const m of [beams, fan, glows]) m.frustumCulled = false
    this.group.add(fan, beams, glows)
    this.group.rotation.copy(this.baseRot)
    this.scene.add(this.group)

    const dustMat = () => new THREE.ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 } },
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    })
    this.dust = this.makeDust(900, dustMat())
    this.scene.add(this.dust)
    this.sparkSeeds = Float32Array.from({ length: 160 * 3 }, () => Math.random())
    this.sparks = this.makeSparks(160, dustMat())
    this.sparks.frustumCulled = false
    this.group.add(this.sparks)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 0.34)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
  }

  private makeDust(n: number, mat: THREE.ShaderMaterial) {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const phase = new Float32Array(n)
    const color = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() - 0.5) * 34, (Math.random() - 0.5) * 20, -2 - Math.random() * 10], i * 3)
      size[i] = 0.8 + Math.random() * Math.random() * 2.2
      phase[i] = Math.random()
      const k = 0.18 + Math.random() * 0.5
      color.set([k, k, k * 1.05], i * 3)
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    return new THREE.Points(g, mat)
  }

  private makeSparks(n: number, mat: THREE.ShaderMaterial) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(Float32Array.from({ length: n }, () => 1 + Math.random() * 2), 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(Float32Array.from({ length: n }, () => Math.random()), 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    return new THREE.Points(g, mat)
  }

  /**
   * Pointer in canvas-normalised coords (x, y in [-1, 1], y up). Height alone
   * picks the light's place on its arc, so the mapping is smooth everywhere:
   * no angle to wrap around, nothing that flips when you cross the glass.
   * Horizontal position only nudges how far out the light sits.
   */
  pointer(nx: number, ny: number) {
    this.thetaTarget = this.sector[0] + (this.sector[1] - this.sector[0]) * smoothstep(-0.85, 0.85, ny)
    this.radiusTarget = this.rRange[0] + (this.rRange[1] - this.rRange[0]) * smoothstep(-0.7, 0.95, nx)
    this.parallaxTarget = [clamp(nx, -1, 1), clamp(ny, -1, 1)]
    this.lastPointer = performance.now()
    this.wake()
  }

  /** Send a forward pass through the glass. */
  pulse() {
    if (this.reduced) return
    this.pulseAt = this.elapsed
    this.nextPulse = this.elapsed + PULSE_EVERY
    this.wake()
  }

  resize(w: number, h: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 1.75)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.composer.setPixelRatio(dpr)
    this.composer.setSize(w, h)
    this.back.setSize(Math.round(w * dpr), Math.round(h * dpr))
    this.frontMat.uniforms.uRes.value.set(Math.round(w * dpr), Math.round(h * dpr))
    this.bloom.resolution.set(w / 2, h / 2)
    this.camera.aspect = w / h
    const portrait = w / h < 0.9
    this.camera.fov = portrait ? 46 : 32
    this.camera.updateProjectionMatrix()
    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z
    const halfW = halfH * this.camera.aspect
    let scale: number
    if (portrait) {
      this.basePos.set(halfW * 0.18, halfH * 0.42, 0)
      scale = Math.min(1, (halfW * 1.25) / this.side)
    } else {
      this.basePos.set(halfW * 0.38, -0.05, 0)
      scale = Math.min(1, (halfH * 1.5) / (this.side * 0.866))
    }
    this.group.position.copy(this.basePos)
    this.group.scale.setScalar(scale)
    // Keep the light on screen where there's room; on narrow screens it sits just off the edge.
    const room = (halfW - this.basePos.x) / scale
    const rMin = this.R * 1.45
    const fresh = this.rRange[0] === 8
    this.rRange = [rMin, Math.max(rMin + 0.6, Math.min(this.R * 3.3, room * 0.92))]
    const rest = clamp(this.R * 2.3, this.rRange[0], this.rRange[1])
    this.radiusTarget = clamp(this.radiusTarget, this.rRange[0], this.rRange[1])
    if (fresh) this.radius = this.radiusTarget = rest
    for (const p of [this.dust, this.sparks]) (p.material as THREE.ShaderMaterial).uniforms.uPixel.value = dpr
    this.dirty = true
    this.wake()
  }

  private rebuild() {
    const tr = traceLight(this.fs, this.source, this.aim)
    this.trace = tr
    const beams = this.beamBuf, fan = this.fanBuf, glows = this.glowBuf
    beams.reset()
    fan.reset()
    glows.reset()
    const ribbon = (o: RibbonBuffer, a: V2, b: V2, w0: number, w1: number, c: THREE.Color, g: number, s0: number, s1: number, delay: number, fade: number) => {
      const d = norm(sub(b, a))
      const n: V2 = [-d[1], d[0]]
      const q = [add(a, n, -w0), add(a, n, w0), add(b, n, w1), add(b, n, -w1)]
      const u = [[-1, 0], [1, 0], [1, 1], [-1, 1]]
      const sv = [s0, s0, s1, s1]
      for (const i of [0, 1, 2, 0, 2, 3]) o.vertex(q[i][0], q[i][1], u[i][0], u[i][1], c, g, sv[i], delay, fade)
    }
    const white = new THREE.Color(1, 0.985, 0.97)
    const glow = (p: V2, r: number, g: number) => {
      const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      for (const i of [0, 1, 2, 0, 2, 3]) glows.vertex(p[0] + q[i][0] * r, p[1] + q[i][1] * r, q[i][0], q[i][1], white, g, 0, 0, 0)
    }
    glow(this.source, 0.42, 0.75) // the light itself
    if (tr) {
      // From the light to the glass, at full strength; brightest where it lands.
      ribbon(beams, tr.source, add(tr.entry, tr.dir, 0.25), 0.2, 0.2, white, 0.07, 0, tr.entryS, 0, 0)
      ribbon(beams, tr.source, add(tr.entry, tr.dir, 0.25), 0.05, 0.05, white, 3.6, 0, tr.entryS, 0, 0)
      // What the entry face reflects instead of letting in.
      const bounce = reflect(tr.dir, this.fs[tr.entryFace].n)
      ribbon(beams, tr.entry, add(tr.entry, bounce, 9), 0.03, 0.08, white, 2.6 * tr.reflectance, tr.entryS, tr.entryS + 9, 0, 1)
      for (const seg of tr.inside) {
        ribbon(beams, seg.a, seg.b, 0.07, 0.08, LINE_COLORS[seg.line], 3.2 * Math.pow(seg.w, 1.3), seg.s0, seg.s1, 0, 0)
      }
      for (const o of tr.outs) {
        // Strength follows the light that got out, steeper for faint paths so internal
        // reflections stay ghosts. Red (input) leaves first, violet (output) last.
        ribbon(fan, o.at, add(o.at, o.dir, FAN_LENGTH), 0.035, 0.17, LINE_COLORS[o.line], 2.9 * Math.pow(o.w, 1.4), o.s0, o.s0 + FAN_LENGTH, o.line * 0.55, 1)
      }
      glow(tr.entry, 0.26, 0.55)
      if (tr.midExit) glow(tr.midExit, 0.2, 0.22)
    }
    beams.commit()
    fan.commit()
    glows.commit()
    const entry = this.frontMat.uniforms.uEntry.value as THREE.Vector2
    const exit = this.frontMat.uniforms.uExit.value as THREE.Vector2
    entry.set(tr ? tr.entry[0] : 99, tr ? tr.entry[1] : 99)
    exit.set(tr?.midExit ? tr.midExit[0] : 99, tr?.midExit ? tr.midExit[1] : 99)

    // Sparks: dust caught in the lines, bound to their line so they never jump between them.
    const sp = this.sparks.geometry.getAttribute('position') as THREE.BufferAttribute
    const sc = this.sparks.geometry.getAttribute('aColor') as THREE.BufferAttribute
    const main = new Map<number, Out>()
    for (const o of tr?.outs ?? []) if (!main.has(o.line) || main.get(o.line)!.w < o.w) main.set(o.line, o)
    for (let i = 0; i < sp.count; i++) {
      const s0 = this.sparkSeeds[i * 3], s1 = this.sparkSeeds[i * 3 + 1], s2 = this.sparkSeeds[i * 3 + 2]
      const line = Math.floor(s0 * EMISSION_LINES.length)
      const o = main.get(line)
      if (!o) {
        sp.setXYZ(i, 0, 0, -50)
        continue
      }
      const along = 1 + Math.pow(s1, 1.5) * 15
      const p = add(o.at, o.dir, along)
      const q = add(p, [-o.dir[1], o.dir[0]], (s2 - 0.5) * (0.06 + along * 0.02))
      sp.setXYZ(i, q[0], q[1], (s2 - 0.5) * 0.5)
      const [r, g, b] = wavelengthRGB(EMISSION_LINES[line].nm)
      const k = 0.9 * Math.min(1, Math.pow(o.w, 1.4) * 1.4) * (0.4 + 0.6 * EMISSION_LINES[line].intensity)
      sc.setXYZ(i, r * k, g * k, b * k)
    }
    sp.needsUpdate = true
    sc.needsUpdate = true

    if (tr && this.onReadout) {
      const r: PrismReadout = {
        incidence: (tr.incidence * 180) / Math.PI,
        deviation: tr.deviation === null ? null : (tr.deviation * 180) / Math.PI,
        lines: new Set(tr.outs.filter((o) => o.w > 0.08).map((o) => o.line)).size,
      }
      const key = `${r.incidence.toFixed(1)}|${r.deviation?.toFixed(1)}|${r.lines}`
      if (key !== this.lastReadout) {
        this.lastReadout = key
        this.onReadout(r)
      }
    }
  }

  private render() {
    this.camera.layers.set(BACK)
    this.renderer.setRenderTarget(this.back)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    this.renderer.setRenderTarget(null)
    this.camera.layers.enableAll()
    this.composer.render()
  }

  private frame = () => {
    if (!this.running) return
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.elapsed += dt
    const t = this.elapsed

    // Left alone, the light breathes gently around wherever it was left; it never wanders off.
    const idle = now - this.lastPointer > 4000
    const breathe = idle && !this.reduced ? Math.sin(t * 0.21) * 0.07 : 0
    const thetaGoal = clamp(this.thetaTarget + breathe, this.sector[0], this.sector[1])
    const omega = idle ? 1.2 : 5.5
    ;[this.theta, this.thetaV] = spring(this.theta, this.thetaV, thetaGoal, omega, dt)
    ;[this.radius, this.radiusV] = spring(this.radius, this.radiusV, this.radiusTarget, omega, dt)
    const next = add(this.aim, [Math.cos(this.theta), Math.sin(this.theta)], this.radius)
    const moving = Math.hypot(next[0] - this.source[0], next[1] - this.source[1]) > 1e-4
    if (moving || this.dirty) {
      this.source = next
      this.dirty = true
    }

    // The glass floats, and leans a little toward the pointer.
    if (idle) this.parallaxTarget = [0, 0]
    this.parallax = add(this.parallax, sub(this.parallaxTarget, this.parallax), 1 - Math.exp(-dt * 2.5))
    const sway = this.reduced ? 0 : 1
    this.group.rotation.set(
      this.baseRot.x + (Math.sin(t * 0.23 + 1) * 0.035 - this.parallax[1] * 0.05) * sway,
      this.baseRot.y + (Math.sin(t * 0.31) * 0.09 + this.parallax[0] * 0.07) * sway,
      0,
    )
    this.group.position.set(this.basePos.x, this.basePos.y + Math.sin(t * 0.47) * 0.06 * sway, 0)

    if (this.dirty) {
      this.rebuild()
      this.dirty = false
    }

    // The forward pass: a packet of light from the source through every line.
    if (!this.reduced && t >= this.nextPulse) this.pulse()
    const tr = this.trace
    if (this.pulseAt >= 0 && tr) {
      const front = (t - this.pulseAt) * PULSE_SPEED
      this.pulseUniforms.uPulse.value = front
      this.pulseUniforms.uPulseGain.value = 2.2
      this.frontMat.uniforms.uPulseIn.value = tr.midLen > 0 && front >= tr.entryS && front <= tr.entryS + tr.midLen ? (front - tr.entryS) / tr.midLen : -1
      if (front > tr.entryS + tr.midLen + FAN_LENGTH + EMISSION_LINES.length * 0.55) {
        this.pulseAt = -1
        this.pulseUniforms.uPulseGain.value = 0
      }
    } else {
      this.frontMat.uniforms.uPulseIn.value = -1
    }

    for (const p of [this.dust, this.sparks]) (p.material as THREE.ShaderMaterial).uniforms.uTime.value = this.reduced ? 0 : t
    if (!this.reduced) this.dust.rotation.z = Math.sin(t * 0.03) * 0.02
    this.render()
    if (this.reduced && !moving) {
      this.running = false
      return
    }
    this.raf = requestAnimationFrame(this.frame)
  }

  private wake() {
    if (this.running || !this.visible) return
    this.running = true
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  setVisible(v: boolean) {
    this.visible = v
    if (v) this.wake()
    else {
      this.running = false
      cancelAnimationFrame(this.raf)
    }
  }

  dispose() {
    this.setVisible(false)
    this.back.dispose()
    this.composer.dispose()
    this.renderer.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | undefined
      mat?.dispose()
    })
  }
}
