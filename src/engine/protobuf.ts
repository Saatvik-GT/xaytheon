/**
 * Minimal protobuf wire-format reader/writer, just enough to read ONNX models
 * and splice new fields into them.
 *
 * Rewrites copy every field we don't touch byte-for-byte, so unknown or newer
 * ONNX fields survive instrumentation untouched (a decode/encode round trip
 * through generated message classes would silently drop them).
 */

export const WIRE_VARINT = 0
export const WIRE_I64 = 1
export const WIRE_LEN = 2
export const WIRE_I32 = 5

export interface Field {
  num: number
  wire: number
  /** Payload range: the varint bytes, the fixed bytes, or the length-delimited body. */
  start: number
  end: number
  /** Whole field including its tag, for verbatim copies. */
  rawStart: number
  rawEnd: number
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()

export class Reader {
  pos: number
  readonly buf: Uint8Array
  readonly end: number

  constructor(buf: Uint8Array, start = 0, end = buf.length) {
    this.buf = buf
    this.pos = start
    this.end = end
  }

  /** Varint as a JS number. Exact up to 2^53, which covers tags, lengths and shapes. */
  varint(): number {
    let result = 0
    let mul = 1
    for (let i = 0; i < 10; i++) {
      if (this.pos >= this.end) throw new Error('Truncated varint: the file looks damaged.')
      const b = this.buf[this.pos++]
      result += (b & 0x7f) * mul
      if (b < 0x80) return result
      mul *= 128
    }
    throw new Error('Malformed varint: the file looks damaged.')
  }

  /** Varint as a signed 64-bit BigInt (int64 attributes can be negative). */
  varint64(): bigint {
    let result = 0n
    let shift = 0n
    for (let i = 0; i < 10; i++) {
      const b = this.buf[this.pos++]
      result |= BigInt(b & 0x7f) << shift
      if (b < 0x80) return BigInt.asIntN(64, result)
      shift += 7n
    }
    throw new Error('Malformed varint: the file looks damaged.')
  }

  fields(): Field[] {
    const out: Field[] = []
    while (this.pos < this.end) {
      const rawStart = this.pos
      const tag = this.varint()
      const num = Math.floor(tag / 8)
      const wire = tag & 7
      let start = this.pos
      switch (wire) {
        case WIRE_VARINT: this.varint(); break
        case WIRE_I64: this.pos += 8; break
        case WIRE_I32: this.pos += 4; break
        case WIRE_LEN: {
          const len = this.varint()
          start = this.pos
          this.pos += len
          break
        }
        default: throw new Error(`Unsupported protobuf wire type ${wire}: is this really an ONNX file?`)
      }
      if (this.pos > this.end) throw new Error('A field runs past the end of the file: it may be truncated.')
      out.push({ num, wire, start, end: this.pos, rawStart, rawEnd: this.pos })
    }
    return out
  }
}

export const sub = (buf: Uint8Array, f: Field) => new Reader(buf, f.start, f.end)
export const str = (buf: Uint8Array, f: Field) => decoder.decode(buf.subarray(f.start, f.end))
export const num = (buf: Uint8Array, f: Field) => new Reader(buf, f.start, f.end).varint()
export const int64 = (buf: Uint8Array, f: Field) => new Reader(buf, f.start, f.end).varint64()
export const f32 = (buf: Uint8Array, f: Field) => new DataView(buf.buffer, buf.byteOffset + f.start, 4).getFloat32(0, true)

/** Repeated int64: accepts both packed (proto3 style) and unpacked (ONNX's proto2 default). */
export function int64s(buf: Uint8Array, fields: Field[], fieldNum: number): number[] {
  const out: number[] = []
  for (const f of fields) {
    if (f.num !== fieldNum) continue
    if (f.wire === WIRE_LEN) {
      const r = sub(buf, f)
      while (r.pos < r.end) out.push(Number(r.varint64()))
    } else out.push(Number(int64(buf, f)))
  }
  return out
}

export function floats(buf: Uint8Array, fields: Field[], fieldNum: number): number[] {
  const out: number[] = []
  for (const f of fields) {
    if (f.num !== fieldNum) continue
    const view = new DataView(buf.buffer, buf.byteOffset + f.start, f.end - f.start)
    for (let o = 0; o + 4 <= f.end - f.start; o += 4) out.push(view.getFloat32(o, true))
  }
  return out
}

export class Writer {
  private chunks: Uint8Array[] = []
  private size = 0

  private push(b: Uint8Array) {
    this.chunks.push(b)
    this.size += b.length
  }

  varint(n: number | bigint) {
    let v = BigInt.asUintN(64, BigInt(n))
    const bytes: number[] = []
    do {
      const b = Number(v & 0x7fn)
      v >>= 7n
      bytes.push(v > 0n ? b | 0x80 : b)
    } while (v > 0n)
    this.push(Uint8Array.from(bytes))
    return this
  }

  tag(fieldNum: number, wire: number) {
    return this.varint(fieldNum * 8 + wire)
  }

  bytes(fieldNum: number, data: Uint8Array) {
    this.tag(fieldNum, WIRE_LEN).varint(data.length)
    this.push(data)
    return this
  }

  string(fieldNum: number, s: string) {
    return this.bytes(fieldNum, encoder.encode(s))
  }

  int(fieldNum: number, n: number | bigint) {
    return this.tag(fieldNum, WIRE_VARINT).varint(n)
  }

  /** Copy already-encoded bytes verbatim. */
  raw(data: Uint8Array) {
    this.push(data)
    return this
  }

  finish(): Uint8Array {
    const out = new Uint8Array(this.size)
    let o = 0
    for (const c of this.chunks) {
      out.set(c, o)
      o += c.length
    }
    return out
  }
}
