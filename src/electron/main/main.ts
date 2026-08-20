import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, protocol, session, shell } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { copyFilesToClipboard, stopMacClipboardHelper } from '../clipboard.js'
import { WorkerClient, WorkerMessage, resolvePython, workerEnvironment } from '../worker-client.js'

app.setName('Remixer')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'remixer-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

const projectRoot = app.isPackaged ? path.dirname(process.execPath) : process.cwd()
const appDataRoot = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Remixer')
  : app.getPath('userData')
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const logFile = path.join(appDataRoot, 'remixer.log')
const workerRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'worker')
  : path.join(projectRoot, 'worker')
const scriptsRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'scripts')
  : path.join(projectRoot, 'scripts')
const macClipboardHelper = app.isPackaged
  ? path.join(process.resourcesPath, 'helpers', 'remixer-file-clipboard')
  : path.join(projectRoot, 'build-tools', 'remixer-file-clipboard')
const tutorialArchive = app.isPackaged
  ? path.join(process.resourcesPath, 'tutorial', 'Down-So-Bad-Tutorial-Project.zip')
  : path.join(projectRoot, 'build-tools', 'Down-So-Bad-Tutorial-Project.zip')

let mainWindow: BrowserWindow | null = null
let worker: WorkerClient | null = null

const YOUTUBE_CLIENT_IDENTITY = 'https://www.givenpeace.com/'

function log(message: string): void {
  fs.mkdirSync(appDataRoot, { recursive: true })
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`, 'utf8')
}

function getWorker(): WorkerClient {
  if (!worker) {
    worker = new WorkerClient(workerRoot, projectRoot, appDataRoot, tutorialArchive)
    worker.on('message', (message: WorkerMessage) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('worker:message', message)
    })
  }
  return worker
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#090b10',
    title: 'Remixer',
    show: false,
    autoHideMenuBar: process.platform === 'win32',
    webPreferences: {
      preload: path.join(moduleDir, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.once('closed', () => { mainWindow = null })
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    log(`Renderer load failed (${code}) ${description}: ${url}`)
    mainWindow?.show()
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  const devUrl = process.env.VITE_DEV_SERVER_URL
  const load = devUrl
    ? mainWindow.loadURL(devUrl)
    : mainWindow.loadFile(path.join(moduleDir, '../../dist-renderer/index.html'))
  void load.catch((error) => log(`Unable to load renderer: ${error instanceof Error ? error.stack : String(error)}`))
}

function installYouTubeClientIdentity(): void {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube-nocookie.com/embed/*'] },
    (details, callback) => {
      // Packaged Electron pages load from file://, which does not provide the
      // HTTP Referer YouTube requires from embedded-player desktop clients.
      // Identify this app with its public first-party site on the frame request.
      details.requestHeaders.Referer = YOUTUBE_CLIENT_IDENTITY
      callback({ requestHeaders: details.requestHeaders })
    },
  )
}

function mediaUrl(file: string): string {
  const token = Buffer.from(path.resolve(file), 'utf8').toString('base64url')
  return `remixer-media://audio/${token}`
}

const AUDIO_MIME_TYPES: Record<string, string> = {
  '.aac': 'audio/aac',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
}

function mediaResponse(request: Request, file: string): Response {
  const stat = fs.statSync(file)
  if (!stat.isFile()) return new Response('Not found', { status: 404 })

  const size = stat.size
  const mime = AUDIO_MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'Content-Type': mime,
  })

  if (request.method === 'HEAD') {
    headers.set('Content-Length', String(size))
    return new Response(null, { status: 200, headers })
  }

  const range = request.headers.get('range')
  let start = 0
  let end = Math.max(0, size - 1)
  let status = 200

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim())
    if (!match || (!match[1] && !match[2])) {
      headers.set('Content-Range', `bytes */${size}`)
      return new Response(null, { status: 416, headers })
    }

    if (!match[1]) {
      const suffixLength = Number(match[2])
      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
        headers.set('Content-Range', `bytes */${size}`)
        return new Response(null, { status: 416, headers })
      }
      start = Math.max(0, size - suffixLength)
    } else {
      start = Number(match[1])
      end = match[2] ? Number(match[2]) : end
    }

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
      headers.set('Content-Range', `bytes */${size}`)
      return new Response(null, { status: 416, headers })
    }
    end = Math.min(end, size - 1)
    status = 206
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  }

  headers.set('Content-Length', String(end - start + 1))
  const stream = fs.createReadStream(file, { start, end })
  return new Response(Readable.toWeb(stream) as ReadableStream, { status, headers })
}

