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
  /** Kotak bareng tempat surat ini dititip; `url` surat itu link titip kotaknya. */
  titip?: { invite: string; title: string; to: string }
}

/** Masa hidup terlama surat titipan: kotak menerima titipan 30 hari, lalu berlaku 30 hari lagi. */
const TITIP_LIFETIME = 60 * 24 * 60 * 60 * 1000

/**
 * Surat ini mungkin masih bisa dibuka. Untuk surat titipan, `expiresAt` dari publish hanya
 * perkiraan selama kotaknya belum dibuka (ikut berubah kalau jadwal kotaknya berubah), jadi
 * dipakai batas terlamanya.
 */
export function stillOpen(item: SentRecord, now = Date.now()): boolean {
  const until = item.titip
    ? Date.parse(item.publishedAt) + TITIP_LIFETIME
    : Date.parse(item.expiresAt)
  return until > now
}

/** Surat yang dititip dari browser ini ke kotak dengan kode titip `invite`. */
export async function sentToBox(invite: string): Promise<SentRecord[]> {
  return (await listSent()).filter((item) => item.titip?.invite === invite)
}

/** Semua surat yang dikirim dari browser ini, yang terbaru dulu. */
export async function listSent(): Promise<SentRecord[]> {
  try {
    return await read()
  } catch {
    return []
  }
}
