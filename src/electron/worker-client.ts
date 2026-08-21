import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { randomUUID } from 'node:crypto'

export interface WorkerRequest {
  command: string
  [key: string]: unknown
}

export interface WorkerMessage {
  type: 'ready' | 'progress' | 'result' | 'error' | 'log'
  request_id?: string
  ok?: boolean
  data?: unknown
  error?: string
  stage?: string
  progress?: number
  message?: string
}

interface PendingRequest {
  resolve: (message: WorkerMessage) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export interface PythonLaunch {
  executable: string
  args: string[]
}

const MAC_TOOL_PATHS = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  '/opt/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
]

export function workerEnvironment(base: NodeJS.ProcessEnv = process.env, appDataRoot?: string): NodeJS.ProcessEnv {
  const existing = (base.PATH || '').split(path.delimiter).filter(Boolean)
  const privateTools = appDataRoot ? path.join(appDataRoot, 'engine', 'tools') : null
  if (process.platform !== 'darwin') {
    return {
      ...base,
      PATH: [...new Set([privateTools, ...existing].filter((entry): entry is string => Boolean(entry)))].join(path.delimiter),
    }
  }
  return {
    ...base,
    PATH: [...new Set([privateTools, ...MAC_TOOL_PATHS, ...existing].filter((entry): entry is string => Boolean(entry)))].join(path.delimiter),
  }
}

export function resolvePython(projectRoot: string, appDataRoot: string): PythonLaunch | null {
  const candidates = [
    process.env.REMIXER_PYTHON,
    path.join(appDataRoot, 'engine', '.venv', 'bin', 'python'),
    path.join(projectRoot, '.venv', 'bin', 'python'),
    path.join(appDataRoot, 'engine', '.venv', 'Scripts', 'python.exe'),
    path.join(projectRoot, '.venv', 'Scripts', 'python.exe'),
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const executable of candidates) {
    if (path.isAbsolute(executable) && fs.existsSync(executable)) {
      return { executable, args: [] }
    }
  }
  return null
}

export class WorkerClient extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<string, PendingRequest>()
  private launch: PythonLaunch | null = null

  constructor(
    private readonly workerRoot: string,
    private readonly projectRoot: string,
    private readonly appDataRoot: string,
    private readonly tutorialArchive?: string,
  ) {
    super()
  }

  get isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null
  }

  get pythonPath(): string | null {
    return resolvePython(this.projectRoot, this.appDataRoot)?.executable ?? null
  }

  async start(): Promise<void> {
    if (this.isRunning) return
    this.launch = resolvePython(this.projectRoot, this.appDataRoot)
    if (!this.launch) {
      throw new Error('The Remixer audio engine is not installed yet.')
    }

    const args = [
      ...this.launch.args,
      '-u',
      '-m',
      'remixer_worker',
    ]
    this.process = spawn(this.launch.executable, args, {
      cwd: this.workerRoot,
      env: {
        ...workerEnvironment(process.env, this.appDataRoot),
        PYTHONPATH: this.workerRoot,
        PYTHONUTF8: '1',
        REMIXER_DATA_DIR: path.join(this.appDataRoot, 'data'),
        REMIXER_TUTORIAL_ARCHIVE: this.tutorialArchive,
      },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const stdout = readline.createInterface({ input: this.process.stdout })
    stdout.on('line', (line) => this.handleLine(line))
    this.process.stderr.on('data', (chunk) => {
      this.emit('message', {
        type: 'log',
        message: chunk.toString().trim(),
      } satisfies WorkerMessage)
    })
    this.process.once('error', (error) => this.handleExit(error))
    this.process.once('exit', (code) => {
      this.handleExit(new Error(`Audio engine stopped with code ${code ?? 'unknown'}.`))
    })

    await this.waitUntilReady()
  }

  async request(payload: WorkerRequest, timeoutMs = 24 * 60 * 60 * 1000): Promise<WorkerMessage> {
    await this.start()
    const requestId = randomUUID()
    return await new Promise<WorkerMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error(`Audio engine request timed out: ${payload.command}`))
      }, timeoutMs)
      this.pending.set(requestId, { resolve, reject, timeout })
      this.process!.stdin.write(`${JSON.stringify({ ...payload, request_id: requestId })}\n`)
    })
  }

  stop(): void {
    if (!this.process) return
    this.process.kill()
    this.handleExit(new Error('Audio engine was stopped.'))
  }

  private async waitUntilReady(): Promise<void> {
    if (!this.process) throw new Error('Audio engine did not start.')
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Audio engine did not become ready.')), 30_000)
      const onMessage = (message: WorkerMessage) => {
        if (message.type === 'ready') {
          clearTimeout(timer)
          this.off('message', onMessage)
          resolve()
        }
      }
      this.on('message', onMessage)
      this.process!.once('exit', () => {
        clearTimeout(timer)
        this.off('message', onMessage)
        reject(new Error('Audio engine exited during startup.'))
      })
    })
  }

  private handleLine(line: string): void {
    let message: WorkerMessage
    try {
      message = JSON.parse(line) as WorkerMessage
    } catch {
      message = { type: 'log', message: line }
    }
    this.emit('message', message)

    if ((message.type === 'result' || message.type === 'error') && message.request_id) {
      const pending = this.pending.get(message.request_id)
      if (!pending) return
      clearTimeout(pending.timeout)
      this.pending.delete(message.request_id)
      if (message.type === 'error' || message.ok === false) {
        pending.reject(new Error(message.error || 'Audio engine request failed.'))
      } else {
        pending.resolve(message)
      }
    }
  }

  private handleExit(error: Error): void {
    const process = this.process
    this.process = null
    if (process && process.exitCode === null) process.kill()
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pending.clear()
    this.emit('message', { type: 'error', error: error.message } satisfies WorkerMessage)
  }
}
