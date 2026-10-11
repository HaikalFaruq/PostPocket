import type { Template } from './index'
import {
  contentLimits,
  isFilledElement,
  normalizeContent,
  type LetterContent,
  type LetterElement,
} from './letter-content'

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

/** Halaman yang lebih lebar dari ini (lebar dibagi tinggi) memakai tata letak `wide`. */
export const WIDE_PAGE_FROM = 1.1

function freshId(prefix: string, taken: Set<string>): string {
  for (let n = 1; ; n++) {
    const id = `${prefix}${n}`
    if (!taken.has(id)) {
      taken.add(id)
      return id
    }
  }
}

/**
 * Elemen awal template untuk halaman dengan rasio `pageRatio` (lebar dibagi tinggi). Kotak foto
 * di preset diubah jadi `width` dan `aspect` sesuai rasio halaman, jadi foto selalu mengisi
 * kotaknya; ukuran huruf mengikuti sisi pendek halaman. Slot foto dan teks mulai kosong. Id
 * baru tidak bentrok dengan isi `taken`, dan id yang dipakai ditambahkan ke sana.
 */
export function templateElements(
  template: Template,
  pageRatio: number,
  taken: Set<string> = new Set(),
): LetterElement[] {
  const ratio = pageRatio > 0 && Number.isFinite(pageRatio) ? pageRatio : 0.75
  const slots = ratio > WIDE_PAGE_FROM ? template.layout.wide : template.layout.tall
  const shortSide = Math.min(1, 1 / ratio)
  const raw = slots.map((slot) => {
    const base = { x: slot.x, y: slot.y, width: slot.width, rotation: slot.rotation ?? 0 }
    if (slot.kind === 'photo') {
      const height = slot.height ?? slot.width
      const aspect = (slot.width / height) * ratio
      return { kind: 'photo', id: freshId('p', taken), ...base, photo: null, aspect }
    }
    const size = (slot.size ?? 0.06) * shortSide
    return { kind: 'text', id: freshId('t', taken), ...base, text: '', size, align: slot.align }
  })
  return normalizeContent({ elements: raw }).elements
}

/**
 * Pindahkan isi surat ke tata letak template lain tanpa membuang isi milik user (PRD: teks dan
 * foto tidak pernah ikut diacak). Teks dan foto yang ada mengisi slot template sesuai urutan.
 * Yang tidak kebagian slot tetap di tempatnya, stiker tidak dipindah, dan slot kosong dari
 * template lama dibuang.
 */
export function applyTemplate(
  content: LetterContent,
  template: Template,
  pageRatio: number,
): LetterContent {
  const texts = content.elements.filter((e) => e.kind === 'text' && isFilledElement(e))
  const photos = content.elements.filter((e) => e.kind === 'photo' && isFilledElement(e))
  const used = new Set<string>()
  const taken = new Set(content.elements.map((e) => e.id))
  const placed = templateElements(template, pageRatio, taken).map((slot): LetterElement => {
    const source = slot.kind === 'text' ? texts.shift() : photos.shift()
    if (!source) return slot
    used.add(source.id)
    if (slot.kind === 'text' && source.kind === 'text') {
      return { ...slot, id: source.id, text: source.text }
    }
    if (slot.kind === 'photo' && source.kind === 'photo') {
      return { ...slot, id: source.id, photo: source.photo }
    }
    return slot
  })
  const kept = content.elements.filter((e) => !used.has(e.id) && isFilledElement(e))
  return normalizeContent({ version: 1, elements: [...placed, ...kept] })
}

/** Template dengan slot foto paling sedikit yang masih cukup untuk `count` foto. */
export function templateForPhotos(templates: readonly Template[], count: number): Template | null {
  const fitting = templates.filter((item) => item.photos >= Math.max(1, count))
  return fitting.reduce<Template | null>(
    (best, item) => (!best || item.photos < best.photos ? item : best),
    null,
  )
}

/**
 * Bingkai foto dibentuk ulang mengikuti bentuk fotonya sendiri, jadi foto tampil utuh tanpa
 * terpotong (misalnya strip Booth yang tinggi). Fotonya dimuat di dalam kotak bingkai lama dengan
 * titik tengah yang sama. `grow` membolehkan kotak itu lebih tinggi untuk foto tegak, selama
 * fotonya tetap di dalam halaman.
 */
