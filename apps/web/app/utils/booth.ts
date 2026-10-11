import type { PhotoFilter } from '@postpocket/presets'
import { applyTvEffects, drawFiltered } from './photo-filter'

/** Tata letak hasil Booth (PRD): strip 1×4, grid 2×2, atau satu foto. */
export type BoothLayout = 'strip' | 'grid' | 'single'

export const BOOTH_LAYOUTS: { value: BoothLayout; label: string; shots: number }[] = [
  { value: 'strip', label: 'Strip 1×4', shots: 4 },
  { value: 'grid', label: 'Grid 2×2', shots: 4 },
  { value: 'single', label: 'Satu foto', shots: 1 },
]

/** Ukuran satu jepretan (4:3), sama dengan rasio layar TV. */
export const SHOT_WIDTH = 960
export const SHOT_HEIGHT = 720

export interface StripGeometry {
  width: number
  height: number
  cells: { x: number; y: number; width: number; height: number }[]
  /** Garis dasar teks tanggal di bagian bawah bingkai. */
  footer: number
}

/** Posisi tiap foto di bingkai hasil Booth. */
export function stripGeometry(layout: BoothLayout): StripGeometry {
  const pad = 40
  const gap = layout === 'grid' ? 28 : 22
  const footer = 120
  const columns = layout === 'grid' ? 2 : 1
  const rows = layout === 'strip' ? 4 : layout === 'grid' ? 2 : 1
  const cellWidth = layout === 'grid' ? 480 : layout === 'single' ? 960 : 540
  const cellHeight = Math.round((cellWidth * SHOT_HEIGHT) / SHOT_WIDTH)
  const width = pad * 2 + columns * cellWidth + (columns - 1) * gap
  const height = pad + rows * cellHeight + (rows - 1) * gap + footer
  const cells = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      cells.push({
        x: pad + column * (cellWidth + gap),
        y: pad + row * (cellHeight + gap),
        width: cellWidth,
        height: cellHeight,
      })
    }
  }
  return { width, height, cells, footer: height - footer / 2 + 14 }
}

/**
 * Ambil satu jepretan 4:3 dari video (dipotong di tengah), dengan filter dan efek TV yang sama
 * seperti di layar. Kamera depan dicerminkan, seperti pratinjaunya.
 */
export function captureShot(
  source: HTMLVideoElement | HTMLImageElement | ImageBitmap,
  filter: PhotoFilter,
  mirror: boolean,
): HTMLCanvasElement {
  const sourceWidth =
    'videoWidth' in source
      ? source.videoWidth
      : 'naturalWidth' in source
        ? source.naturalWidth
        : source.width
  const sourceHeight =
    'videoHeight' in source
      ? source.videoHeight
      : 'naturalHeight' in source
        ? source.naturalHeight
        : source.height
  const crop = document.createElement('canvas')
  crop.width = SHOT_WIDTH
  crop.height = SHOT_HEIGHT
  const cropCtx = crop.getContext('2d')
  if (!cropCtx) throw new Error('Kanvas tidak tersedia')
  const scale = Math.max(SHOT_WIDTH / sourceWidth, SHOT_HEIGHT / sourceHeight)
  const w = sourceWidth * scale
  const h = sourceHeight * scale
  cropCtx.drawImage(source, (SHOT_WIDTH - w) / 2, (SHOT_HEIGHT - h) / 2, w, h)

  const shot = document.createElement('canvas')
  shot.width = SHOT_WIDTH
  shot.height = SHOT_HEIGHT
  const ctx = shot.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Kanvas tidak tersedia')
  drawFiltered(ctx, crop, SHOT_WIDTH, SHOT_HEIGHT, filter.css, { mirror })
  applyTvEffects(ctx, SHOT_WIDTH, SHOT_HEIGHT, filter.effects)
  return shot
}

/** Tanggal di bingkai, misalnya "10.10.2026". */
export function boothDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

/** Susun jepretan jadi bingkai berlatar `frameColor` dengan tanggal dan nama di bawahnya. */
export async function composeStrip(
  shots: HTMLCanvasElement[],
  layout: BoothLayout,
  options: { frameColor: string; ink: string; date: Date },
): Promise<HTMLCanvasElement> {
  const geometry = stripGeometry(layout)
  const canvas = document.createElement('canvas')
  canvas.width = geometry.width
  canvas.height = geometry.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Kanvas tidak tersedia')
  ctx.fillStyle = options.frameColor
  ctx.fillRect(0, 0, geometry.width, geometry.height)
  geometry.cells.forEach((cell, index) => {
    const shot = shots[index] ?? shots[shots.length - 1]
    if (shot) ctx.drawImage(shot, cell.x, cell.y, cell.width, cell.height)
  })
  try {
    await document.fonts.load('48px VT323')
  } catch {
    // Font cadangan monospace tetap terbaca.
  }
  ctx.fillStyle = options.ink
  ctx.textBaseline = 'alphabetic'
  ctx.font = '48px VT323, ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.fillText(boothDate(options.date), 40, geometry.footer)
  ctx.textAlign = 'right'
  ctx.fillText('POSTPOCKET', geometry.width - 40, geometry.footer)
  return canvas
}

export function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Gagal menyimpan'))),
      type,
      quality,
    ),
  )
}

let audio: AudioContext | null = null

/** Bunyi pendek untuk hitung mundur dan jepretan. Diam saja kalau browser tidak mengizinkan. */
export function beep(frequency = 880, duration = 0.08) {
  try {
    audio ??= new AudioContext()
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.18, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start()
    oscillator.stop(audio.currentTime + duration)
  } catch {
    // Tanpa suara.
  }
}
