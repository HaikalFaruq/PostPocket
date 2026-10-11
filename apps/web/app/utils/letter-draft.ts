import {
  byId,
  contentLimits,
  contentPhotoKeys,
  defaultLetterDesign,
  letter,
  normalizeContent,
  templateElements,
  type LetterContent,
  type LetterDesign,
  type Option,
} from '@postpocket/presets'

/** Penanda gambar depan berupa foto user, bukan ilustrasi dari library. */
export const PHOTO_FRONT = 'upload'

/** Panjang maksimal satu blok teks isi surat. */
export const MESSAGE_LIMIT = contentLimits.textLength

export interface DraftPhoto {
  blob: Blob
  width: number
  height: number
}

/**
 * Foto dalam bentuk yang disimpan di IndexedDB. Byte mentah dipakai, bukan Blob, karena
 * Safari tidak bisa menyimpan Blob di IndexedDB saat Private Browsing.
 */
export interface StoredPhoto {
  bytes: ArrayBuffer
  type: string
  width: number
  height: number
}

/** Draf surat yang disimpan di IndexedDB. Tetap di browser sampai user membuat link. */
export interface LetterDraft {
  version: 2
  design: LetterDesign
  /** Foto gambar depan, kalau user memakai foto sendiri. */
  photo: DraftPhoto | null
  /** Isi halaman surat. Slot foto merujuk kunci di `photos`. */
  content: LetterContent
  /** Foto isi surat per kunci, maksimal 4. */
  photos: Record<string, DraftPhoto>
  /** Slug surat yang sedang dibalas lewat "Bikin balasan". */
  replyTo: string | null
  updatedAt: number
}

/** Pola slug surat: 10 karakter base62. */
export const SLUG_PATTERN = /^[A-Za-z0-9]{10}$/

/** Rasio kartu (lebar dibagi tinggi): dari bentuk yang dipilih, atau dari gambar depannya. */
export function cardRatio(
  design: LetterDesign,
  photo: { width: number; height: number } | null,
): number {
  const shape = byId(letter.shapes, design.shape)
  if (shape?.ratio) return shape.ratio
  if (design.illustration === PHOTO_FRONT && photo) return photo.width / photo.height
  return (byId(letter.illustrations, design.illustration) ?? letter.illustrations[0]!).ratio
}

/** Isi awal: slot template yang dipilih, dengan `text` di blok teks pertama. */
export function startingContent(
  design: LetterDesign,
  photo: DraftPhoto | null,
  text = '',
): LetterContent {
  const template = byId(letter.templates, design.template) ?? letter.templates[0]!
  const elements = templateElements(template, cardRatio(design, photo)).map((element) =>
    element.kind === 'text' && element.id === 't1' ? { ...element, text } : element,
  )
  return normalizeContent({ elements })
}

export function emptyDraft(): LetterDraft {
  const design = { ...defaultLetterDesign }
  return {
    version: 2,
    design,
    photo: null,
    content: startingContent(design, null),
    photos: {},
    replyTo: null,
    updatedAt: 0,
  }
}

/** Pulihkan foto dari bentuk tersimpan (byte mentah) atau Blob. */
function toDraftPhoto(value: unknown): DraftPhoto | null {
  if (!value || typeof value !== 'object') return null
  const photo = value as Partial<DraftPhoto & StoredPhoto>
  const width = Number(photo.width)
  const height = Number(photo.height)
  if (!(width > 0 && height > 0)) return null
  if (photo.blob instanceof Blob) return { blob: photo.blob, width, height }
  if (photo.bytes instanceof ArrayBuffer) {
    const type = typeof photo.type === 'string' && photo.type ? photo.type : 'image/jpeg'
    return { blob: new Blob([photo.bytes], { type }), width, height }
  }
  return null
}

/** Bentuk foto untuk IndexedDB. */
export async function toStoredPhoto(photo: DraftPhoto): Promise<StoredPhoto> {
  return {
    bytes: await photo.blob.arrayBuffer(),
    type: photo.blob.type,
    width: photo.width,
    height: photo.height,
  }
}

function pick(list: readonly Option[], id: unknown, fallback: string): string {
  return typeof id === 'string' && byId(list, id) ? id : fallback
}

/**
 * Pulihkan draf dari IndexedDB dengan aman:
 * - id preset yang sudah tidak ada diganti bawaan;
 * - foto depan yang hilang mengembalikan gambar depan ke ilustrasi, dan foto tidak memakai mode
 *   "Sesuai desain" karena tidak punya lapisan foil bawaan. Foto yang sudah di-upload tetap
 *   disimpan walaupun gambar depannya sedang ilustrasi, supaya bisa dipilih lagi;
 * - draf versi 1 (`message` saja) dipindah ke blok teks template;
 * - foto isi yang hilang jadi slot kosong, dan foto yang tidak dipakai dibuang.
 */
export function normalizeDraft(raw: unknown): LetterDraft {
  const base = emptyDraft()
  if (!raw || typeof raw !== 'object') return base
  const stored = raw as Partial<Omit<LetterDraft, 'version'>> & { message?: unknown }
  const design = (stored.design ?? {}) as Partial<LetterDesign>
  const photo = toDraftPhoto(stored.photo)
  const next: LetterDesign = {
    illustration:
      design.illustration === PHOTO_FRONT
        ? photo
          ? PHOTO_FRONT
          : base.design.illustration
        : pick(letter.illustrations, design.illustration, base.design.illustration),
    shape: pick(letter.shapes, design.shape, base.design.shape),
    foilMode: pick(letter.foilModes, design.foilMode, base.design.foilMode),
    foilBorder: typeof design.foilBorder === 'boolean' ? design.foilBorder : false,
    foilColor: pick(letter.foilColors, design.foilColor, base.design.foilColor),
    paper: pick(letter.papers, design.paper, base.design.paper),
    template: pick(letter.templates, design.template, base.design.template),
  }
  if (next.illustration === PHOTO_FRONT && next.foilMode === 'design') next.foilMode = 'detail'

  const photos: Record<string, DraftPhoto> = {}
  if (stored.photos && typeof stored.photos === 'object') {
    for (const [key, value] of Object.entries(stored.photos)) {
      const restored = toDraftPhoto(value)
      if (restored) photos[key] = restored
    }
  }
  const restored =
    stored.content === undefined
      ? startingContent(next, photo, typeof stored.message === 'string' ? stored.message : '')
      : normalizeContent(stored.content)
  const content: LetterContent = {
    version: 1,
    elements: restored.elements.map((element) =>
      element.kind === 'photo' && element.photo !== null && !photos[element.photo]
        ? { ...element, photo: null }
        : element,
    ),
  }
  const used = new Set(contentPhotoKeys(content))
  return {
    version: 2,
    design: next,
    photo,
    content,
    photos: Object.fromEntries(Object.entries(photos).filter(([key]) => used.has(key))),
    replyTo:
      typeof stored.replyTo === 'string' && SLUG_PATTERN.test(stored.replyTo)
        ? stored.replyTo
        : null,
    updatedAt: typeof stored.updatedAt === 'number' ? stored.updatedAt : 0,
  }
}
