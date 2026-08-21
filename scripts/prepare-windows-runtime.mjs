import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const destination = path.join(projectRoot, 'build-tools', 'windows-runtime')

const UV_VERSION = '0.11.21'
const UV_ARCHIVE = 'uv-x86_64-pc-windows-msvc.zip'
const UV_URL = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${UV_ARCHIVE}`
const UV_SHA256 = 'ace861f360c6de2babedc1607d0f454b6b09a820dbc8182dc15af927e4df9589'
const UV_LICENSES = [
  {
    name: 'LICENSE-UV-APACHE-2.0.txt',
    url: `https://raw.githubusercontent.com/astral-sh/uv/${UV_VERSION}/LICENSE-APACHE`,
    sha256: 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4',
  },
  {
    name: 'LICENSE-UV-MIT.txt',
    url: `https://raw.githubusercontent.com/astral-sh/uv/${UV_VERSION}/LICENSE-MIT`,
    sha256: '860e3d7a86b84e6a7012c7a635fc64df475cebc6cce34dfeb73a5982ec58176c',
  },
]

const FFMPEG_TAG = 'autobuild-2026-08-20-13-45'
const FFMPEG_VERSION = 'n8.1.2-44-g7c533d0f86'
const FFMPEG_ARCHIVE = `ffmpeg-${FFMPEG_VERSION}-win64-lgpl-shared-8.1.zip`
const FFMPEG_URL = `https://github.com/BtbN/FFmpeg-Builds/releases/download/${FFMPEG_TAG}/${FFMPEG_ARCHIVE}`
const FFMPEG_SHA256 = 'd311c8c7b86e06b54588e442652f963bae165bd4d8393e73cc9ebb445b025547'

const ROFORMER_COMMIT = 'b0f1386fcced25f559f3e61c9f08a73cd9bddf80'
const ROFORMER_ARCHIVE = `bs-roformer-infer-${ROFORMER_COMMIT}.zip`
const ROFORMER_URL = `https://github.com/openmirlab/bs-roformer-infer/archive/${ROFORMER_COMMIT}.zip`
const ROFORMER_SHA256 = 'f439aec2c157ccb7b7f5c5915332b8b1e9be31ac848e9c97f65ef2880f4c03b6'

