import { del, get, set } from 'idb-keyval'
import type { DraftChoice } from '~/composables/useDraftChoice'
import { toStoredPhoto, type DraftPhoto, type StoredPhoto } from './letter-draft'

// Foto dari Pocket atau Booth yang menunggu dipakai di editor surat, beserta keputusan user:
// mulai surat baru, atau tambahkan ke draf yang belum dikirim.
const KEY = 'postpocket:pending-letter-photo'

/** Foto yang menunggu, beserta asalnya untuk keterangan di editor. */
export interface PendingPhoto {
  photo: DraftPhoto
  from: string
  /** Kosong kalau belum ditanyakan; editor yang bertanya. */
  mode?: DraftChoice
}

/**
 * Pakai foto ini di surat: simpan untuk editor, lalu buka `/letter/new?foto=1`. `from` misalnya
 * "Pocket". Kalau masih ada draf yang belum dikirim, user ditanya dulu di halaman ini, jadi
 * "Batal" tidak membuang apa pun. Mengembalikan `false` kalau dibatalkan.
 */
export async function sendPhotoToLetter(photo: DraftPhoto, from: string): Promise<boolean> {
  const draft = useLetterDraft()
  await draft.load()
  let mode: DraftChoice = 'new'
  if (!draft.blank && !draft.sent) {
    const choice = await askDraftChoice({ kind: 'photo', from })
    if (!choice) return false
    mode = choice
  }
  await set(KEY, { ...(await toStoredPhoto(photo)), from, mode })
  await navigateTo('/letter/new?foto=1')
  return true
}

/** Ambil foto yang menunggu, sekali saja. */
export async function takePendingPhoto(): Promise<PendingPhoto | null> {
  try {
    const stored = (await get(KEY)) as (StoredPhoto & { from?: string; mode?: string }) | undefined
    await del(KEY)
    if (!stored?.bytes) return null
    return {
      photo: {
        blob: new Blob([stored.bytes], { type: stored.type || 'image/jpeg' }),
        width: stored.width,
        height: stored.height,
      },
      from: stored.from || 'Pocket',
      mode: stored.mode === 'new' || stored.mode === 'add' ? stored.mode : undefined,
    }
  } catch {
    return null
  }
}
