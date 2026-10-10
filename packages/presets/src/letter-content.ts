/**
 * Isi surat (halaman dalam kartu), seperti kolom `content` di tabel `letters`.
 *
 * Posisi dan ukuran relatif terhadap halaman surat, jadi isinya tampil sama di layar selebar
 * apa pun. `x` dan `y` adalah titik tengah elemen sebagai pecahan lebar dan tinggi halaman;
 * `width` dan `size` adalah pecahan lebar halaman.
 */
export interface LetterContent {
  version: 1
  /** Urutan tumpukan: elemen terakhir tampil paling atas. */
  elements: LetterElement[]
}

interface ElementBase {
  /** Unik dalam satu surat. */
  id: string
  /** Titik tengah, pecahan lebar halaman (0 sampai 1). */
  x: number
  /** Titik tengah, pecahan tinggi halaman (0 sampai 1). */
  y: number
  /** Lebar elemen, pecahan lebar halaman. */
  width: number
  /** Putaran dalam derajat searah jarum jam, -180 sampai 180. */
  rotation: number
}

/** Blok teks tulisan tangan (Caveat). Warnanya mengikuti kertas. */
export interface TextElement extends ElementBase {
  kind: 'text'
  text: string
  /** Ukuran huruf, pecahan lebar halaman. */
  size: number
  align: 'left' | 'center' | 'right'
}

/** Foto dalam bingkai. Foto di-crop supaya menutupi bingkai. */
export interface PhotoElement extends ElementBase {
  kind: 'photo'
  /**
   * Kunci foto di daftar foto surat. `null` adalah slot template yang belum diisi; slot kosong
   * hanya ada di draf dan dibuang `publishableContent()` sebelum dikirim ke API.
   */
  photo: string | null
  /** Lebar dibagi tinggi bingkai. */
  aspect: number
}

/** Stiker dari preset. */
export interface StickerElement extends ElementBase {
  kind: 'sticker'
  sticker: string
}

export type LetterElement = TextElement | PhotoElement | StickerElement

/** Batas isi surat. Backend memvalidasi dengan angka yang sama. */
export const contentLimits = {
  /** Jumlah elemen per jenis. */
  text: 4,
  photo: 4,
  sticker: 16,
  /** Karakter (code point) per blok teks. */
  textLength: 600,
  width: { min: 0.05, max: 1 },
  size: { min: 0.02, max: 0.25 },
  aspect: { min: 0.2, max: 5 },
} as const

/** Pola id elemen, kunci foto, dan id stiker. */
const ID = /^[A-Za-z0-9_-]{1,40}$/

function isId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value)
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  // `|| 0` mengubah -0 jadi 0.
  return Math.round(value * factor) / factor || 0
}

function clamp(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return round(Math.min(range.max, Math.max(range.min, value)))
}

function angle(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return round(((((value + 180) % 360) + 360) % 360) - 180, 2)
}

function isLoneSurrogate(char: string): boolean {
  return char.length === 1 && char >= '\uD800' && char <= '\uDFFF'
}

/**
 * Teks yang aman disimpan di `jsonb` Postgres: tanpa NUL dan tanpa surrogate yang terputus,
 * dengan baris baru seragam. Dipotong per code point supaya emoji tidak terbelah.
 */
function cleanText(value: string): string {
  return Array.from(value.replace(/\r\n?/g, '\n'))
    .filter((char) => char !== '\u0000')
    .slice(0, contentLimits.textLength)
    .map((char) => (isLoneSurrogate(char) ? '�' : char))
    .join('')
}

const unit = { min: 0, max: 1 }

function toElement(value: unknown): LetterElement | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (!isId(item.id)) return null
  const base = {
    id: item.id,
    x: clamp(item.x, unit, 0.5),
    y: clamp(item.y, unit, 0.5),
    width: clamp(item.width, contentLimits.width, 0.5),
    rotation: angle(item.rotation),
  }
  switch (item.kind) {
    case 'text': {
      if (typeof item.text !== 'string') return null
      const align = item.align === 'left' || item.align === 'right' ? item.align : 'center'
      const size = clamp(item.size, contentLimits.size, 0.06)
      return { kind: 'text', ...base, text: cleanText(item.text), size, align }
    }
    case 'photo': {
      const photo = item.photo ?? null
      if (photo !== null && !isId(photo)) return null
      return { kind: 'photo', ...base, photo, aspect: clamp(item.aspect, contentLimits.aspect, 1) }
    }
    case 'sticker':
      return isId(item.sticker) ? { kind: 'sticker', ...base, sticker: item.sticker } : null
    default:
      return null
  }
}

/**
 * Bersihkan isi surat dari sumber yang tidak dipercaya, misalnya draf di IndexedDB atau
 * respons API. Elemen yang rusak dibuang, angka dijepit ke rentangnya, dan batas jumlah
 * ditegakkan sesuai urutan: elemen yang lebih dulu yang dipertahankan.
 */
export function normalizeContent(raw: unknown): LetterContent {
  const list = raw && typeof raw === 'object' ? (raw as { elements?: unknown }).elements : null
  const elements: LetterElement[] = []
  if (!Array.isArray(list)) return { version: 1, elements }
  const ids = new Set<string>()
  const photos = new Set<string>()
  const counts = { text: 0, photo: 0, sticker: 0 }
  for (const value of list) {
    const element = toElement(value)
    if (!element || ids.has(element.id)) continue
    if (counts[element.kind] === contentLimits[element.kind]) continue
    if (element.kind === 'photo' && element.photo !== null) {
      // Satu foto hanya dipakai sekali.
      if (photos.has(element.photo)) continue
      photos.add(element.photo)
    }
    ids.add(element.id)
    counts[element.kind]++
    elements.push(element)
  }
  return { version: 1, elements }
}

function isFilled(element: LetterElement): boolean {
  switch (element.kind) {
    case 'photo':
      return element.photo !== null
    case 'text':
      return element.text.trim() !== ''
    default:
      return true
  }
}

/** Isi yang dikirim ke API: slot foto kosong dan blok teks kosong dibuang. */
export function publishableContent(content: LetterContent): LetterContent {
  return { version: 1, elements: content.elements.filter(isFilled) }
}

/** Kunci foto yang dipakai isi surat, sesuai urutan. Inilah daftar foto yang diunggah. */
export function contentPhotoKeys(content: LetterContent): string[] {
  return content.elements.flatMap((element) =>
    element.kind === 'photo' && element.photo !== null ? [element.photo] : [],
  )
}
