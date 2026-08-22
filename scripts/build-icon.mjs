import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { deflateSync, inflateSync } from 'node:zlib'
import path from 'node:path'

const FAVICON_SHA256 = 'de165817dd3665ccb43f7afbe3400a80bd2595a97cf0be4079320333040c50b7'
const projectRoot = path.resolve(import.meta.dirname, '..')
const source = path.join(projectRoot, 'assets', 'given-peace-favicon.base64')
const output = path.join(projectRoot, 'build-tools', 'remixer-icon.png')
const png = Buffer.from((await readFile(source, 'utf8')).replace(/\s/g, ''), 'base64')
const checksum = createHash('sha256').update(png).digest('hex')

if (checksum !== FAVICON_SHA256) {
  throw new Error(`Given Peace favicon checksum mismatch: expected ${FAVICON_SHA256}, received ${checksum}`)
}
if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
  throw new Error('The Given Peace favicon is not a PNG image.')
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
  const checksumBuffer = Buffer.alloc(4)
  checksumBuffer.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksumBuffer])
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft
  const leftDistance = Math.abs(estimate - left)
  const aboveDistance = Math.abs(estimate - above)
  const upperLeftDistance = Math.abs(estimate - upperLeft)
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left
  return aboveDistance <= upperLeftDistance ? above : upperLeft
}

function decodeRgbaPng(input) {
  const width = input.readUInt32BE(16)
  const height = input.readUInt32BE(20)
  if (input[24] !== 8 || input[25] !== 6 || input[28] !== 0) {
    throw new Error('The Given Peace favicon must be a non-interlaced 8-bit RGBA PNG.')
  }

  const compressed = []
  let offset = 8
  while (offset < input.length) {
    const length = input.readUInt32BE(offset)
    const type = input.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') compressed.push(input.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }

  const filtered = inflateSync(Buffer.concat(compressed))
  const stride = width * 4
  const pixels = Buffer.alloc(stride * height)
  let sourceOffset = 0
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[sourceOffset]
    sourceOffset += 1
    for (let x = 0; x < stride; x += 1) {
      const encoded = filtered[sourceOffset + x]
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0
      const above = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : filter === 4 ? paeth(left, above, upperLeft)
                : null
      if (predictor === null) throw new Error(`Unsupported PNG filter ${filter}.`)
      pixels[y * stride + x] = (encoded + predictor) & 0xff
    }
    sourceOffset += stride
  }
  return { width, height, pixels }
}

function resizeRgba(sourceImage, targetSize) {
  const output = Buffer.alloc(targetSize * targetSize * 4)
  for (let y = 0; y < targetSize; y += 1) {
    const sourceY = Math.max(0, Math.min(sourceImage.height - 1, ((y + 0.5) * sourceImage.height / targetSize) - 0.5))
    const y0 = Math.floor(sourceY)
    const y1 = Math.min(sourceImage.height - 1, y0 + 1)
    const yWeight = sourceY - y0
    for (let x = 0; x < targetSize; x += 1) {
      const sourceX = Math.max(0, Math.min(sourceImage.width - 1, ((x + 0.5) * sourceImage.width / targetSize) - 0.5))
      const x0 = Math.floor(sourceX)
      const x1 = Math.min(sourceImage.width - 1, x0 + 1)
      const xWeight = sourceX - x0
      for (let channel = 0; channel < 4; channel += 1) {
        const topLeft = sourceImage.pixels[(y0 * sourceImage.width + x0) * 4 + channel]
        const topRight = sourceImage.pixels[(y0 * sourceImage.width + x1) * 4 + channel]
        const bottomLeft = sourceImage.pixels[(y1 * sourceImage.width + x0) * 4 + channel]
        const bottomRight = sourceImage.pixels[(y1 * sourceImage.width + x1) * 4 + channel]
        const top = topLeft + (topRight - topLeft) * xWeight
        const bottom = bottomLeft + (bottomRight - bottomLeft) * xWeight
        output[(y * targetSize + x) * 4 + channel] = Math.round(top + (bottom - top) * yWeight)
      }
    }
  }
  return output
}

function encodeRgbaPng(pixels, size) {
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
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const sourceImage = decodeRgbaPng(png)
const appIcon = encodeRgbaPng(resizeRgba(sourceImage, 512), 512)
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, appIcon)
console.log(`Built Remixer application icon from the Given Peace favicon: ${output}`)
