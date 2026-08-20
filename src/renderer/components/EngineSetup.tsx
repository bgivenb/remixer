import { Cpu, Download, LoaderCircle, Sparkles } from 'lucide-react'
import type { EngineStatus } from '../types'

interface EngineSetupProps {
  status: EngineStatus | null
  installing: boolean
  installLog: string
  onInstall: () => void
}

export function EngineSetup({ status, installing, installLog, onInstall }: EngineSetupProps) {
  return (
    <main className="setup-shell">
      <section className="setup-card panel">
        <div className="setup-mark"><Sparkles size={28} /></div>
        <p className="eyebrow">One-time setup</p>
        <h1>Install the local audio engine</h1>
        <p className="setup-copy">
          Remixer needs its private Python, CUDA, analysis, download, and BS-RoFormer packages. Models are downloaded and verified only when you first use them.
        </p>
        <div className="setup-specs">
          <span><Cpu size={16} /> RTX 3080 acceleration</span>
          <span><Download size={16} /> Approximately 6 GB engine install</span>
        </div>
        {status?.error ? <div className="error-banner">{status.error}</div> : null}
        <button className="hero-button" disabled={installing} onClick={onInstall}>
          {installing ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}
          {installing ? 'Installing audio engine…' : status?.installed ? 'Repair audio engine' : 'Install audio engine'}
        </button>
        {installLog ? <pre className="install-log">{installLog}</pre> : null}
      </section>
    </main>
  )
}

