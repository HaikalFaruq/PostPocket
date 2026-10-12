// Gambar buatan untuk test. Isinya bukan piksel yang bisa ditampilkan, tapi strukturnya
// (marker JPEG, chunk WebP dan PNG) sama dengan berkas asli, dan itu yang dibaca server.

function bytes(...parts: (number[] | Uint8Array | string)[]): Uint8Array<ArrayBuffer> {
  const flat: number[] = []
  for (const part of parts) {
    if (typeof part === 'string') flat.push(...new TextEncoder().encode(part))
    else flat.push(...part)
  }
  return new Uint8Array(flat)
}

const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff]
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]

/** Segmen JPEG: marker + panjang + isi. */
const segment = (marker: number, body: number[] | Uint8Array) => [
  0xff,
  marker,
  ...be16(body.length + 2),
  ...body,
]

/** JPEG dengan APP1 berisi "lokasi" palsu kalau `exif` diisi. `pad` menambah data scan. */
export function jpeg(
  width: number,
  height: number,
  options: { exif?: boolean; pad?: number } = {},
) {
  return bytes(
    [0xff, 0xd8],
    segment(0xe0, [...new TextEncoder().encode('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    options.exif ? segment(0xe1, [...new TextEncoder().encode('Exif\0\0GPS-6.2,106.8')]) : [],
    segment(0xdb, new Array(65).fill(1)),
    segment(0xc0, [8, ...be16(height), ...be16(width), 1, 1, 0x11, 0]),
    segment(0xda, [1, 1, 0, 0, 0x3f, 0]),
    new Array(options.pad ?? 32).fill(0x55),
    [0xff, 0xd9],
  )
}

function riff(chunks: Uint8Array[]): Uint8Array {
  const body = bytes('WEBP', ...chunks)
  return bytes('RIFF', le32(body.length), body)
}

function chunk(id: string, data: number[] | Uint8Array): Uint8Array {
  return bytes(id, le32(data.length), data, data.length % 2 ? [0] : [])
}

/** WebP lossy (VP8) sederhana, atau VP8X dengan chunk EXIF kalau `exif` diisi. */
export function webp(width: number, height: number, options: { exif?: boolean } = {}) {
  const vp8 = chunk('VP8 ', [
    0,
    0,
    0,
    0x9d,
    0x01,
    0x2a,
    ...le16(width),
    ...le16(height),
    ...new Array(20).fill(0x11),
  ])
  if (!options.exif) return riff([vp8])
  const vp8x = chunk('VP8X', [0x08, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)])
  return riff([vp8x, vp8, chunk('EXIF', [...new TextEncoder().encode('MM\0*GPS')])])
}

/** PNG dengan chunk tEXt kalau `text` diisi. CRC tidak dihitung karena server tidak membacanya. */
export function png(width: number, height: number, options: { text?: boolean } = {}) {
  const pngChunk = (id: string, data: number[]) => bytes(be32(data.length), id, data, [0, 0, 0, 0])
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    pngChunk('IHDR', [...be32(width), ...be32(height), 8, 2, 0, 0, 0]),
    options.text ? pngChunk('tEXt', [...new TextEncoder().encode('Comment\0rahasia')]) : [],
    pngChunk('IDAT', [1, 2, 3, 4]),
    pngChunk('IEND', []),
  )
}

export const design = {
  illustration: 'meadow',
  shape: 'portrait',
  foilMode: 'detail',
  foilBorder: true,
  foilColor: 'gold',
  paper: 'cream',
  template: 'photo-1',
}

export const content = {
  version: 1,
  elements: [
    {
      kind: 'photo',
      id: 'e1',
      x: 0.5,
      y: 0.32,
      width: 0.7,
      rotation: -3,
      photo: 'p1',
      aspect: 1.33,
    },
    {
      kind: 'text',
      id: 'e2',
      x: 0.5,
      y: 0.72,
      width: 0.8,
      rotation: 0,
      text: 'Selamat ulang tahun!',
      size: 0.07,
      align: 'center',
    },
  ],
}

const meta = (type: string, file: Uint8Array, width: number, height: number) => ({
  type,
  width,
  height,
  size: file.length,
})

/** Berkas dan body `POST /letters` yang valid untuk surat dengan satu foto. */
export function letterFixture() {
  const photo = jpeg(800, 600, { exif: true, pad: 200 })
  const og = jpeg(1200, 630)
  return {
    files: { photo, og },
    body: {
      design,
      content,
      cover: null,
      photos: [{ key: 'p1', ...meta('image/jpeg', photo, 800, 600) }],
      og: meta('image/jpeg', og, 1200, 630),
      replyTo: null as string | null,
    },
  }
}
