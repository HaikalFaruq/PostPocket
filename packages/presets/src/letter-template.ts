import type { Template } from './index'
import {
  isFilledElement,
  normalizeContent,
  type LetterContent,
  type LetterElement,
} from './letter-content'

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
