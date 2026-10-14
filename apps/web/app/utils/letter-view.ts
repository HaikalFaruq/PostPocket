import type { LetterContent, LetterDesign } from '@postpocket/presets'
import type { Letter } from './letter-api'

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
export function shownFromApi(letter: Letter): ShownLetter {
  return {
    id: letter.slug,
    from: null,
    design: letter.design,
    content: letter.content,
    cover: letter.cover,
    photoUrls: Object.fromEntries(
      Object.entries(letter.photos).map(([key, asset]) => [key, asset.url]),
    ),
    photoPlaceholder: letter.photosDeletedAt ? 'Foto sudah dihapus' : undefined,
  }
}
