import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { custom } from './models/registry'
import { navigate, useRoute } from './router'
import { Landing } from './site/Landing'

const Lab = lazy(() => import('./lab/Lab'))

export default function App() {
  const route = useRoute()
  const [dragging, setDragging] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)

  const openFile = useCallback(async (f: File) => {
    if (!/\.onnx$/i.test(f.name)) {
      setDropError(`${f.name} isn't an .onnx file. Export your model to ONNX first, for example with torch.onnx.export.`)
      return
    }
    setDropError(null)
    custom.name = f.name
    custom.bytes = new Uint8Array(await f.arrayBuffer())
    custom.version++
    navigate('/lab/custom')
  }, [])

  // Drop an .onnx anywhere, on any page.
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault()
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const f = e.dataTransfer?.files[0]
      if (f) void openFile(f)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [openFile])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])

  const labMatch = route.match(/^\/lab\/([\w-]+)/)

  return (
    <>
      {labMatch ? (
        <Suspense fallback={<div className="lab-boot" />}>
          <Lab id={labMatch[1]} onOpenFile={openFile} />
        </Suspense>
      ) : (
        <Landing onOpenFile={openFile} />
      )}
      {dragging && (
        <div className="dropzone" aria-hidden="true">
          <div className="dropzone-inner">
            <span>Drop to inspect your model</span>
            <span className="dropzone-note">It stays on this device.</span>
          </div>
        </div>
      )}
      {dropError && (
        <div className="toast" role="alert">
          <span>{dropError}</span>
          <button className="btn btn-sm btn-quiet" onClick={() => setDropError(null)}>Dismiss</button>
        </div>
      )}
    </>
  )
}
