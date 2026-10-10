import type { FoilColor, Paper } from '@postpocket/presets'
import type { UploadImage } from './letter-api'

/** Batas kontrak API untuk cover dan foto isi surat. */
export const UPLOAD_MAX_BYTES = 500_000
export const UPLOAD_MAX_SIDE = 2048
/** Batas gambar OG supaya tetap tampil di WhatsApp. */
export const OG_MAX_BYTES = 300_000
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Kanvas tidak tersedia')
  return { canvas, ctx }
}

function jpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Gambar gagal disimpan'))),
      'image/jpeg',
      quality,
    ),
  )
}

/**
 * Turunkan kualitas JPEG, lalu ukurannya, sampai di bawah `maxBytes`. Selalu JPEG karena Safari
 * belum bisa menyimpan WebP dari kanvas (hasilnya diam-diam jadi PNG).
 */
async function shrink(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  width: number,
  height: number,
  maxBytes: number,
  minScale = 0.3,
): Promise<UploadImage> {
  let scale = 1
  for (;;) {
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const { canvas, ctx } = canvasOf(w, h)
    draw(ctx, w, h)
    for (const quality of [0.86, 0.78, 0.7, 0.62]) {
      const blob = await jpeg(canvas, quality)
      if (blob.size <= maxBytes || (scale <= minScale && quality === 0.62)) {
        return { blob, type: 'image/jpeg', width: w, height: h, size: blob.size }
      }
    }
    scale *= 0.85
  }
}

/**
 * Siapkan foto untuk diunggah: JPEG dengan sisi panjang maksimal 2048 px dan di bawah 500.000
 * byte. Foto dari `preparePhoto()` yang sudah memenuhi syarat dikirim apa adanya; metadata EXIF
 * sudah dibuang di sana.
 */
export async function compressPhoto(
  photo: { blob: Blob; width: number; height: number },
  maxBytes = UPLOAD_MAX_BYTES,
): Promise<UploadImage> {
  const { blob, width, height } = photo
  const fits = Math.max(width, height) <= UPLOAD_MAX_SIDE
  if (blob.type === 'image/jpeg' && blob.size <= maxBytes && fits) {
    return { blob, type: blob.type, width, height, size: blob.size }
  }
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  try {
    return await shrink(
      (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      bitmap.width * scale,
      bitmap.height * scale,
      maxBytes,
    )
  } finally {
    bitmap.close()
  }
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

/** Gambar `image` menutupi kotak (seperti `object-fit: cover`). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  const scale = Math.max(width / naturalWidth, height / naturalHeight)
  const w = naturalWidth * scale
  const h = naturalHeight * scale
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h)
}

/** Kotak bersudut bulat. Tanpa `ctx.roundRect`, yang baru ada sejak Safari 16. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Gradien logam foil, sama arah dan warnanya dengan kartu di layar. */
function metal(ctx: CanvasRenderingContext2D, foil: FoilColor, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  const stops = foil.spectrum?.length
    ? foil.spectrum
    : [foil.shade, foil.base, foil.light, foil.base, foil.shade]
  stops.forEach((color, i) => gradient.addColorStop(i / (stops.length - 1), color))
  return gradient
}

export interface OgCard {
  /** Gambar cetak sampul (sama dengan `art` di kartu). */
  art?: string
  /** Mask foil (sama dengan `foilMask` di kartu). */
  foilMask?: string
  foil: FoilColor
  paper: Paper
  /** Lebar dibagi tinggi kartu. */
  ratio: number
  foilBorder?: boolean
}

/**
 * Gambar OG surat: sampul kartu tertutup di atas latar kanvas, JPEG 1200×630 di bawah 300.000
 * byte. Dirender di browser waktu "Buat link" dari gambar cetak dan mask foil yang sama dengan
 * kartu di layar, jadi pratinjau WhatsApp sama dengan yang dibuka penerima.
 */
export async function renderOgImage(card: OgCard): Promise<UploadImage> {
  const [art, mask] = await Promise.all([
    card.art ? loadImage(card.art) : null,
    card.foilMask ? loadImage(card.foilMask) : null,
  ])
  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const unit = width / OG_WIDTH
    ctx.fillStyle = '#f5f5f3'
    ctx.fillRect(0, 0, width, height)
    const maxH = 540 * unit
    const maxW = 980 * unit
    const cardH = Math.min(maxH, maxW / card.ratio)
    const cardW = cardH * card.ratio
    const x = (width - cardW) / 2
    const y = (height - cardH) / 2
    const radius = 6 * unit

    ctx.save()
    ctx.shadowColor = 'rgb(17 17 20 / 0.35)'
    ctx.shadowBlur = 44 * unit
    ctx.shadowOffsetY = 18 * unit
    ctx.fillStyle = card.paper.color
    roundedRect(ctx, x, y, cardW, cardH, radius)
    ctx.fill()
    ctx.restore()

    ctx.save()
    roundedRect(ctx, x, y, cardW, cardH, radius)
    ctx.clip()
    if (art) drawCover(ctx, art, x, y, cardW, cardH)
    if (mask) {
      const layer = canvasOf(Math.round(cardW), Math.round(cardH))
      layer.ctx.fillStyle = metal(layer.ctx, card.foil, cardW, cardH)
      layer.ctx.fillRect(0, 0, cardW, cardH)
      layer.ctx.globalCompositeOperation = 'destination-in'
      drawCover(layer.ctx, mask, 0, 0, cardW, cardH)
      ctx.drawImage(layer.canvas, x, y, cardW, cardH)
    }
    if (card.foilBorder) {
      const inset = cardW * 0.035
      ctx.strokeStyle = metal(ctx, card.foil, width, height)
      ctx.lineWidth = cardW * 0.012
      roundedRect(ctx, x + inset, y + inset, cardW - inset * 2, cardH - inset * 2, radius)
      ctx.stroke()
    }
    ctx.restore()
  }
  return shrink(draw, OG_WIDTH, OG_HEIGHT, OG_MAX_BYTES, 1)
}
