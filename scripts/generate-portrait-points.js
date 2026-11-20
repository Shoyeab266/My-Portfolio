import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const INPUT_PATH = path.join(rootDir, 'private', 'portrait.png')
const OUTPUT_PATH = path.join(rootDir, 'src', 'data', 'portrait-points.json')

// Sampling configuration matching the Hero particle system
const BRIGHTNESS_THRESHOLD = 72
const SAMPLE_WIDTH = 150
const CROP = { x: 0.18, y: 0.02, width: 0.8, height: 0.96 }
const TARGET_PARTICLE_COUNT = 1800

/**
 * Pure Node.js PNG decoder (supports RGB, RGBA, Grayscale, with standard PNG filter unmasking)
 */
function decodePNG(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error('File is not a valid PNG image.')
  }

  let pos = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idatChunks = []

  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos)
    const type = buffer.toString('ascii', pos + 4, pos + 8)
    const data = buffer.subarray(pos + 8, pos + 8 + length)
    pos += 12 + length

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
    } else if (type === 'IDAT') {
      idatChunks.push(data)
    } else if (type === 'IEND') {
      break
    }
  }

  if (!width || !height) {
    throw new Error('Failed to read PNG dimensions from IHDR chunk.')
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks))
  const bpp = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : 2
  const scanlineLen = 1 + width * bpp
  const raw = Buffer.alloc(width * height * 4)

  function paethPredictor(a, b, c) {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    if (pa <= pb && pa <= pc) return a
    if (pb <= pc) return b
    return c
  }

  const prevRow = Buffer.alloc(width * bpp)
  const currRow = Buffer.alloc(width * bpp)

  for (let y = 0; y < height; y += 1) {
    const offset = y * scanlineLen
    const filter = decompressed[offset]

    for (let i = 0; i < width * bpp; i += 1) {
      const byte = decompressed[offset + 1 + i]
      const a = i >= bpp ? currRow[i - bpp] : 0
      const b = prevRow[i]
      const c = i >= bpp ? prevRow[i - bpp] : 0

      let val = 0
      if (filter === 0) val = byte
      else if (filter === 1) val = (byte + a) & 0xff
      else if (filter === 2) val = (byte + b) & 0xff
      else if (filter === 3) val = (byte + Math.floor((a + b) / 2)) & 0xff
      else if (filter === 4) val = (byte + paethPredictor(a, b, c)) & 0xff
      else throw new Error(`Unknown PNG scanline filter: ${filter}`)

      currRow[i] = val

      const px = Math.floor(i / bpp)
      const ch = i % bpp
      const rawIdx = (y * width + px) * 4

      if (colorType === 2) {
        // RGB
        raw[rawIdx + ch] = val
        raw[rawIdx + 3] = 255
      } else if (colorType === 6) {
        // RGBA
        raw[rawIdx + ch] = val
      } else if (colorType === 0) {
        // Grayscale
        raw[rawIdx] = val
        raw[rawIdx + 1] = val
        raw[rawIdx + 2] = val
        raw[rawIdx + 3] = 255
      }
    }
    currRow.copy(prevRow)
  }

  return { width, height, raw }
}

function generatePoints() {
  console.log('--- Generating Particle Portrait Points ---')

  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Error: Portrait file not found at: ${INPUT_PATH}`)
    console.error('Please place your original photo at: private/portrait.png and re-run.')
    process.exit(1)
  }

  const fileBuffer = fs.readFileSync(INPUT_PATH)
  const { width, height, raw } = decodePNG(fileBuffer)
  console.log(`Loaded original image: ${width}x${height}px from ${INPUT_PATH}`)

  const sourceX = Math.round(width * CROP.x)
  const sourceY = Math.round(height * CROP.y)
  const sourceWidth = Math.round(width * CROP.width)
  const sourceHeight = Math.round(height * CROP.height)
  const sampleHeight = Math.max(1, Math.round(SAMPLE_WIDTH * (sourceHeight / sourceWidth)))
  const span = Math.max(SAMPLE_WIDTH, sampleHeight)

  console.log(`Cropped bounds: [x: ${sourceX}, y: ${sourceY}, w: ${sourceWidth}, h: ${sourceHeight}]`)
  console.log(`Sampling grid: ${SAMPLE_WIDTH}x${sampleHeight} cells (span: ${span})`)

  const candidates = []

  for (let y = 0; y < sampleHeight; y += 1) {
    const y0 = Math.floor(sourceY + (y * sourceHeight) / sampleHeight)
    const y1 = Math.min(height, Math.ceil(sourceY + ((y + 1) * sourceHeight) / sampleHeight))

    for (let x = 0; x < SAMPLE_WIDTH; x += 1) {
      const x0 = Math.floor(sourceX + (x * sourceWidth) / SAMPLE_WIDTH)
      const x1 = Math.min(width, Math.ceil(sourceX + ((x + 1) * sourceWidth) / SAMPLE_WIDTH))

      let rSum = 0
      let gSum = 0
      let bSum = 0
      let aSum = 0
      let count = 0

      for (let py = y0; py < y1; py += 1) {
        for (let px = x0; px < x1; px += 1) {
          const idx = (py * width + px) * 4
          rSum += raw[idx]
          gSum += raw[idx + 1]
          bSum += raw[idx + 2]
          aSum += raw[idx + 3]
          count += 1
        }
      }

      const r = count ? rSum / count : 0
      const g = count ? gSum / count : 0
      const b = count ? bSum / count : 0
      const a = count ? aSum / count : 0
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b

      if (a < 20 || brightness < BRIGHTNESS_THRESHOLD) continue

      candidates.push({
        x: Number(((x / SAMPLE_WIDTH - 0.5) * (SAMPLE_WIDTH / span)).toFixed(5)),
        y: Number(((0.5 - y / sampleHeight) * (sampleHeight / span)).toFixed(5)),
      })
    }
  }

  console.log(`Detected ${candidates.length} candidate feature points meeting threshold (>= ${BRIGHTNESS_THRESHOLD})`)

  let picked = []
  if (candidates.length <= TARGET_PARTICLE_COUNT) {
    picked = candidates
  } else {
    const step = candidates.length / TARGET_PARTICLE_COUNT
    for (let i = 0; i < TARGET_PARTICLE_COUNT; i += 1) {
      picked.push(candidates[Math.floor(i * step)])
    }
  }

  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT_PATH)
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(picked, null, 2), 'utf-8')
  console.log(`Successfully exported ${picked.length} particle points to: ${OUTPUT_PATH}`)
  console.log('File size:', (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1), 'KB')
}

generatePoints()
