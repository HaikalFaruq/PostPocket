// Surat di kotak bareng yang sudah dibuka penerima di perangkat ini, supaya lembar yang belum
// dibaca diberi titik. Hanya kenyamanan per perangkat: kalau penyimpanannya tidak ada, semua
// surat dianggap belum dibuka dan halaman tetap jalan.

const prefix = 'postpocket:kotak-dibaca:'

/** Id surat yang sudah dibuka di kotak `slug`. */
export function readLetters(slug: string, storage: Storage | undefined = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage?.getItem(prefix + slug) ?? '[]')
    return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

/** Catat surat `id` di kotak `slug` sudah dibuka. Mengembalikan daftar yang baru. */
export function markRead(
  slug: string,
  id: string,
  storage: Storage | undefined = globalThis.localStorage,
): Set<string> {
  const read = readLetters(slug, storage)
  read.add(id)
  try {
    storage?.setItem(prefix + slug, JSON.stringify([...read]))
  } catch {
    // Penyimpanan penuh atau diblokir: titiknya hanya bertahan sampai halaman ditutup.
  }
  return read
}
