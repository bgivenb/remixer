import { Database, LoaderCircle, ArchiveRestore, X } from 'lucide-react'
import { useState } from 'react'
import type { StorageStatus } from '../types'

const LIMITS = [500, 1024, 2048, 5120, 10240, 20480, 51200]

function size(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

interface StorageSettingsProps {
  status: StorageStatus
  busy: boolean
  onClose: () => void
  onLimit: (limitMb: number) => void
  onCleanup: () => void
  onOffload: (trackDir: string) => void
  activeTrackDir?: string
}

export function StorageSettings({ status, busy, onClose, onLimit, onCleanup, onOffload, activeTrackDir }: StorageSettingsProps) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const usedPercent = Math.min(100, (status.used_bytes / (status.limit_mb * 1024 * 1024)) * 100)
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="storage-settings modal-card" role="dialog" aria-modal="true" aria-labelledby="storage-title">
        <header className="modal-heading"><div><p className="eyebrow">Settings</p><h1 id="storage-title">Storage</h1></div><button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={18} /></button></header>
        <div className="storage-summary">
          <div className="storage-figure"><Database size={21} /><strong>{size(status.used_bytes)}</strong><span>used of {status.limit_mb >= 1024 ? `${status.limit_mb / 1024} GB` : `${status.limit_mb} MB`}</span></div>
          <div className="storage-meter"><i style={{ width: `${usedPercent}%` }} /></div>
          <p>When the library exceeds this limit, Remixer offloads the oldest unused audio first. History, source links, thumbnails, BPM, key, selections, and chord maps stay. The current project and tutorial are protected.</p>
          <label>Maximum project audio<select value={status.limit_mb} onChange={(event) => onLimit(Number(event.target.value))} disabled={busy}>{LIMITS.map((limit) => <option key={limit} value={limit}>{limit >= 1024 ? `${limit / 1024} GB` : `${limit} MB`}</option>)}</select></label>
          <button className="secondary-button" onClick={onCleanup} disabled={busy}>{busy ? <LoaderCircle className="spin" size={14} /> : <ArchiveRestore size={14} />} Offload oldest project now</button>
        </div>
        <div className="project-manager">
          <div className="section-heading compact"><div><p className="eyebrow">Local library</p><h2>Projects</h2></div><span>{status.projects.length} remembered</span></div>
          <div className="project-list">{status.projects.map((project) => <article key={project.track_dir}>
            <div><strong>{project.title}</strong><small>{project.offloaded ? 'Audio offloaded · analysis retained' : `${size(project.size_bytes)} local`}</small></div>
            {project.tutorial ? <span className="protected-tag">Protected tutorial</span> : project.track_dir === activeTrackDir ? <span className="protected-tag">Current project</span> : project.offloaded ? <span className="offloaded-tag">In history</span> : confirming === project.track_dir ? <div className="delete-confirm"><button onClick={() => setConfirming(null)}>Cancel</button><button className="danger" onClick={() => { onOffload(project.track_dir); setConfirming(null) }}>Offload audio</button></div> : <button className="small-button" onClick={() => setConfirming(project.track_dir)}><ArchiveRestore size={14} /> Offload</button>}
          </article>)}</div>
        </div>
      </section>
    </div>
  )
}
