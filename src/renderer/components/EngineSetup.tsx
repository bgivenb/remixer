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
  const setupFootprint = isMac ? 'about 1.6 GB' : 'about 5.2 GB of disk space'
  const setupTitle = isMac ? 'Set up Remixer' : 'Install audio engine'
  const setupAction = status?.installed
    ? (isMac ? 'Repair Remixer setup' : 'Repair audio engine')
    : setupTitle
  return (
    <main className="setup-shell">
      <section className="setup-card panel">
        <div className="setup-mark"><Sparkles size={28} /></div>
        <p className="eyebrow">One-time setup</p>
        <h1>{setupTitle}</h1>
        <p className="setup-copy">
          {isMac ? 'Remixer handles everything here—no Terminal or separate developer tools required. ' : ''}
          It installs private Python, {isMac ? 'Apple Silicon compute' : 'CUDA'}, audio tools, and the core six-stem model. This one-time setup uses {setupFootprint}. The optional HQ-vocal model downloads only if you choose it later.
        </p>
        <div className="setup-specs">
          <span><Cpu size={16} /> {isMac ? 'Native MLX with MPS fallback' : 'NVIDIA GPU acceleration'}</span>
          <span><Download size={16} /> Engine + six-stem model from Hugging Face</span>
        </div>
        {status?.error ? <div className="error-banner">{status.error}</div> : null}
        <button className="hero-button" disabled={installing} onClick={onInstall}>
          {installing ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}
          {installing ? (isMac ? 'Setting up Remixer…' : 'Installing audio engine…') : setupAction}
        </button>
        {installLog ? <pre className="install-log">{installLog}</pre> : null}
      </section>
    </main>
  )
}