async function installEngine(): Promise<{ ok: true }> {
  const isWindows = process.platform === 'win32'
  const script = path.join(scriptsRoot, isWindows ? 'setup-engine.ps1' : 'setup-engine.sh')
  if (!fs.existsSync(script)) throw new Error(`Engine setup script is missing: ${script}`)

  if (!isWindows && process.platform !== 'darwin') {
    throw new Error(`Engine installation is not supported on ${process.platform}.`)
  }

  await new Promise<void>((resolve, reject) => {
    const executable = isWindows ? 'powershell.exe' : '/bin/bash'
    const args = isWindows
      ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-InstallRoot', path.join(appDataRoot, 'engine')]
      : [script, path.join(appDataRoot, 'engine')]
    const child = spawn(executable, args, {
      cwd: projectRoot,
      env: workerEnvironment(),
      windowsHide: true,
    })
    const relay = (chunk: Buffer) => mainWindow?.webContents.send('engine:install-message', chunk.toString())
    child.stdout.on('data', relay)
    child.stderr.on('data', relay)
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Engine setup exited with code ${code}.`))
    })
  })
  worker?.stop()
  worker = null
  return { ok: true }
}

function installApplicationMenu(): void {
  if (process.platform !== 'darwin') return
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }] },
  ]))
}

app.whenReady().then(async () => {
  installApplicationMenu()
  installYouTubeClientIdentity()
  protocol.handle('remixer-media', (request) => {
    const url = new URL(request.url)
    const token = url.pathname.replace(/^\//, '')
    try {
      const file = Buffer.from(token, 'base64url').toString('utf8')
      if (!path.isAbsolute(file) || !fs.existsSync(file)) {
        return new Response('Not found', { status: 404 })
      }
      return mediaResponse(request, file)
    } catch (error) {
      log(`Media request failed: ${error instanceof Error ? error.message : String(error)}`)
      return new Response('Invalid media URL', { status: 400 })
    }
  })

  ipcMain.handle('engine:status', async () => {
    const python = resolvePython(projectRoot, appDataRoot)
    const platform = process.platform
    const arch = process.arch
    if (!python) return { installed: false, ready: false, python: null, platform, arch }
    try {
      const result = await getWorker().request({ command: 'health' }, 45_000)
      return { installed: true, ready: true, python: python.executable, platform, arch, details: result.data }
    } catch (error) {
      return {
        installed: true,
        ready: false,
        python: python.executable,
        platform,
        arch,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
  ipcMain.handle('engine:install', installEngine)
  ipcMain.handle('dialog:choose-audio', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Choose an audio file',
      properties: ['openFile'],
      filters: [
        { name: 'Audio', extensions: ['wav', 'flac', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'aiff', 'aif'] },
        { name: 'All files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('worker:request', async (_event, request: Record<string, unknown>) => {
    const response = await getWorker().request(request as { command: string })
    return response.data
  })
  ipcMain.handle('worker:stop', () => {
    worker?.stop()
    return { ok: true }
  })
  ipcMain.handle('clipboard:files', async (_event, files: string[]) => {
    await copyFilesToClipboard(files, macClipboardHelper)
    return { ok: true, count: files.length }
  })
  ipcMain.handle('clipboard:text', (_event, text: string) => {
    clipboard.writeText(text)
    return { ok: true }
  })
  ipcMain.handle('shell:show-item', (_event, file: string) => shell.showItemInFolder(path.resolve(file)))
  ipcMain.handle('shell:open-path', (_event, file: string) => shell.openPath(path.resolve(file)))
  ipcMain.handle('media:url', (_event, file: string) => mediaUrl(file))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((error) => {
  log(`Application startup failed: ${error instanceof Error ? error.stack : String(error)}`)
  app.quit()
})

process.on('uncaughtException', (error) => log(`Uncaught exception: ${error.stack || error.message}`))
process.on('unhandledRejection', (reason) => log(`Unhandled rejection: ${String(reason)}`))

app.on('window-all-closed', () => {
  worker?.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  worker?.stop()
  stopMacClipboardHelper()
})
