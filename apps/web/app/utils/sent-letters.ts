import { get, set } from 'idb-keyval'
import type { SentLetter } from './letter-api'

const KEY = 'postpocket:sent-letters'
const LIMIT = 50

async function read(): Promise<SentLetter[]> {
  const stored = await get(KEY)
  return Array.isArray(stored) ? (stored as SentLetter[]) : []
}

/** Surat `slug` dikirim dari browser ini, jadi yang membukanya di sini adalah pengirimnya. */
export async function sentHere(slug: string): Promise<boolean> {
  try {
    return (await read()).some((item) => item.slug === slug)
  } catch {
    return false
  }
}

/**
 * Surat yang dikirim dari browser ini, lengkap dengan `editToken`. Server hanya menyimpan hash
 * token, jadi hanya browser pengirim yang bisa menghapus suratnya (kontrak API).
 */
export async function rememberSent(letter: SentRecord): Promise<void> {
  try {
    const list = await read()
    await set(KEY, [{ ...letter }, ...list.filter((item) => item.id !== letter.id)].slice(0, LIMIT))
  } catch {
    // IndexedDB tidak tersedia: suratnya tetap terkirim, hanya tidak bisa dihapus dari sini.
  }
}

export async function forgetSent(id: string): Promise<void> {
  try {
    await set(
      KEY,
      (await read()).filter((item) => item.id !== id),
    )
  } catch {
    // Tidak ada yang perlu dihapus.
  }
}

/** Surat terkirim beserta potongan teksnya, supaya mudah dikenali di daftar "Surat terkirim". */
export interface SentRecord extends SentLetter {
  preview?: string
}

/** Semua surat yang dikirim dari browser ini, yang terbaru dulu. */
export async function listSent(): Promise<SentRecord[]> {
  try {
    return await read()
  } catch {
    return []
  }
}
