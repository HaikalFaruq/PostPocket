// Membaca tipe dan dimensi gambar dari isinya, lalu membuang metadata (EXIF, XMP, IPTC, C2PA,
// komentar, gambar kedua) sebagai lapis kedua setelah browser. Yang disimpan hanya bagian yang
// membentuk gambar. Piksel tidak disentuh, jadi tidak ada kompres ulang.

export type ImageType = 'image/jpeg' | 'image/webp' | 'image/png'

export interface ImageInfo {
  type: ImageType
  width: number
  height: number
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const u32le = (b: Uint8Array, i: number) =>
  (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n))

function writeU32le(b: Uint8Array, i: number, value: number) {
  b[i] = value & 0xff
  b[i + 1] = (value >>> 8) & 0xff
  b[i + 2] = (value >>> 16) & 0xff
  b[i + 3] = (value >>> 24) & 0xff
}

// ---------- JPEG ----------

interface JpegSegment {
  marker: number
  start: number
  end: number
}

/** Segmen sebelum data gambar (SOS). `null` kalau strukturnya rusak. */
function jpegSegments(b: Uint8Array): { segments: JpegSegment[]; scan: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  const segments: JpegSegment[] = []
  let i = 2
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null
    const marker = b[i + 1]
    if (marker === 0xff) {
      i++ // byte pengisi
      continue
    }
    if (marker === 0xda) return { segments, scan: i }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    const end = i + 2 + u16be(b, i + 2)
    if (end > b.length) return null
    segments.push({ marker, start: i, end })
    i = end
  }
  return null
}

/** SOF0–SOF15 selain DHT (C4), JPG (C8), dan DAC (CC). */
const isSof = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

function jpegInfo(b: Uint8Array): ImageInfo | null {
  const parsed = jpegSegments(b)
  const sof = parsed?.segments.find((segment) => isSof(segment.marker))
  if (!sof || sof.end - sof.start < 9) return null
  return { type: 'image/jpeg', height: u16be(b, sof.start + 5), width: u16be(b, sof.start + 7) }
}

/**
 * Segmen yang tetap: semua segmen non-APP (tabel, frame), JFIF (APP0), profil warna ICC (APP2
 * "ICC_PROFILE"), dan Adobe (APP14, dibutuhkan untuk warna CMYK). APPn lain dibuang, termasuk
 * EXIF dan XMP (APP1), MPF (APP2, penunjuk gambar kedua), JUMBF/C2PA (APP11), dan IPTC (APP13),
 * juga komentar.
 */
function keepJpegSegment(b: Uint8Array, { marker, start }: JpegSegment): boolean {
  if (marker === 0xfe) return false
  if (marker < 0xe0 || marker > 0xef) return true
  if (marker === 0xe0) return ascii(b, start + 4, 5) === 'JFIF\0'
  if (marker === 0xe2) return ascii(b, start + 4, 12) === 'ICC_PROFILE\0'
  return marker === 0xee
}

const isRst = (marker: number) => marker >= 0xd0 && marker <= 0xd7

/**
 * Posisi tepat setelah EOI gambar utama, mulai dari SOS pertama. Data scan dilewati sampai marker
 * berikutnya (selain isian 0xFF00 dan RST), jadi JPEG progresif dengan banyak scan tetap utuh.
 * Yang sesudah EOI (gambar kedua MPF, video Motion Photo) tidak ikut. Kalau EOI tidak ketemu,
 * berkas dibiarkan sampai habis.
 */
function jpegEnd(b: Uint8Array, scan: number): number {
  let i = scan
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) return b.length
    const marker = b[i + 1]
    if (marker === 0xd9) return i + 2
    if (marker === 0xff) {
      i++ // byte pengisi
      continue
    }
    if (marker === 0x01 || isRst(marker)) {
      i += 2
      continue
    }
    if (i + 4 > b.length) return b.length
    i += 2 + u16be(b, i + 2)
    if (marker !== 0xda) continue
    while (i + 1 < b.length && !(b[i] === 0xff && b[i + 1] !== 0x00 && !isRst(b[i + 1]))) i++
  }
  return b.length
}

function stripJpeg(b: Uint8Array): Uint8Array {
  const parsed = jpegSegments(b)
  if (!parsed) return b
  const kept = parsed.segments.filter((segment) => keepJpegSegment(b, segment))
  const end = jpegEnd(b, parsed.scan)
  if (kept.length === parsed.segments.length && end === b.length) return b
  return concat([
    b.subarray(0, 2),
    ...kept.map((segment) => b.subarray(segment.start, segment.end)),
    b.subarray(parsed.scan, end),
  ])
}

// ---------- WebP ----------

interface Chunk {
  id: string
  start: number
  /** Termasuk byte pengisi kalau ukurannya ganjil. */
  end: number
}

