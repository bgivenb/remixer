import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

export async function copyFilesToWindowsClipboard(files: string[]): Promise<void> {
  const normalized = validateFiles(files)
  if (process.platform !== 'win32') throw new Error('Windows file clipboard is unavailable on this platform.')

  const entries = normalized.map(quotePowerShell).join(',')
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dropList = New-Object System.Collections.Specialized.StringCollection',
    `$paths = @(${entries})`,
    'foreach ($item in $paths) { [void]$dropList.Add($item) }',
    '[System.Windows.Forms.Clipboard]::SetFileDropList($dropList)',
  ].join('\r\n')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')

  await runClipboardHelper(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded],
    { windowsHide: true },
  )
}

function validateFiles(files: string[]): string[] {
  const normalized = [...new Set(files.map((file) => path.resolve(file)))]
  if (normalized.length === 0) {
    throw new Error('No files were supplied to the clipboard.')
  }
  for (const file of normalized) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`Cannot copy missing file: ${file}`)
    }
  }
  return normalized
}

export async function copyFilesToMacClipboard(files: string[], helperPath?: string): Promise<void> {
  const normalized = validateFiles(files)
  if (process.platform !== 'darwin') throw new Error('macOS file clipboard is unavailable on this platform.')
  if (!helperPath || !fs.existsSync(helperPath)) {
    throw new Error('The macOS file clipboard helper is missing. Rebuild or reinstall Remixer.')
  }
  stopMacClipboardHelper()
  await new Promise<void>((resolve, reject) => {
    const child = spawn(helperPath, normalized, { stdio: ['ignore', 'pipe', 'pipe'] })
    macClipboardProcess = child
    let settled = false
    let stderr = ''
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      if (macClipboardProcess === child) macClipboardProcess = null
      reject(error)
    }
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.stdout.on('data', (chunk) => {
      if (settled || !chunk.toString().includes('READY')) return
      settled = true
      child.stdout.destroy()
      child.stderr.destroy()
      child.unref()
      resolve()
    })
    child.once('error', fail)
    child.once('exit', (code) => {
      if (macClipboardProcess === child) macClipboardProcess = null
      if (!settled) fail(new Error(stderr.trim() || `macOS clipboard helper exited with code ${code}.`))
    })
  })
}

let macClipboardProcess: ReturnType<typeof spawn> | null = null

export function stopMacClipboardHelper(): void {
  if (!macClipboardProcess) return
  macClipboardProcess.kill()
  macClipboardProcess = null
}

export async function copyFilesToClipboard(files: string[], macHelperPath?: string): Promise<void> {
  if (process.platform === 'win32') return copyFilesToWindowsClipboard(files)
  if (process.platform === 'darwin') return copyFilesToMacClipboard(files, macHelperPath)
  throw new Error('Copying files to the clipboard is not supported on this platform.')
}

function runClipboardHelper(
  executable: string,
  args: string[],
  options: { windowsHide?: boolean } = {},
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, options)
    let stdout = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || stdout.trim() || `Clipboard helper exited with code ${code}.`))
    })
  })
}
