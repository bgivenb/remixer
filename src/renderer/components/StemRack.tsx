import { Clipboard, ClipboardCopy, FolderOpen, Headphones, Layers3 } from 'lucide-react'
import type { Selection, StemSet } from '../types'
import { stemDisplayName } from '../lib'

const STEM_COLORS: Record<string, string> = {
  vocals: '#ff719a',
  drums: '#ffb55f',
  bass: '#8f7dff',
  guitar: '#50ddbf',
  piano: '#62b7ff',
  other: '#b7c1d4',
  instrumental: '#d9ff5b',
}

interface StemRackProps {
  stemSet: StemSet
  selection: Selection
  onPreview: (stem: string, file: string) => void
  onCopyFull: (stem: string, file: string) => void
  onCopySelection: (stem: string, file: string) => void
  onCopyAll: (selected: boolean) => void
  onShow: (file: string) => void
}

export function StemRack({ stemSet, onPreview, onCopyFull, onCopySelection, onCopyAll, onShow }: StemRackProps) {
  const entries = Object.entries(stemSet.paths)
  return (
    <section className="panel stem-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Stem rack</p>
          <h2>{stemSet.mode === 'full' ? 'Six-stem separation' : 'HQ vocal extraction'}</h2>
        </div>
        <div className="stem-header-actions">
          <button className="secondary-button" onClick={() => onCopyAll(false)}><ClipboardCopy size={16} /> Copy all full</button>
          <button className="primary-button" onClick={() => onCopyAll(true)}><Clipboard size={16} /> Copy all selection</button>
        </div>
      </div>
      <div className="stem-list">
        {entries.map(([stem, file]) => (
          <article className="stem-row" key={stem} style={{ '--stem-color': STEM_COLORS[stem] || '#d9ff5b' } as React.CSSProperties}>
            <div className="stem-identity">
              <span className="stem-dot" />
              <div><strong>{stemDisplayName(stem)}</strong><span>32-bit float WAV</span></div>
            </div>
            <div className="fake-wave" aria-hidden="true">
              {Array.from({ length: 32 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 37 + stem.length * 11) % 70)}%` }} />)}
            </div>
            <div className="stem-actions">
              <button className="small-button" onClick={() => onPreview(stem, file)}><Headphones size={14} /> Preview</button>
              <button className="small-button" onClick={() => onCopyFull(stem, file)}><ClipboardCopy size={14} /> Full</button>
              <button className="small-button accent" onClick={() => onCopySelection(stem, file)}><Clipboard size={14} /> Selection</button>
              <button className="icon-button" onClick={() => onShow(file)} aria-label={`Show ${stem} in folder`}><FolderOpen size={15} /></button>
            </div>
          </article>
        ))}
      </div>
      <div className="model-footnote"><Layers3 size={14} /> {stemSet.model} · {stemSet.device}</div>
    </section>
  )
}