function webpChunks(b: Uint8Array): Chunk[] | null {
  if (b.length < 20 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null
  const chunks: Chunk[] = []
  let i = 12
  while (i + 8 <= b.length) {
    const size = u32le(b, i + 4)
    const end = i + 8 + size + (size & 1)
    if (i + 8 + size > b.length) return null
    chunks.push({ id: ascii(b, i, 4), start: i, end: Math.min(end, b.length) })
    i = end
  }
  return chunks
}

function webpInfo(b: Uint8Array): ImageInfo | null {
  const chunks = webpChunks(b)
  const first = chunks?.[0]
  if (!first) return null
  const d = first.start + 8
  if (first.id === 'VP8X' && first.end - d >= 10) {
    return { type: 'image/webp', width: u24le(b, d + 4) + 1, height: u24le(b, d + 7) + 1 }
  }
  if (first.id === 'VP8 ' && first.end - d >= 10 && b[d + 3] === 0x9d && b[d + 4] === 0x01) {
    return {
      type: 'image/webp',
      width: (b[d + 6] | (b[d + 7] << 8)) & 0x3fff,
      height: (b[d + 8] | (b[d + 9] << 8)) & 0x3fff,
    }
  }
  if (first.id === 'VP8L' && first.end - d >= 5 && b[d] === 0x2f) {
    const bits = u32le(b, d + 1)
    return { type: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  return null
}

/** Chunk yang membentuk gambar. Sisanya dibuang: EXIF, XMP, dan chunk lain seperti C2PA. */
const WEBP_IMAGE = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP'])

function stripWebp(b: Uint8Array): Uint8Array {
  const chunks = webpChunks(b)
  if (!chunks || chunks.every((chunk) => WEBP_IMAGE.has(chunk.id))) return b
  const kept = chunks.filter((chunk) => WEBP_IMAGE.has(chunk.id))
  const out = concat([
    b.subarray(0, 12),
    ...kept.map((chunk) => b.subarray(chunk.start, chunk.end)),
  ])
  writeU32le(out, 4, out.length - 8)
  // Bit EXIF (0x08) dan XMP (0x04) di flag VP8X ikut dimatikan.
  if (ascii(out, 12, 4) === 'VP8X') out[20] &= ~0x0c
  return out
}

// ---------- PNG ----------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function pngChunks(b: Uint8Array): Chunk[] | null {
  if (b.length < 33 || PNG_SIGNATURE.some((byte, i) => b[i] !== byte)) return null
  const chunks: Chunk[] = []
  let i = 8
  while (i + 12 <= b.length) {
    const end = i + 12 + u32be(b, i)
    if (end > b.length) return null
    chunks.push({ id: ascii(b, i + 4, 4), start: i, end })
    i = end
  }
  return chunks
}

function pngInfo(b: Uint8Array): ImageInfo | null {
  const ihdr = pngChunks(b)?.[0]
  if (ihdr?.id !== 'IHDR') return null
  return { type: 'image/png', width: u32be(b, ihdr.start + 8), height: u32be(b, ihdr.start + 12) }
}

/**
 * Chunk kritis, warna, transparansi, dan animasi (APNG). Sisanya dibuang: teks, waktu, EXIF
 * (eXIf), C2PA (caBX), dan chunk privat. Semua yang dibuang chunk tambahan, jadi gambar tetap
 * terbaca.
 */
const PNG_IMAGE = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'cHRM',
  'gAMA',
  'iCCP',
  'sBIT',
  'sRGB',
  'cICP',
  'mDCV',
  'cLLI',
  'bKGD',
  'pHYs',
  'acTL',
  'fcTL',
  'fdAT',
])

function stripPng(b: Uint8Array): Uint8Array {
  const chunks = pngChunks(b)
  if (!chunks || chunks.every((chunk) => PNG_IMAGE.has(chunk.id))) return b
  const kept = chunks.filter((chunk) => PNG_IMAGE.has(chunk.id))
  return concat([b.subarray(0, 8), ...kept.map((chunk) => b.subarray(chunk.start, chunk.end))])
}

// ---------- umum ----------

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** Tipe dan dimensi dari isi berkas, bukan dari nama atau header. `null` kalau tidak dikenal. */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  return jpegInfo(bytes) ?? webpInfo(bytes) ?? pngInfo(bytes)
}

/** Berkas tanpa metadata. Mengembalikan array yang sama kalau tidak ada yang dibuang. */
export function stripMetadata(bytes: Uint8Array, type: ImageType): Uint8Array {
  switch (type) {
    case 'image/jpeg':
      return stripJpeg(bytes)
    case 'image/webp':
      return stripWebp(bytes)
    case 'image/png':
      return stripPng(bytes)
  }
}
