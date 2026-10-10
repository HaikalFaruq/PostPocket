import {
  byId,
  defaultLetterDesign,
  letter,
  type LetterDesign,
  type Option,
} from '@postpocket/presets'

/** Penanda gambar depan berupa foto user, bukan ilustrasi dari library. */
export const PHOTO_FRONT = 'upload'

/** Panjang maksimal isi surat sementara editor lengkap belum ada. */
export const MESSAGE_LIMIT = 600

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
  version: 1
  design: LetterDesign
  photo: DraftPhoto | null
  message: string
  updatedAt: number
}

export function emptyDraft(): LetterDraft {
  return { version: 1, design: { ...defaultLetterDesign }, photo: null, message: '', updatedAt: 0 }
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

function pick(list: readonly Option[], id: unknown, fallback: string): string {
  return typeof id === 'string' && byId(list, id) ? id : fallback
}

/**
 * Pulihkan draf dari IndexedDB dengan aman. Id preset yang sudah tidak ada diganti bawaan,
 * foto yang hilang mengembalikan gambar depan ke ilustrasi, dan foto tidak memakai mode
 * "Sesuai desain" karena tidak punya lapisan foil bawaan. Foto yang sudah di-upload tetap
 * disimpan walaupun gambar depannya sedang ilustrasi, supaya bisa dipilih lagi.
 */
export function normalizeDraft(raw: unknown): LetterDraft {
  const base = emptyDraft()
  if (!raw || typeof raw !== 'object') return base
  const stored = raw as Partial<LetterDraft>
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
  return {
    version: 1,
    design: next,
    photo,
    message: typeof stored.message === 'string' ? stored.message.slice(0, MESSAGE_LIMIT) : '',
    updatedAt: typeof stored.updatedAt === 'number' ? stored.updatedAt : 0,
  }
}
