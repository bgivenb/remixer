import { Cpu, Download, LoaderCircle, Sparkles } from 'lucide-react'
import type { EngineStatus } from '../types'

interface EngineSetupProps {
  status: EngineStatus | null
  installing: boolean
  installLog: string
  onInstall: () => void
}

export function EngineSetup({ status, installing, installLog, onInstall }: EngineSetupProps) {
  const isMac = status?.platform === 'darwin' || navigator.platform.startsWith('Mac')
  return (
    <main className="setup-shell">
      <section className="setup-card panel">
        <div className="setup-mark"><Sparkles size={28} /></div>
        <p className="eyebrow">One-time setup</p>
        <h1>Install the local audio engine</h1>
        <p className="setup-copy">
          Remixer installs its private Python, {isMac ? 'Apple Silicon compute' : 'CUDA'}, audio tools, and the core six-stem model. This one-time download is about 1.6 GB. The optional HQ-vocal model downloads only if you choose it later.
        </p>
        <div className="setup-specs">
          <span><Cpu size={16} /> {isMac ? 'Native MLX with MPS fallback' : 'NVIDIA GPU acceleration'}</span>
          <span><Download size={16} /> Engine + six-stem model from Hugging Face</span>
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
