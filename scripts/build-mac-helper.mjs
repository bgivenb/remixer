import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

if (process.platform !== 'darwin') process.exit(0)

const projectRoot = path.resolve(import.meta.dirname, '..')
const outputDirectory = path.join(projectRoot, 'build-tools')
const output = path.join(outputDirectory, 'remixer-file-clipboard')
await mkdir(outputDirectory, { recursive: true })

await new Promise((resolve, reject) => {
  const child = spawn('/usr/bin/xcrun', [
    'swiftc',
    '-O',
    '-target',
    'arm64-apple-macosx12.0',
    '-framework',
    'AppKit',
    path.join(projectRoot, 'scripts', 'macos-file-clipboard.swift'),
    '-o',
    output,
  ], { cwd: projectRoot, stdio: 'inherit' })
  child.once('error', reject)
  child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`swiftc exited with code ${code}.`)))
})

console.log(`Built macOS clipboard helper: ${output}`)
