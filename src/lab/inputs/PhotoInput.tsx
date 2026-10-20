import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, ImageUp } from 'lucide-react'
import { floatTensor, type ort } from '../../engine/runtime'
import { assetUrl } from '../../models/load'

const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

interface Props {
  inputName: string
  dims: number[] // [1, C, H, W]
  normalize: boolean
  photos?: { file: string; name: string; credit: string }[]
  onFeeds: (feeds: Record<string, ort.Tensor>) => void
}

/** Photos, uploads or the webcam, centre-cropped to the model's input size. */
export function PhotoInput({ inputName, dims, normalize, photos = [], onFeeds }: Props) {
  const [, C, H, W] = dims
  const canvas = useRef<HTMLCanvasElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [current, setCurrent] = useState<string | null>(null)
  const [credit, setCredit] = useState<string | null>(null)
  const [camera, setCamera] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const feedFrom = useCallback((src: CanvasImageSource, sw: number, sh: number) => {
    const ctx = canvas.current!.getContext('2d', { willReadFrequently: true })!
    const s = Math.min(sw / W, sh / H)
    ctx.drawImage(src, (sw - W * s) / 2, (sh - H * s) / 2, W * s, H * s, 0, 0, W, H)
    const px = ctx.getImageData(0, 0, W, H).data
    const out = new Float32Array(C * H * W)
    for (let c = 0; c < C; c++)
      for (let i = 0; i < H * W; i++) {
        const v = C === 1 ? (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 765 : px[i * 4 + c] / 255
        out[c * H * W + i] = normalize && C === 3 ? (v - MEAN[c]) / STD[c] : v
      }
    onFeeds({ [inputName]: floatTensor(out, dims) })
  }, [C, H, W, dims, inputName, normalize, onFeeds])

  const loadUrl = useCallback((url: string, name: string, by: string | null) => {
    const img = new Image()
    img.onload = () => {
      feedFrom(img, img.naturalWidth, img.naturalHeight)
      setCurrent(name)
      setCredit(by)
    }
    img.onerror = () => setError(`Couldn't read ${name} as an image.`)
    img.src = url
  }, [feedFrom])

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setCamera(false)
  }, [])

  useEffect(() => {
    if (photos[0]) loadUrl(assetUrl(photos[0].file), photos[0].name, photos[0].credit)
    return stopCamera
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // While the webcam is on, feed a frame a few times a second (runs coalesce if the model is slower).
  useEffect(() => {
    if (!camera) return
    const id = setInterval(() => {
      const v = video.current
      if (v && v.videoWidth) feedFrom(v, v.videoWidth, v.videoHeight)
    }, 250)
    return () => clearInterval(id)
  }, [camera, feedFrom])

  const startCamera = async () => {
    setError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 } }, audio: false })
      stream.current = s
      video.current!.srcObject = s
      await video.current!.play()
      setCamera(true)
      setCurrent('webcam')
      setCredit(null)
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow it in the address bar to use the webcam.'
        : 'No camera is available on this device.')
    }
  }

  return (
    <div className="photo">
      <div className="photo-frame">
        <canvas ref={canvas} width={W} height={H} aria-label={`Model input, ${W}×${H}`} role="img" />
        {camera && <span className="photo-live mono">live</span>}
        <span className="photo-size mono">{W}×{H}</span>
      </div>
      <video ref={video} className="sr-only" playsInline muted />
      {photos.length > 0 && (
        <div className="photo-samples" role="group" aria-label="Sample photos">
          {photos.map((p) => (
            <button
              key={p.file}
              className={`photo-sample${current === p.name ? ' is-selected' : ''}`}
              aria-pressed={current === p.name}
              onClick={() => {
                stopCamera()
                loadUrl(assetUrl(p.file), p.name, p.credit)
              }}
            >
              <img src={assetUrl(p.file)} alt={p.name} />
            </button>
          ))}
        </div>
      )}
      <div className="photo-actions">
        <label className="btn btn-sm">
          <ImageUp /> Upload
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              stopCamera()
              loadUrl(URL.createObjectURL(f), f.name, null)
            }}
          />
        </label>
        <button className="btn btn-sm" onClick={camera ? stopCamera : startCamera} aria-pressed={camera}>
          {camera ? <><CameraOff /> Stop webcam</> : <><Camera /> Webcam</>}
        </button>
      </div>
      {error && <p className="input-error" role="alert">{error}</p>}
      {credit && <p className="photo-credit">{credit}</p>}
    </div>
  )
}
