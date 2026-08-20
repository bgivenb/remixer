import { spawn } from 'node:child_process'
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

const VIDEO_ID = 'JR2zel8dJts'
const projectRoot = path.resolve(import.meta.dirname, '..')
const output = path.join(projectRoot, 'build-tools', 'Down-So-Bad-Tutorial-Project.zip')
const defaultSource = path.join(os.homedir(), 'Library', 'Application Support', 'Remixer', 'data', 'tracks', 'Given Peace - Down So Bad (Official Music Video)-JR2zel8dJts')
const source = path.resolve(process.env.REMIXER_TUTORIAL_SOURCE || defaultSource)
const fallbackUrl = process.env.REMIXER_TUTORIAL_ARCHIVE_URL || 'https://github.com/bgivenb/remixer/releases/download/v0.1.1/Down-So-Bad-Tutorial-Project.zip'
const expectedArchiveSha256 = 'b46e071e884d47370fd80b3f21f09b011c4ca266cddbb1a8eeb857042b659ce7'

async function exists(file) {
  try { await access(file); return true } catch { return false }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)))
  })
}

function replaceProjectPaths(value) {
  if (Array.isArray(value)) return value.map(replaceProjectPaths)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceProjectPaths(item)]))
  if (typeof value === 'string' && value.startsWith(source)) return `__TRACK_DIR__${value.slice(source.length)}`
  return value
}

if (!await exists(path.join(source, 'track.json'))) {
  if (await exists(output)) {
    console.log(`Using existing tutorial archive: ${output}`)
    process.exit(0)
  }
  console.log(`Downloading the verified tutorial base asset from ${fallbackUrl}`)
  const response = await fetch(fallbackUrl)
  if (!response.ok) throw new Error(`Tutorial asset download failed with HTTP ${response.status}. Set REMIXER_TUTORIAL_SOURCE or REMIXER_TUTORIAL_ARCHIVE_URL to override it.`)
  const archive = Buffer.from(await response.arrayBuffer())
  const actualSha256 = createHash('sha256').update(archive).digest('hex')
  if (actualSha256 !== expectedArchiveSha256) throw new Error(`Tutorial archive checksum mismatch: expected ${expectedArchiveSha256}, received ${actualSha256}`)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, archive)
  console.log(`Downloaded verified tutorial project: ${output}`)
  process.exit(0)
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'remixer-tutorial-'))
const tutorialRoot = path.join(temporaryRoot, 'Down-So-Bad-Tutorial-Project')
await mkdir(tutorialRoot, { recursive: true })
await mkdir(path.dirname(output), { recursive: true })

try {
  const manifest = JSON.parse(await readFile(path.join(source, 'track.json'), 'utf8'))
  if (manifest.id !== VIDEO_ID || !manifest.working_path) {
    throw new Error('The tutorial source must be the Down So Bad project with its base track available.')
  }

  const assets = [
    [manifest.working_path, path.join(tutorialRoot, 'working.wv')],
  ]
  for (const [input, destination] of assets) {
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map_metadata', '-1', '-c:a', 'wavpack', destination])
  }

  const thumbnail = manifest.thumbnail_path && await exists(manifest.thumbnail_path) ? manifest.thumbnail_path : null
  if (thumbnail) await copyFile(thumbnail, path.join(tutorialRoot, `thumbnail${path.extname(thumbnail).toLowerCase()}`))

  const template = replaceProjectPaths(manifest)
  template.track_dir = '__TRACK_DIR__'
  template.source_path = '__TRACK_DIR__/working.wav'
  template.working_path = '__TRACK_DIR__/working.wav'
  template.thumbnail_path = thumbnail ? `__TRACK_DIR__/thumbnail${path.extname(thumbnail).toLowerCase()}` : null
  template.tutorial = true
  template.analysis = null
  template.stem_sets = {}
  await writeFile(path.join(tutorialRoot, 'track.template.json'), `${JSON.stringify(template, null, 2)}\n`)
  await writeFile(path.join(tutorialRoot, 'TUTORIAL_NOTICE.txt'), 'Down So Bad by Given Peace. Bundled by the artist for use as the Remixer tutorial project. All rights reserved; redistribution outside the Remixer application is not granted.\n')

  await rm(output, { force: true })
  if (process.platform === 'darwin') {
    await run('/usr/bin/ditto', ['--norsrc', '-c', '-k', '--keepParent', tutorialRoot, output])
  } else if (process.platform === 'win32') {
    await run('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${tutorialRoot.replaceAll("'", "''")}' -DestinationPath '${output.replaceAll("'", "''")}' -Force`])
  } else {
    await run('zip', ['-q', '-r', output, path.basename(tutorialRoot)], { cwd: temporaryRoot })
  }
  console.log(`Built tutorial project: ${output}`)
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
