/// <reference types="vite/client" />

interface RemixerApi {
  getEngineStatus(): Promise<EngineStatus>
  installEngine(): Promise<{ ok: true }>
  chooseAudioFile(): Promise<string | null>
  runWorker<T>(request: Record<string, unknown>): Promise<T>
  stopWorker(): Promise<{ ok: true }>
  copyFiles(files: string[]): Promise<{ ok: true; count: number }>
  copyText(text: string): Promise<{ ok: true }>
  showItem(file: string): Promise<void>
  openPath(file: string): Promise<string>
  mediaUrl(file: string): Promise<string>
  onWorkerMessage(callback: (message: WorkerMessage) => void): () => void
  onInstallMessage(callback: (message: string) => void): () => void
}

interface Window {
  remixer: RemixerApi
}

