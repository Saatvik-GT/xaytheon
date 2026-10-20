import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, FileUp } from 'lucide-react'
import { custom, MODELS, type ModelEntry } from '../models/registry'
import { labHref } from '../router'
import { GitHubIcon, Mark, REPO } from '../ui/Mark'

interface Props {
  entry: ModelEntry
  onOpenFile: (f: File) => void
}

export function LabBar({ entry, onOpenFile }: Props) {
  return (
    <nav className="lab-bar" aria-label="Lab">
      <a className="brand" href="#/" aria-label="Xaytheon home">
        <Mark />
        <span className="brand-name brand-name-sm">Xaytheon</span>
      </a>
      <span className="brand-slash" aria-hidden="true">/</span>
      <ModelMenu entry={entry} />
      <span className="lab-bar-spacer" />
      <label className="btn btn-sm">
        <FileUp /> <span className="hide-sm">Open .onnx</span>
        <input type="file" accept=".onnx" aria-label="Open an .onnx model" onChange={(e) => e.target.files?.[0] && onOpenFile(e.target.files[0])} />
      </label>
      <a className="btn btn-sm btn-quiet btn-icon" href={REPO} aria-label="Xaytheon on GitHub"><GitHubIcon /></a>
    </nav>
  )
}

function ModelMenu({ entry }: { entry: ModelEntry }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const items = [...MODELS, ...(custom.bytes ? [{ id: 'custom', name: custom.name.replace(/\.onnx$/i, ''), title: 'Your model' }] : [])]

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        root.current?.querySelector<HTMLButtonElement>('.model-trigger')?.focus()
      }
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    root.current?.querySelector<HTMLAnchorElement>('[aria-current="true"], .menu-item')?.focus()
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  const onMenuKey = (e: React.KeyboardEvent) => {
    const links = [...(root.current?.querySelectorAll<HTMLAnchorElement>('.menu-item') ?? [])]
    const i = links.indexOf(document.activeElement as HTMLAnchorElement)
    if (e.key === 'ArrowDown') links[(i + 1) % links.length]?.focus()
    else if (e.key === 'ArrowUp') links[(i - 1 + links.length) % links.length]?.focus()
    else return
    e.preventDefault()
  }

  return (
    <div className="model-menu" ref={root}>
      <button className="model-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{entry.name}</span>
        <ChevronsUpDown aria-hidden="true" />
      </button>
      {open && (
        <div className="menu" role="menu" onKeyDown={onMenuKey}>
          {items.map((m) => (
            <a
              key={m.id}
              role="menuitem"
              className="menu-item"
              href={labHref(m.id)}
              aria-current={m.id === entry.id}
              onClick={() => setOpen(false)}
            >
              <span className="menu-name">{m.name}</span>
              <span className="menu-title">{m.title}</span>
              {m.id === entry.id && <Check aria-hidden="true" />}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
