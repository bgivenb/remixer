import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const size = 512
const pixels = Buffer.alloc(size * size * 4)

function roundedRect(x, y, inset, radius) {
  const minimum = inset
  const maximum = size - inset - 1
  if (x < minimum || x > maximum || y < minimum || y > maximum) return false
  const nearestX = Math.max(minimum + radius, Math.min(x, maximum - radius))
  const nearestY = Math.max(minimum + radius, Math.min(y, maximum - radius))
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2
}

function circle(x, y, centerX, centerY, radius) {
  return (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2
}

function capsule(x, y, centerX, centerY, width, height) {
  const radius = width / 2
  const halfBody = Math.max(0, (height - width) / 2)
  const nearestY = Math.max(centerY - halfBody, Math.min(y, centerY + halfBody))
  return (x - centerX) ** 2 + (y - nearestY) ** 2 <= radius ** 2
}

const bars = [
  { x: 176, height: 96 },
  { x: 216, height: 178 },
  { x: 256, height: 250 },
  { x: 296, height: 178 },
  { x: 336, height: 96 },
]

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const offset = (y * size + x) * 4
    const insideTile = roundedRect(x, y, 24, 86)
    const insideDisc = circle(x, y, 256, 256, 172)
    const insideWave = bars.some((bar) => capsule(x, y, bar.x, 256, 24, bar.height))
    const white = insideDisc && !insideWave
    pixels[offset] = white ? 255 : 0
    pixels[offset + 1] = white ? 255 : 0
    pixels[offset + 2] = white ? 255 : 0
    pixels[offset + 3] = insideTile ? 255 : 0
  }
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}

const header = Buffer.alloc(13)
header.writeUInt32BE(size, 0)
header.writeUInt32BE(size, 4)
header[8] = 8
header[9] = 6

const scanlines = Buffer.alloc((size * 4 + 1) * size)
for (let y = 0; y < size; y += 1) {
  const destination = y * (size * 4 + 1)
  scanlines[destination] = 0
  pixels.copy(scanlines, destination + 1, y * size * 4, (y + 1) * size * 4)
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(scanlines, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const projectRoot = path.resolve(import.meta.dirname, '..')
const output = path.join(projectRoot, 'build-tools', 'remixer-icon.png')
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, png)
console.log(`Built Remixer application icon: ${output}`)
