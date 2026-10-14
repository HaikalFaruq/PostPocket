import { get, set } from 'idb-keyval'
import type { CreatedBox } from './box-api'

// Kotak bareng yang dibuat dari browser ini, lengkap dengan `editToken`. Server hanya menyimpan
// hash token, jadi hanya browser pembuatnya yang bisa mengelola kotak itu (kontrak 0.3.0).

const KEY = 'postpocket:my-boxes'
const LIMIT = 30

export interface MyBox {
  id: string
  editToken: string
  slug: string
  url: string
  invite: string
  inviteUrl: string
  title: string
  to: string
  design: string
  createdAt: string
  /** Kotak dan titipannya dihapus server saat ini; setelahnya kotak tidak ditampilkan lagi. */
  expiresAt: string
}

async function read(): Promise<MyBox[]> {
  const stored = await get(KEY)
  return Array.isArray(stored) ? (stored as MyBox[]) : []
}

/** Catat kotak yang baru dibuat. `false` kalau browser ini tidak bisa menyimpannya. */
export async function rememberBox(box: CreatedBox): Promise<boolean> {
  const record: MyBox = {
    id: box.id,
    editToken: box.editToken,
    slug: box.slug,
    url: box.url,
    invite: box.invite,
    inviteUrl: box.inviteUrl,
    title: box.title,
    to: box.to,
    design: box.design,
    createdAt: box.createdAt,
    expiresAt: box.expiresAt,
  }
  try {
    const list = await read()
    await set(KEY, [record, ...list.filter((item) => item.id !== box.id)].slice(0, LIMIT))
    return true
  } catch {
    // IndexedDB tidak tersedia: kotaknya tetap dibuat, tapi tidak bisa dikelola dari sini nanti.
    return false
  }
}

/** Perbarui judul, desain, dan masa berlaku setelah kotaknya diubah. */
export async function refreshBox(
  id: string,
  patch: Pick<MyBox, 'title' | 'to' | 'design' | 'expiresAt'>,
): Promise<void> {
  try {
    await set(
      KEY,
      (await read()).map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  } catch {
    // Tidak apa-apa: data server tetap yang dipakai halaman kelola.
  }
}

export async function forgetBox(id: string): Promise<void> {
  try {
    await set(
      KEY,
      (await read()).filter((item) => item.id !== id),
    )
  } catch {
    // Tidak ada yang perlu dihapus.
  }
}

/** Kotak yang dibuat di browser ini dan masih berlaku, yang terbaru dulu. */
export async function listBoxes(now = Date.now()): Promise<MyBox[]> {
  try {
    return (await read()).filter((item) => Date.parse(item.expiresAt) > now)
  } catch {
    return []
  }
}

/** Kotak dengan slug ini dibuat di browser ini, jadi yang membukanya pembuatnya sendiri. */
export async function boxHere(slug: string): Promise<MyBox | null> {
  try {
    return (await read()).find((item) => item.slug === slug) ?? null
  } catch {
    return null
  }
}

/** Kotak `id` yang dibuat di browser ini, atau `null`. */
export async function myBox(id: string): Promise<MyBox | null> {
  try {
    return (await read()).find((item) => item.id === id) ?? null
  } catch {
    return null
  }
}
