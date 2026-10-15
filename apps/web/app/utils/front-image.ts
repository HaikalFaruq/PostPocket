import type { Raster } from './foil-map'
import { heicToJpeg, isHeic } from './heic'
import type { DraftPhoto } from './letter-draft'

/** Sisi panjang maksimal foto depan setelah dikompres (PRD: 2048 px). */
export const PHOTO_MAX_SIDE = 2048
const PHOTO_MAX_BYTES = 25 * 1024 * 1024

/** Kesalahan yang pesannya aman ditampilkan ke user. */
export class PhotoError extends Error {}

/**
 * Ukuran foto depan yang pas untuk kartu berasio `ratio` (lebar dibagi tinggi): rasionya sama,
 * jadi tidak ada yang terpotong, dan sisi panjangnya sebesar yang disimpan (`PHOTO_MAX_SIDE`).
 */
export function idealPhotoSize(ratio: number): { width: number; height: number } {
  return ratio >= 1
    ? { width: PHOTO_MAX_SIDE, height: Math.round(PHOTO_MAX_SIDE / ratio) }
    : { width: Math.round(PHOTO_MAX_SIDE * ratio), height: PHOTO_MAX_SIDE }
}

/** Rasio dalam bilangan bulat kecil yang dikenal orang, misalnya 1.3333 jadi "4:3". */
export function ratioLabel(ratio: number): string {
  let best = { a: 1, b: 1, error: Infinity }
  for (let b = 1; b <= 16; b++) {
    const a = Math.round(ratio * b)
    const error = Math.abs(a / b - ratio)
    if (a > 0 && error < best.error - 1e-9) best = { a, b, error }
  }
  return `${best.a}:${best.b}`
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError('Foto gagal diproses.'))),
      type,
      quality,
    ),
  )
}

/**
 * Buka foto user sebagai bitmap yang sudah diputar sesuai EXIF. Foto HEIC yang tidak bisa dibuka
 * browser (Chrome, Firefox) diubah dulu ke JPEG di Web Worker; Safari membukanya sendiri.
 */
export async function decodePhoto(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    if (!(await isHeic(file))) {
      throw new PhotoError('Format foto ini belum bisa dibaca. Coba JPG atau PNG.')
    }
  }
  try {
    return await createImageBitmap(await heicToJpeg(file), { imageOrientation: 'from-image' })
  } catch {
    throw new PhotoError('Foto HEIC ini belum bisa dibuka. Coba simpan sebagai JPG dulu.')
  }
}

/**
 * Siapkan foto user untuk gambar depan: putar sesuai EXIF, perkecil, lalu simpan ulang sebagai
 * JPEG. Menyimpan ulang lewat kanvas membuang semua metadata, termasuk lokasi (PRD: privasi).
 */
export async function preparePhoto(file: Blob): Promise<DraftPhoto> {
  if (!file.type.startsWith('image/') && !(await isHeic(file))) {
    throw new PhotoError('Pilih file gambar, misalnya JPG, PNG, WebP, atau HEIC.')
  }
  if (file.size > PHOTO_MAX_BYTES) throw new PhotoError('Foto terlalu besar, maksimal 25 MB.')
  const bitmap = await decodePhoto(file)
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoError('Foto gagal diproses.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return { blob: await toBlob(canvas, 'image/jpeg', 0.86), width, height }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  // Foto surat yang diterima datang dari Storage (domain lain). Tanpa ini kanvas jadi
  // "tercemar" dan peta foil maupun gambar OG gagal dibuat.
  image.crossOrigin = 'anonymous'
  image.decoding = 'async'
  image.src = url
  await image.decode()
  return image
}

/**
 * Ilustrasi untuk mode selain "Sesuai desain": lapisan foil bawaannya dicetak sebagai tinta
 * biasa di atas gambar, supaya bentuk yang hanya ada di lapisan foil (misalnya karangan daun)
 * tidak hilang. Peta foil Detail, Bayangan, dan Satu warna lalu dihitung dari gambar ini.
 */
export async function inkedIllustration(
  artUrl: string,
  foilUrl: string,
  ink: string,
  maxSide = 1440,
): Promise<string> {
  const [art, foil] = await Promise.all([loadImage(artUrl), loadImage(foilUrl)])
  const naturalWidth = art.naturalWidth || 720
  const naturalHeight = art.naturalHeight || 1000
  const scale = maxSide / Math.max(naturalWidth, naturalHeight)
  const width = Math.round(naturalWidth * scale)
  const height = Math.round(naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const layer = document.createElement('canvas')
  layer.width = width
  layer.height = height
  const ctx = canvas.getContext('2d')
  const layerCtx = layer.getContext('2d')
  if (!ctx || !layerCtx) throw new Error('Kanvas tidak tersedia')
  ctx.drawImage(art, 0, 0, width, height)
  layerCtx.drawImage(foil, 0, 0, width, height)
  layerCtx.globalCompositeOperation = 'source-in'
  layerCtx.fillStyle = ink
  layerCtx.fillRect(0, 0, width, height)
  // Sedikit transparan supaya tinta tidak sepekat foil.
  ctx.globalAlpha = 0.88
  ctx.drawImage(layer, 0, 0)
  return URL.createObjectURL(await toBlob(canvas, 'image/png'))
}

/** Gambar ulang `url` dengan sisi panjang maksimal `maxSide`, lalu ambil pikselnya. */
export async function rasterize(url: string, maxSide = 720): Promise<Raster> {
  const image = await loadImage(url)
  const naturalWidth = image.naturalWidth || maxSide
  const naturalHeight = image.naturalHeight || maxSide
  const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight))
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Kanvas tidak tersedia')
  ctx.drawImage(image, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

/** Ubah alpha mask jadi URL gambar PNG untuk CSS `mask-image`. */
export async function maskToUrl(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Kanvas tidak tersedia')
  const image = ctx.createImageData(width, height)
  for (let i = 0; i < alpha.length; i++) image.data[i * 4 + 3] = alpha[i]!
  ctx.putImageData(image, 0, 0)
  return URL.createObjectURL(await toBlob(canvas, 'image/png'))
}
