import type { DraftPhoto } from './letter-draft'
import { isIos } from './pwa'

// Foto surat yang diterima: diunduh untuk disimpan di perangkat (Kotak surat), atau dikirim ke
// galeri HP lewat "Unduh foto".

/** Berkas surat yang bisa diunduh, dari `GET /l/:slug` atau kotak bareng. */
export interface RemotePhoto {
  url: string
  width: number
  height: number
}

/** Gagal mengunduh foto karena koneksi, bukan karena fotonya sudah dihapus. */
export class PhotoFetchError extends Error {}

/**
 * Unduh satu foto surat. `null` kalau fotonya sudah tidak ada di server (dihapus 7 hari setelah
 * surat dibuka, di antara halaman dimuat dan tombol Simpan diketuk). Gangguan koneksi dan error
 * server dilempar, supaya tidak ada surat yang tersimpan setengah tanpa user tahu.
 */
export async function fetchPhoto(
  photo: RemotePhoto,
  run: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<DraftPhoto | null> {
  let response: Response
  try {
    response = await run(photo.url, { mode: 'cors', credentials: 'omit' })
  } catch {
    throw new PhotoFetchError('Foto gagal diunduh')
  }
  if (response.status === 404 || response.status === 410 || response.status === 400) return null
  if (!response.ok) throw new PhotoFetchError(`Foto HTTP ${response.status}`)
  const blob = await response.blob()
  return { blob, width: photo.width, height: photo.height }
}

/** Nama berkas foto yang diunduh, misalnya `postpocket-surat-x7Kp2qLm9A-2.jpg`. */
export function photoFileName(base: string, index: number, type: string): string {
  const name = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  return `postpocket-${name || 'surat'}-${index + 1}.${ext}`
}

export interface ExportEnv {
  userAgent: string
  maxTouchPoints: number
  /** `navigator.canShare({ files })` untuk berkas yang mau dibagikan. */
  canShareFiles: boolean
}

/**
 * Cara terbaik mengirim foto ke galeri. Di iPhone dan iPad, unduhan masuk app File, bukan Foto,
 * jadi dipakai lembar Bagikan yang punya "Simpan Gambar". Di Android dan komputer, unduhan
 * biasa langsung tampil di galeri atau folder Unduhan.
 */
export function exportMethod(env: ExportEnv): 'share' | 'download' {
  return env.canShareFiles && isIos(env.userAgent, env.maxTouchPoints) ? 'share' : 'download'
}

/** Berkas ini akan dikirim lewat lembar Bagikan (iPhone dan iPad), bukan diunduh biasa. */
export function sharesToPhotos(files: File[]): boolean {
  return (
    exportMethod({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      canShareFiles: typeof navigator.canShare === 'function' && navigator.canShare({ files }),
    }) === 'share'
  )
}

/**
 * Kirim foto ke galeri. `cancelled` kalau lembar Bagikan ditutup tanpa memilih. Kalau browser
 * menolak lembar Bagikan (misalnya izin dari ketukan sudah lewat), foto diunduh biasa.
 */
export async function exportPhotos(files: File[]): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (!files.length) return 'downloaded'
  if (sharesToPhotos(files)) {
    try {
      await navigator.share({ files })
      return 'shared'
    } catch (problem) {
      if (problem instanceof DOMException && problem.name === 'AbortError') return 'cancelled'
    }
  }
  for (const [index, file] of files.entries()) {
    // Jeda kecil di antara unduhan: tanpa jeda, Chrome hanya mengambil unduhan pertama.
    if (index) await new Promise((resolve) => setTimeout(resolve, 350))
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.rel = 'noopener'
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }
  return 'downloaded'
}
