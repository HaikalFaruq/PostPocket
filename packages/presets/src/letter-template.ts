import type { Template } from './index'
import {
  contentLimits,
  isFilledElement,
  normalizeContent,
  type LetterContent,
  type LetterElement,
  type PhotoElement,
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

/** Slot template yang titik tengahnya sama dengan `element`, yaitu slot yang belum dipindah. */
function homeSlot(element: LetterElement, slots: readonly LetterElement[]): number {
  return slots.findIndex(
    (slot) =>
      slot.kind === element.kind &&
      Math.abs(slot.x - element.x) < 1e-3 &&
      Math.abs(slot.y - element.y) < 1e-3,
  )
}

/** Slot template tempat `element` berada, selama elemen itu belum dipindah dari slotnya. */
export function slotOf(
  element: LetterElement,
  template: Template,
  pageRatio: number,
): LetterElement | undefined {
  const slots = templateElements(template, pageRatio)
  return slots[homeSlot(element, slots)]
}

/** Foto di template satu foto boleh lebih tinggi dari kotaknya (`fitPhoto` dengan `grow`). */
export function photoGrow(template: Template): number {
  return template.photos === 1 ? 1.4 : 1
}

/**
 * Kotak tempat foto baru dimuat (`fitPhoto`) di bingkai `element`: kotak slot template kalau
 * bingkainya masih di slotnya, persegi seukuran sisi terpanjangnya kalau bingkai itu sudah berisi
 * foto dan sudah dipindah, atau bingkainya sendiri. Jadi mengganti foto berkali-kali tidak membuat
 * bingkainya terus mengecil.
 */
export function photoBox<T extends PhotoElement>(
  element: T,
  template: Template | undefined,
  pageRatio: number,
): T {
  const slot = template && slotOf(element, template, pageRatio)
  if (slot?.kind === 'photo') return { ...element, width: slot.width, aspect: slot.aspect }
  if (element.photo === null) return element
  return { ...element, width: Math.max(element.width, element.width / element.aspect), aspect: 1 }
}

/**
 * Susun isi surat untuk halaman berasio baru, misalnya setelah bentuk kartu diganti. Teks dan foto
 * yang masih di slot template pindah ke slot yang sama di tata letak rasio baru; putaran, rata
 * teks, dan perbesaran huruf (A+, A−) milik user tetap. Bingkai foto di slot mendapat kotak slot
 * barunya (muatkan fotonya dengan `fitPhoto`). Elemen yang sudah dipindah user dan stiker tetap di
 * tempatnya.
 */
export function reflowTemplate(
  content: LetterContent,
  template: Template,
  fromRatio: number,
  toRatio: number,
): LetterContent {
  const before = templateElements(template, fromRatio)
  const after = templateElements(template, toRatio)
  const elements = content.elements.map((element): LetterElement => {
    const index = homeSlot(element, before)
    const from = before[index]
    const to = after[index]
    if (!from || !to) return element
    const place = { x: to.x, y: to.y, rotation: element.rotation }
    if (element.kind === 'text' && from.kind === 'text' && to.kind === 'text') {
      const scale = element.size / from.size
      const { min, max } = contentLimits.size
      const size = round(Math.min(max, Math.max(min, to.size * scale)))
      const width = round(Math.min(1, to.width * (element.width / from.width)))
      return { ...element, ...place, width, size }
    }
    if (element.kind === 'photo' && to.kind === 'photo') {
      return { ...element, ...place, width: to.width, aspect: to.aspect }
    }
    return element
  })
  return normalizeContent({ version: 1, elements })
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

/** Jarak minimal tulisan dari tepi halaman, pecahan tinggi halaman. */
export const PAGE_MARGIN = 0.03
/** Jarak antara tulisan dan foto atau tulisan lain di atas dan bawahnya. */
const TEXT_GAP = 0.025

/**
 * Kotak pembatas elemen setelah diputar, dalam pecahan lebar (`left`, `right`) dan tinggi (`top`,
 * `bottom`) halaman. Tinggi teks tidak bisa dihitung tanpa huruf, jadi teks memakai `textHeight`
 * (pecahan tinggi halaman) kalau ada, atau tinggi satu baris.
 */
export function elementBounds(element: LetterElement, pageRatio: number, textHeight?: number) {
  const ratio = pageRatio > 0 && Number.isFinite(pageRatio) ? pageRatio : 0.75
  // Tinggi sebelum diputar, pecahan tinggi halaman.
  let height: number
  if (element.kind === 'photo') height = (element.width / element.aspect) * ratio
  else if (element.kind === 'sticker') height = element.width * ratio
  else height = textHeight ?? element.size * 1.2 * ratio
  const angle = (Math.abs(element.rotation) * Math.PI) / 180
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  const halfWidth = (element.width * cos + (height / ratio) * sin) / 2
  const halfHeight = (element.width * ratio * sin + height * cos) / 2
  return {
    left: element.x - halfWidth,
    right: element.x + halfWidth,
    top: element.y - halfHeight,
    bottom: element.y + halfHeight,
  }
}

/**
 * Tinggi maksimal setiap blok teks (pecahan tinggi halaman), dengan id teks sebagai kunci. Teks
 * tumbuh sama jauh ke atas dan ke bawah dari titik tengahnya, jadi ruangnya dua kali jarak ke
 * penghalang terdekat: tepi halaman, foto yang sejajar dengannya, atau titik tengah antara dia dan
 * teks lain. Tampilan memperkecil huruf tulisan yang lebih panjang dari ruangnya, jadi tulisan
 * tidak pernah menabrak foto atau teks lain, dan tidak keluar halaman. Foto atau teks yang sengaja
 * ditaruh menimpa titik tengah tulisan (misalnya keterangan di atas foto) tidak dihitung, begitu
 * juga stiker. Penghalangnya hanya isi yang ikut terkirim (`isFilledElement`): slot foto kosong dan
 * teks kosong tidak sampai ke penerima, jadi pengirim dan penerima mendapat ruang yang sama.
 */
export function textRooms(content: LetterContent, pageRatio: number): Record<string, number> {
  const rooms: Record<string, number> = {}
  const texts = content.elements.filter((e) => e.kind === 'text')
  const filledTexts = texts.filter(isFilledElement)
  const photos = content.elements
    .filter((e) => e.kind === 'photo' && isFilledElement(e))
    .map((e) => elementBounds(e, pageRatio))
  for (const text of texts) {
    const left = text.x - text.width / 2
    const right = text.x + text.width / 2
    const beside = (box: { left: number; right: number }) =>
      Math.min(right, box.right) - Math.max(left, box.left) > 0.005
    let up = text.y - PAGE_MARGIN
    let down = 1 - PAGE_MARGIN - text.y
    for (const box of photos) {
      if (!beside(box)) continue
      if (box.bottom <= text.y) up = Math.min(up, text.y - box.bottom - TEXT_GAP)
      else if (box.top >= text.y) down = Math.min(down, box.top - text.y - TEXT_GAP)
    }
    for (const other of filledTexts) {
      if (other === text || other.y === text.y) continue
      if (!beside({ left: other.x - other.width / 2, right: other.x + other.width / 2 })) continue
      const half = Math.abs(other.y - text.y) / 2 - TEXT_GAP / 2
      if (other.y < text.y) up = Math.min(up, half)
      else down = Math.min(down, half)
    }
    rooms[text.id] = round(Math.max(0, 2 * Math.min(up, down)))
  }
  return rooms
}

/**
 * Kotak elemen sebelum diputar, dalam pecahan lebar dan tinggi halaman. Tinggi teks diperkirakan,
 * paling tinggi sebesar ruangnya (`room`, dari `textRooms()`), karena tulisan yang lebih panjang
 * diperkecil supaya muat di sana.
 */
function elementBox(element: LetterElement, pageRatio: number, room?: number) {
  let height: number
  if (element.kind === 'photo') height = (element.width / element.aspect) * pageRatio
  else if (element.kind === 'sticker') height = element.width * pageRatio
  else {
    // Huruf isi surat (Delicious Handrawn, sebelumnya Caveat) rata-rata hanya selebar 0,34 kali
    // ukurannya; perkiraan ini sengaja memakai setengah ukuran dan tinggi baris 1,25, supaya teks
    // tidak pernah dianggap lebih kecil dari aslinya. Teks kosong (slot template) tetap dianggap dua
    // baris, karena di situlah pesan user akan ditulis.
    const perLine = Math.max(1, Math.floor(element.width / (element.size * 0.5)))
    const lines = element.text.trim()
      ? element.text
          .split('\n')
          .reduce((sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).length / perLine)), 0)
      : 2
    height = lines * element.size * 1.25 * pageRatio
    if (room !== undefined) height = Math.min(height, Math.max(room, element.size * pageRatio))
  }
  return {
    left: element.x - element.width / 2,
    right: element.x + element.width / 2,
    top: element.y - height / 2,
    bottom: element.y + height / 2,
  }
}

