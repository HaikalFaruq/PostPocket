import { byId, letter, type LetterContent, type LetterDesign } from '@postpocket/presets'
import type { BoxLetter } from './box-api'
import type { Letter } from './letter-api'
import { PHOTO_FRONT } from './letter-draft'

/**
 * Surat yang siap ditampilkan sebagai kartu: dari link (`GET /l/:slug`), dari kotak bareng, atau
 * dari Kotak surat di perangkat ini. Semuanya dirender komponen yang sama (ReceivedLetter).
 */
export interface ShownLetter {
  id: string
  /** Nama pengirim, ditulis tangan di balik sampul. Surat dari link tidak punya. */
  from: string | null
  design: LetterDesign
  content: LetterContent
  /** Gambar depan dari foto user; `null` kalau ilustrasi atau fotonya sudah tidak ada. */
  cover: { url: string; width: number; height: number } | null
  photoUrls: Record<string, string>
  /** Keterangan di slot foto tanpa gambar, misalnya "Foto sudah dihapus". */
  photoPlaceholder?: string
}

/** Surat dari `GET /l/:slug`. */
export function shownFromApi(sent: Letter): ShownLetter {
  return {
    id: sent.slug,
    from: null,
    design: sent.design,
    content: sent.content,
    cover: sent.cover,
    photoUrls: Object.fromEntries(
      Object.entries(sent.photos).map(([key, asset]) => [key, asset.url]),
    ),
    photoPlaceholder: sent.photosDeletedAt ? 'Foto sudah dihapus' : undefined,
  }
}

/** Surat titipan dari `GET /k/:slug`. Nama pengirimnya ditulis tangan di balik sampul. */
export function shownFromBox(titipan: BoxLetter, photosDeleted: boolean): ShownLetter {
  return {
    id: titipan.id,
    from: titipan.from,
    design: titipan.design,
    content: titipan.content,
    cover: titipan.cover,
    photoUrls: Object.fromEntries(
      Object.entries(titipan.photos).map(([key, asset]) => [key, asset.url]),
    ),
    photoPlaceholder: photosDeleted ? 'Foto sudah dihapus' : undefined,
  }
}

/** Gambar depan surat untuk lembarnya di folder kaca: ilustrasi, atau foto depan dari user. */
export function letterFront(design: LetterDesign, coverUrl: string | null | undefined) {
  if (design.illustration === PHOTO_FRONT) return coverUrl ?? null
  return byId(letter.illustrations, design.illustration)?.art ?? null
}
