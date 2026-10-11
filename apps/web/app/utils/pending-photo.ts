import { del, get, set } from 'idb-keyval'
import { toStoredPhoto, type DraftPhoto, type StoredPhoto } from './letter-draft'

// Foto dari Pocket atau Booth yang menunggu dipakai di editor surat. Editor yang memutuskan:
// mulai surat baru, atau tanya dulu kalau masih ada draf yang belum dikirim.
const KEY = 'postpocket:pending-letter-photo'

/** Simpan foto untuk editor surat, lalu buka `/letter/new?foto=1`. `from` misalnya "Pocket". */
export async function sendPhotoToLetter(photo: DraftPhoto, from: string): Promise<void> {
  await set(KEY, { ...(await toStoredPhoto(photo)), from })
  await navigateTo('/letter/new?foto=1')
}

/** Ambil foto yang menunggu, sekali saja. */
export async function takePendingPhoto(): Promise<{ photo: DraftPhoto; from: string } | null> {
  try {
    const stored = (await get(KEY)) as (StoredPhoto & { from?: string }) | undefined
    await del(KEY)
    if (!stored?.bytes) return null
    return {
      photo: {
        blob: new Blob([stored.bytes], { type: stored.type || 'image/jpeg' }),
        width: stored.width,
        height: stored.height,
      },
      from: stored.from || 'Pocket',
    }
  } catch {
    return null
  }
}
