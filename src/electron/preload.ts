import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('remixer', {
  getEngineStatus: () => ipcRenderer.invoke('engine:status'),
  installEngine: () => ipcRenderer.invoke('engine:install'),
  chooseAudioFile: () => ipcRenderer.invoke('dialog:choose-audio'),
  runWorker: (request: Record<string, unknown>) => ipcRenderer.invoke('worker:request', request),
  stopWorker: () => ipcRenderer.invoke('worker:stop'),
  copyFiles: (files: string[]) => ipcRenderer.invoke('clipboard:files', files),
  copyText: (text: string) => ipcRenderer.invoke('clipboard:text', text),
  showItem: (file: string) => ipcRenderer.invoke('shell:show-item', file),
  openPath: (file: string) => ipcRenderer.invoke('shell:open-path', file),
  mediaUrl: (file: string) => ipcRenderer.invoke('media:url', file),
  onWorkerMessage: (callback: (message: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: unknown) => callback(message)
    ipcRenderer.on('worker:message', listener)
    return () => ipcRenderer.removeListener('worker:message', listener)
  },
  onInstallMessage: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on('engine:install-message', listener)
    return () => ipcRenderer.removeListener('engine:install-message', listener)
  },
})

