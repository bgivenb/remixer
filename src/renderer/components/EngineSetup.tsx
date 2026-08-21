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
  const setupFootprint = isMac ? 'about 1.6 GB' : 'about 5.5 GB of disk space'
  const setupTitle = 'Set up Remixer'
  const setupAction = status?.installed ? 'Repair Remixer setup' : setupTitle
  return (
    <main className="setup-shell">
      <section className="setup-card panel">
        <div className="setup-mark"><Sparkles size={28} /></div>
        <p className="eyebrow">One-time setup</p>
        <h1>{setupTitle}</h1>
        <p className="setup-copy">
          Remixer handles everything here—no command line, package manager, or separate developer tools required. It installs its own verified audio tools, private Python, {isMac ? 'Apple Silicon compute' : 'CUDA'}, and the core six-stem model. This one-time setup uses {setupFootprint} and requires an internet connection. The optional HQ-vocal model downloads only if you choose it later.
        </p>
        <div className="setup-specs">
          <span><Cpu size={16} /> {isMac ? 'Native MLX with MPS fallback' : 'NVIDIA GPU acceleration'}</span>
          <span><Download size={16} /> Engine + six-stem model from Hugging Face</span>
        </div>
        {status?.error ? <div className="error-banner">{status.error}</div> : null}
        <button className="hero-button" disabled={installing} onClick={onInstall}>
          {installing ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}
          {installing ? 'Setting up Remixer…' : setupAction}
        </button>
        {installLog ? <pre className="install-log">{installLog}</pre> : null}
      </section>
    </main>
  )
}