export function fitPhoto<T extends { y: number; width: number; aspect: number }>(
  element: T,
  photoAspect: number,
  pageRatio: number,
  { grow = 1 }: { grow?: number } = {},
): T {
  const ratio = pageRatio > 0 && Number.isFinite(pageRatio) ? pageRatio : 0.75
  const { min, max } = contentLimits.aspect
  const aspect = Math.min(max, Math.max(min, photoAspect > 0 ? photoAspect : element.aspect))
  // Semua ukuran dalam pecahan lebar halaman; tinggi halaman = 1 / ratio.
  const boxHeight = element.width / element.aspect
  const room = (2 * Math.min(element.y - 0.03, 0.97 - element.y)) / ratio
  const height = Math.max(0, Math.min(boxHeight * grow, room))
  const width = Math.min(element.width, height * aspect)
  const clamped = Math.min(contentLimits.width.max, Math.max(contentLimits.width.min, width))
  return { ...element, width: round(clamped), aspect: round(aspect) }
}

/** Kotak elemen sebelum diputar, dalam pecahan lebar dan tinggi halaman. Tinggi teks diperkirakan. */
function elementBox(element: LetterElement, pageRatio: number) {
  let height: number
  if (element.kind === 'photo') height = (element.width / element.aspect) * pageRatio
  else if (element.kind === 'sticker') height = element.width * pageRatio
  else {
    // Huruf Caveat rata-rata selebar setengah ukurannya, tinggi barisnya 1,25. Teks kosong (slot
    // template) tetap dianggap dua baris, karena di situlah pesan user akan ditulis.
    const perLine = Math.max(1, Math.floor(element.width / (element.size * 0.5)))
    const lines = element.text.trim()
      ? element.text
          .split('\n')
          .reduce((sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).length / perLine)), 0)
      : 2
    height = lines * element.size * 1.25 * pageRatio
  }
  return {
    left: element.x - element.width / 2,
    right: element.x + element.width / 2,
    top: element.y - height / 2,
    bottom: element.y + height / 2,
  }
}

// Teks paling dijaga supaya tetap terbaca, lalu foto, lalu stiker lain.
const COVER_COST = { text: 3, photo: 2, sticker: 1 } as const

/**
 * Titik tengah untuk elemen baru selebar `width` (pecahan lebar halaman) dan setinggi `height`
 * (pecahan tinggi halaman) yang paling sedikit menutupi isi surat, supaya stiker atau foto baru
 * tidak menimpa tulisan. Halaman kosong tetap mendapat tengah halaman; tempat yang sama baiknya
 * dipilih acak lewat `random`.
 */
export function freeSpot(
  content: LetterContent,
  width: number,
  height: number,
  pageRatio: number,
  random: () => number = Math.random,
): { x: number; y: number } {
  const boxes = content.elements.map((element) => ({
    box: elementBox(element, pageRatio),
    cost: COVER_COST[element.kind],
  }))
  const within = (value: number, half: number) =>
    half >= 0.48 ? 0.5 : Math.min(1 - half - 0.02, Math.max(half + 0.02, value))
  const spots = [0.2, 0.5, 0.8].flatMap((x) =>
    [0.14, 0.32, 0.5, 0.68, 0.86].map((y) => {
      const spot = { x: within(x, width / 2), y: within(y, height / 2) }
      const cover = boxes.reduce((sum, { box, cost }) => {
        const w = Math.min(spot.x + width / 2, box.right) - Math.max(spot.x - width / 2, box.left)
        const h = Math.min(spot.y + height / 2, box.bottom) - Math.max(spot.y - height / 2, box.top)
        return sum + (w > 0 && h > 0 ? w * h * cost : 0)
      }, 0)
      return { ...spot, cover, distance: Math.hypot(spot.x - 0.5, spot.y - 0.5) }
    }),
  )
  const least = Math.min(...spots.map((spot) => spot.cover))
  const quiet = spots.filter((spot) => spot.cover <= least + 1e-4)
  const nearest = Math.min(...quiet.map((spot) => spot.distance))
  const best = quiet.filter((spot) => spot.distance <= nearest + 1e-6)
  const pick = best[Math.min(best.length - 1, Math.floor(random() * best.length))]!
  return { x: round(pick.x), y: round(pick.y) }
}
