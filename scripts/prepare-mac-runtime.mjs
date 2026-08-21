import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const destination = path.join(projectRoot, 'build-tools', 'mac-runtime')

const UV_VERSION = '0.11.21'
const UV_ARCHIVE = 'uv-aarch64-apple-darwin.tar.gz'
const UV_URL = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${UV_ARCHIVE}`
const UV_SHA256 = '1f921d491ba5ffeea774eb04d6681ecee379101341cbb1500394993b541bf3f4'

const FFMPEG_VERSION = '8.1.2'
const FFMPEG_ARCHIVE = `ffmpeg-${FFMPEG_VERSION}.tar.xz`
const FFMPEG_URL = `https://ffmpeg.org/releases/${FFMPEG_ARCHIVE}`
const FFMPEG_SHA256 = '464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c'

const manifest = {
  platform: 'darwin',
  arch: 'arm64',
  minimum_macos: '12.0',
  uv: { version: UV_VERSION, url: UV_URL, sha256: UV_SHA256 },
  ffmpeg: {
    version: FFMPEG_VERSION,
    url: FFMPEG_URL,
    sha256: FFMPEG_SHA256,
    license: 'LGPL-2.1-or-later',
  },
  realpath: { source: 'native/mac-realpath/main.c', minimum_macos: '12.0' },
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || projectRoot,
      env: options.env || process.env,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
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
  return createHash('sha256').update(await readFile(file)).digest('hex')
}

async function download(url, destinationPath, expectedSha256) {
  await run('curl', ['--fail', '--location', '--silent', '--show-error', url, '--output', destinationPath])
  const actual = await sha256(destinationPath)
  if (actual !== expectedSha256) {
    throw new Error(`Checksum mismatch for ${path.basename(destinationPath)}: expected ${expectedSha256}, received ${actual}`)
  }
}

async function verifyRuntime(root) {
  const uv = path.join(root, 'uv')
  const ffmpeg = path.join(root, 'ffmpeg')
  const ffprobe = path.join(root, 'ffprobe')
  const realpath = path.join(root, 'realpath')
  const installedManifest = JSON.parse(await readFile(path.join(root, 'runtime.json'), 'utf8'))
  if (JSON.stringify(installedManifest) !== JSON.stringify(manifest)) return false

  const uvVersion = await run(uv, ['--version'], { capture: true })
  const ffmpegVersion = await run(ffmpeg, ['-version'], { capture: true })
  const ffprobeVersion = await run(ffprobe, ['-version'], { capture: true })
  if (!uvVersion.stdout.includes(`uv ${UV_VERSION}`)) return false
  if (!ffmpegVersion.stdout.includes(`ffmpeg version ${FFMPEG_VERSION}`)) return false
  if (!ffprobeVersion.stdout.includes(`ffprobe version ${FFMPEG_VERSION}`)) return false
  const resolvedProject = await run(realpath, [projectRoot], { capture: true })
  if (resolvedProject.stdout.trim() !== projectRoot) return false

  for (const executable of [uv, ffmpeg, ffprobe, realpath]) {
    const file = await run('file', [executable], { capture: true })
    if (!file.stdout.includes('arm64')) return false
  }
  for (const executable of [ffmpeg, ffprobe]) {
    const linked = await run('otool', ['-L', executable], { capture: true })
    if (/\/opt\/homebrew|\/usr\/local|@rpath/.test(linked.stdout)) return false
  }
  return true
}

if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('The bundled Mac runtime must be prepared on an Apple Silicon Mac.')
}

try {
  if (await verifyRuntime(destination)) {
    console.log('Pinned Apple Silicon setup tools are already prepared.')
    process.exit(0)
  }
} catch {
  // A partial or stale runtime is rebuilt below.
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'remixer-mac-runtime-'))
const staging = path.join(temporaryRoot, 'runtime')

try {
  await mkdir(staging, { recursive: true })

  console.log(`Downloading verified uv ${UV_VERSION} for Apple Silicon...`)
  const uvArchive = path.join(temporaryRoot, UV_ARCHIVE)
  await download(UV_URL, uvArchive, UV_SHA256)
  await run('tar', ['-xzf', uvArchive, '-C', temporaryRoot])
  await copyFile(path.join(temporaryRoot, 'uv-aarch64-apple-darwin', 'uv'), path.join(staging, 'uv'))

  console.log(`Building a private LGPL FFmpeg ${FFMPEG_VERSION} runtime for macOS 12+...`)
  const ffmpegArchive = path.join(temporaryRoot, FFMPEG_ARCHIVE)
  await download(FFMPEG_URL, ffmpegArchive, FFMPEG_SHA256)
  await run('tar', ['-xJf', ffmpegArchive, '-C', temporaryRoot])
  const ffmpegSource = path.join(temporaryRoot, `ffmpeg-${FFMPEG_VERSION}`)
  await run('./configure', [
    '--arch=arm64',
    '--target-os=darwin',
    '--cc=clang',
    '--disable-autodetect',
    '--disable-network',
    '--disable-shared',
    '--enable-static',
    '--disable-debug',
    '--disable-doc',
    '--disable-ffplay',
    '--disable-sdl2',
    '--disable-xlib',
    '--enable-pthreads',
    '--extra-cflags=-mmacosx-version-min=12.0',
    '--extra-ldflags=-mmacosx-version-min=12.0',
  ], { cwd: ffmpegSource })
  await run('make', [`-j${Math.max(2, os.cpus().length)}`, 'ffmpeg', 'ffprobe'], { cwd: ffmpegSource })
  await copyFile(path.join(ffmpegSource, 'ffmpeg'), path.join(staging, 'ffmpeg'))
  await copyFile(path.join(ffmpegSource, 'ffprobe'), path.join(staging, 'ffprobe'))
  await copyFile(path.join(ffmpegSource, 'COPYING.LGPLv2.1'), path.join(staging, 'COPYING.LGPLv2.1'))
  await copyFile(path.join(ffmpegSource, 'COPYING.LGPLv3'), path.join(staging, 'COPYING.LGPLv3'))

  console.log('Building the private macOS 12 realpath compatibility helper...')
  await run('clang', [
    '-Os',
    '-mmacosx-version-min=12.0',
    path.join(projectRoot, 'native', 'mac-realpath', 'main.c'),
    '-o',
    path.join(staging, 'realpath'),
  ])

  for (const executable of ['uv', 'ffmpeg', 'ffprobe', 'realpath']) {
    await chmod(path.join(staging, executable), 0o755)
  }
  await writeFile(path.join(staging, 'runtime.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await writeFile(
    path.join(staging, 'README.txt'),
    `Remixer private setup tools\n\nuv ${UV_VERSION}: ${UV_URL}\nLicense: Apache-2.0 OR MIT\n\nFFmpeg ${FFMPEG_VERSION}: ${FFMPEG_URL}\nConfiguration: LGPL-2.1-or-later, static FFmpeg libraries, macOS system libraries only, network disabled.\nThe exact upstream source archive SHA-256 is ${FFMPEG_SHA256}.\n\nrealpath: Remixer-owned compatibility helper built from native/mac-realpath/main.c for macOS 12.\n`,
    'utf8',
  )

  if (!(await verifyRuntime(staging))) throw new Error('The prepared Mac runtime failed verification.')
  await mkdir(path.dirname(destination), { recursive: true })
  await rm(destination, { recursive: true, force: true })
  await rename(staging, destination)
  console.log('Prepared pinned Apple Silicon setup tools.')
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
