import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

export async function copyFilesToWindowsClipboard(files: string[]): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('File clipboard copying is currently available on Windows only.')
  }

  const normalized = [...new Set(files.map((file) => path.resolve(file)))]
  if (normalized.length === 0) {
    throw new Error('No files were supplied to the clipboard.')
  }
  for (const file of normalized) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`Cannot copy missing file: ${file}`)
    }
  }

  const entries = normalized.map(quotePowerShell).join(',')
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dropList = New-Object System.Collections.Specialized.StringCollection',
    `$paths = @(${entries})`,
    'foreach ($item in $paths) { [void]$dropList.Add($item) }',
    '[System.Windows.Forms.Clipboard]::SetFileDropList($dropList)',
  ].join('\r\n')
  const encoded = Buffer.from(script, 'utf16le').toString('base64')

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded],
      { windowsHide: true },
    )
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `Clipboard helper exited with code ${code}.`))
    })
  })
}

