import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const destination = path.join(projectRoot, 'release')
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'remixer-package-'))
const temporaryOutput = path.join(temporaryRoot, 'release')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}.`))
    })
  })
}

try {
  await run(process.execPath, [
    path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js'),
    '--win',
    'nsis',
    `--config.directories.output=${temporaryOutput}`,
  ])
  await mkdir(destination, { recursive: true })
  const artifacts = await readdir(temporaryOutput)
  for (const artifact of artifacts) {
    if (!/\.(exe|blockmap|yml)$/i.test(artifact)) continue
    await copyFile(path.join(temporaryOutput, artifact), path.join(destination, artifact))
    console.log(`Copied release artifact: ${artifact}`)
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