const manifest = {
  platform: 'win32',
  arch: 'x64',
  uv: {
    version: UV_VERSION,
    url: UV_URL,
    sha256: UV_SHA256,
    license: 'Apache-2.0 OR MIT',
  },
  ffmpeg: {
    version: FFMPEG_VERSION,
    build_tag: FFMPEG_TAG,
    url: FFMPEG_URL,
    sha256: FFMPEG_SHA256,
    license: 'LGPL-2.1-or-later',
    upstream_source: 'https://github.com/FFmpeg/FFmpeg/commit/7c533d0f86',
  },
  bs_roformer_infer: {
    commit: ROFORMER_COMMIT,
    url: ROFORMER_URL,
    sha256: ROFORMER_SHA256,
    license: 'MIT',
  },
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || projectRoot,
      env: options.env || process.env,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    if (options.capture) {
      child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
      child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    }
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`))
    })
  })
}

async function sha256(file) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(file), hash)
  return hash.digest('hex')
}

async function download(url, destinationPath, expectedSha256) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`Unable to download ${url}: HTTP ${response.status}`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destinationPath))
  const actual = await sha256(destinationPath)
  if (actual !== expectedSha256) {
    throw new Error(`Checksum mismatch for ${path.basename(destinationPath)}: expected ${expectedSha256}, received ${actual}`)
  }
}

function powershellPath() {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows'
  return path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}

async function extractZip(archive, target) {
  await mkdir(target, { recursive: true })
  await run(powershellPath(), [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    '& { param($archive, $target) Expand-Archive -LiteralPath $archive -DestinationPath $target -Force }',
    archive,
    target,
  ])
}

async function filesBelow(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = path.join(relative, entry.name)
    if (entry.isDirectory()) files.push(...await filesBelow(root, child))
    else if (entry.isFile()) files.push(child)
  }
  return files
}

async function writeFileManifest(root) {
  const files = {}
  for (const relative of (await filesBelow(root)).sort()) {
    if (relative === 'runtime-files.json') continue
    files[relative.split(path.sep).join('/')] = await sha256(path.join(root, relative))
  }
  await writeFile(
    path.join(root, 'runtime-files.json'),
    `${JSON.stringify({ algorithm: 'sha256', files }, null, 2)}\n`,
    'utf8',
  )
}

async function verifyFileManifest(root) {
  const fileManifest = JSON.parse(await readFile(path.join(root, 'runtime-files.json'), 'utf8'))
  if (fileManifest.algorithm !== 'sha256' || !fileManifest.files) return false
  for (const [relative, expected] of Object.entries(fileManifest.files)) {
    if (path.isAbsolute(relative) || relative.split('/').includes('..')) return false
    if (await sha256(path.join(root, ...relative.split('/'))) !== expected) return false
  }
  return true
}

async function verifyRuntime(root) {
  const installedManifest = JSON.parse(await readFile(path.join(root, 'runtime.json'), 'utf8'))
  if (JSON.stringify(installedManifest) !== JSON.stringify(manifest)) return false
  if (!(await verifyFileManifest(root))) return false

  const uv = path.join(root, 'uv.exe')
  const ffmpeg = path.join(root, 'ffmpeg', 'ffmpeg.exe')
  const ffprobe = path.join(root, 'ffmpeg', 'ffprobe.exe')
  const uvVersion = await run(uv, ['--version'], { capture: true })
  const ffmpegVersion = await run(ffmpeg, ['-version'], { capture: true })
  const ffprobeVersion = await run(ffprobe, ['-version'], { capture: true })
  if (!uvVersion.stdout.includes(`uv ${UV_VERSION}`)) return false
  if (!ffmpegVersion.stdout.includes(`ffmpeg version ${FFMPEG_VERSION}`)) return false
  if (!ffprobeVersion.stdout.includes(`ffprobe version ${FFMPEG_VERSION}`)) return false

  const buildConfiguration = await run(ffmpeg, ['-buildconf'], { capture: true })
  const configurationText = `${buildConfiguration.stdout}\n${buildConfiguration.stderr}`
  if (/--enable-(?:gpl|nonfree)(?:\s|$)/i.test(configurationText)) return false
  return true
}

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('The bundled Windows runtime must be prepared on 64-bit Windows.')
}

try {
  if (await verifyRuntime(destination)) {
    console.log('Pinned Windows setup tools are already prepared.')
    process.exit(0)
  }
} catch {
  // A partial or stale runtime is rebuilt below.
}

const buildToolsRoot = path.join(projectRoot, 'build-tools')
await mkdir(buildToolsRoot, { recursive: true })
const temporaryRoot = await mkdtemp(path.join(buildToolsRoot, '.windows-runtime-staging-'))
const staging = path.join(temporaryRoot, 'runtime')

try {
  await mkdir(path.join(staging, 'ffmpeg'), { recursive: true })
  await mkdir(path.join(staging, 'licenses'), { recursive: true })
  await mkdir(path.join(staging, 'vendor'), { recursive: true })

  console.log(`Downloading verified uv ${UV_VERSION} for Windows x64...`)
  const uvArchive = path.join(temporaryRoot, UV_ARCHIVE)
  const uvExtracted = path.join(temporaryRoot, 'uv-extracted')
  await download(UV_URL, uvArchive, UV_SHA256)
  await extractZip(uvArchive, uvExtracted)
  await copyFile(path.join(uvExtracted, 'uv.exe'), path.join(staging, 'uv.exe'))
  for (const license of UV_LICENSES) {
    await download(license.url, path.join(staging, 'licenses', license.name), license.sha256)
  }

  console.log(`Downloading verified LGPL FFmpeg ${FFMPEG_VERSION} for Windows x64...`)
  const ffmpegArchive = path.join(temporaryRoot, FFMPEG_ARCHIVE)
  const ffmpegExtracted = path.join(temporaryRoot, 'ffmpeg-extracted')
  await download(FFMPEG_URL, ffmpegArchive, FFMPEG_SHA256)
  await extractZip(ffmpegArchive, ffmpegExtracted)
  const ffmpegRoot = path.join(ffmpegExtracted, FFMPEG_ARCHIVE.replace(/\.zip$/i, ''))
  await cp(path.join(ffmpegRoot, 'bin'), path.join(staging, 'ffmpeg'), { recursive: true })
  await access(path.join(ffmpegRoot, 'LICENSE.txt'))
  await copyFile(path.join(ffmpegRoot, 'LICENSE.txt'), path.join(staging, 'licenses', 'LICENSE-FFMPEG.txt'))

  console.log('Downloading the verified BS-RoFormer inference source...')
  const roformerArchive = path.join(temporaryRoot, ROFORMER_ARCHIVE)
  const roformerExtracted = path.join(temporaryRoot, 'roformer-extracted')
  await download(ROFORMER_URL, roformerArchive, ROFORMER_SHA256)
  await copyFile(roformerArchive, path.join(staging, 'vendor', ROFORMER_ARCHIVE))
  await extractZip(roformerArchive, roformerExtracted)
  const roformerRoot = path.join(roformerExtracted, `bs-roformer-infer-${ROFORMER_COMMIT}`)
  await copyFile(path.join(roformerRoot, 'LICENSE'), path.join(staging, 'licenses', 'LICENSE-BS-ROFORMER-INFER.txt'))

  await writeFile(path.join(staging, 'runtime.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await writeFile(
    path.join(staging, 'README.txt'),
    `Remixer private Windows setup tools\n\nuv ${UV_VERSION}: ${UV_URL}\nLicense: Apache-2.0 OR MIT\n\nFFmpeg ${FFMPEG_VERSION}: ${FFMPEG_URL}\nBuild tag: ${FFMPEG_TAG}\nLicense: LGPL-2.1-or-later; the selected build configuration does not enable GPL or nonfree components.\nUpstream source commit: ${manifest.ffmpeg.upstream_source}\n\nBS-RoFormer-Infer ${ROFORMER_COMMIT}: ${ROFORMER_URL}\nLicense: MIT\n\nEvery downloaded archive and installed runtime file is covered by the SHA-256 manifests in this directory.\n`,
    'utf8',
  )
  await writeFileManifest(staging)

  if (!(await verifyRuntime(staging))) throw new Error('The prepared Windows runtime failed verification.')
  await mkdir(path.dirname(destination), { recursive: true })
  await rm(destination, { recursive: true, force: true })
  await cp(staging, destination, { recursive: true })
  if (!(await verifyRuntime(destination))) throw new Error('The copied Windows runtime failed verification.')
  console.log('Prepared pinned Windows setup tools.')
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
