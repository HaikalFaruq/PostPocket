import { contentPhotoKeys, publishableContent, type LetterContent } from '@postpocket/presets'
import type { BoxLimits, BoxUsage } from './box-api'

/** Surat dan foto yang masih muat di kotak bareng (batasnya `BoxLimits` di kontrak). */
export interface BoxRoom {
  letters: number
  photos: number
}

export function boxRoom(limits: BoxLimits, usage: BoxUsage): BoxRoom {
  return {
    letters: Math.max(0, limits.letters - usage.letters),
    photos: Math.max(0, limits.photos - usage.photos),
  }
}

/**
 * Foto yang dihitung kotak untuk satu surat: gambar depan dari foto user, ditambah foto isi yang
 * ikut terkirim. Sama dengan hitungan server untuk `box_full`.
 */
export function letterPhotoCount(content: LetterContent, photoFront: boolean): number {
  return (photoFront ? 1 : 0) + contentPhotoKeys(publishableContent(content)).length
}

/**
 * Kenapa surat berisi `photos` foto tidak muat di kotak ini: suratnya sudah penuh, atau fotonya
 * lebih banyak dari sisa foto kotak. `null` kalau muat.
 */
export function roomProblem(room: BoxRoom, photos: number): 'letters' | 'photos' | null {
  if (room.letters < 1) return 'letters'
  if (photos > room.photos) return 'photos'
  return null
}