interface Spot {
  x: number
  y: number
  /** Luas yang tertutup per jenis elemen, dalam pecahan halaman. */
  text: number
  photo: number
  sticker: number
  distance: number
}

const EPSILON = 1e-4

/** Urutan tempat: tulisan tidak pernah kalah, lalu foto, lalu stiker lain, lalu dekat tengah. */
function rank(a: Spot, b: Spot): number {
  for (const key of ['text', 'photo', 'sticker'] as const) {
    if (Math.abs(a[key] - b[key]) > EPSILON) return a[key] - b[key]
  }
  return a.distance - b.distance
}

/**
 * Titik tengah untuk elemen baru selebar `width` (pecahan lebar halaman) dan setinggi `height`
 * (pecahan tinggi halaman). Tempat yang tidak menutupi tulisan selalu dipilih lebih dulu, baru
 * yang paling sedikit menutupi foto, lalu stiker lain; halaman kosong tetap mendapat tengah
 * halaman, dan tempat yang sama baiknya dipilih acak lewat `random`. `coversText` bernilai
 * benar kalau semua tempat menutupi tulisan, supaya pemanggil bisa mencoba ukuran lebih kecil.
 */
export function freeSpot(
  content: LetterContent,
  width: number,
  height: number,
  pageRatio: number,
  random: () => number = Math.random,
): { x: number; y: number; coversText: boolean } {
  const rooms = textRooms(content, pageRatio)
  const boxes = content.elements.map((element) => ({
    box: elementBox(element, pageRatio, rooms[element.id]),
    kind: element.kind,
  }))
  const within = (value: number, half: number) =>
    half >= 0.48 ? 0.5 : Math.min(1 - half - 0.02, Math.max(half + 0.02, value))
  // Baris paling atas dan bawah dekat tepi halaman, jadi tulisan panjang di tengah halaman masih
  // menyisakan tempat untuk stiker.
  const spots = [0.18, 0.5, 0.82].flatMap((x) =>
    [0.1, 0.3, 0.5, 0.7, 0.9].map((y): Spot => {
      const spot: Spot = {
        x: within(x, width / 2),
        y: within(y, height / 2),
        text: 0,
        photo: 0,
        sticker: 0,
        distance: 0,
      }
      spot.distance = Math.hypot(spot.x - 0.5, spot.y - 0.5)
      for (const { box, kind } of boxes) {
        const w = Math.min(spot.x + width / 2, box.right) - Math.max(spot.x - width / 2, box.left)
        const h = Math.min(spot.y + height / 2, box.bottom) - Math.max(spot.y - height / 2, box.top)
        if (w > 0 && h > 0) spot[kind] += w * h
      }
      return spot
    }),
  )
  spots.sort(rank)
  const best = spots.filter(
    (spot) =>
      Math.abs(spot.text - spots[0]!.text) <= EPSILON &&
      Math.abs(spot.photo - spots[0]!.photo) <= EPSILON &&
      Math.abs(spot.sticker - spots[0]!.sticker) <= EPSILON &&
      spot.distance <= spots[0]!.distance + 1e-6,
  )
  const pick = best[Math.min(best.length - 1, Math.floor(random() * best.length))]!
  return { x: round(pick.x), y: round(pick.y), coversText: pick.text > EPSILON }
}

function overlaps(a: ReturnType<typeof elementBox>, b: ReturnType<typeof elementBox>): boolean {
  return (
    Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
    Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
  )
}

/**
 * Stiker yang menutupi teks atau foto dipindah ke tempat yang kosong (`freeSpot`), misalnya
 * setelah tata letak diganti otomatis. Stiker lain dan urutan tumpukannya tetap.
 */
export function tidyStickers(
  content: LetterContent,
  pageRatio: number,
  random: () => number = Math.random,
): LetterContent {
  const settled: LetterElement[] = content.elements.filter((element) => element.kind !== 'sticker')
  const rooms = textRooms(content, pageRatio)
  const blockers = settled.map((element) => elementBox(element, pageRatio, rooms[element.id]))
  const elements = content.elements.map((element) => {
    if (element.kind !== 'sticker') return element
    const box = elementBox(element, pageRatio)
    let next = element
    if (blockers.some((other) => overlaps(box, other))) {
      const { x, y } = freeSpot(
        { version: 1, elements: settled },
        element.width,
        element.width * pageRatio,
        pageRatio,
        random,
      )
      next = { ...element, x, y }
    }
    settled.push(next)
    return next
  })
  return normalizeContent({ version: 1, elements })
}
