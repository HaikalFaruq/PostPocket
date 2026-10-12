// Foto HEIC/HEIF (iPhone, sebagian HP Samsung). Safari bisa membukanya sendiri; Chrome dan Firefox
// tidak, jadi foto itu diubah ke JPEG di Web Worker dengan libheif (LGPL-3.0, lihat
// docs/assets.md). Pustakanya hanya dimuat saat ada foto HEIC yang tidak bisa dibuka browser.

const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']
const HEVC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']
// Brand umum HEIF; dipakai juga oleh AVIF, jadi perlu brand HEVC di daftar kompatibelnya.
const GENERIC_BRANDS = ['mif1', 'msf1']

/** Kotak `ftyp` berkas HEIF dengan kode HEVC (bukan AVIF), dari beberapa byte pertamanya. */
export function isHeifBytes(bytes: Uint8Array): boolean {
  const text = (start: number) => String.fromCharCode(...bytes.subarray(start, start + 4))
  if (bytes.length < 16 || text(4) !== 'ftyp') return false
  const size = Math.min(
    bytes.length,
    ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0,
  )
  const major = text(8)
  if (HEVC_BRANDS.includes(major)) return true
  if (!GENERIC_BRANDS.includes(major)) return false
  for (let i = 16; i + 4 <= size; i += 4) if (HEVC_BRANDS.includes(text(i))) return true
  return false
}

/** Apakah berkas ini HEIC/HEIF, dilihat dari tipe, nama, atau isinya (tipe sering kosong di Windows). */
export async function isHeic(file: Blob & { name?: string }): Promise<boolean> {
  if (HEIC_TYPES.includes(file.type)) return true
  if (file.name && /\.(heic|heif)$/i.test(file.name)) return true
  return isHeifBytes(new Uint8Array(await file.slice(0, 64).arrayBuffer()))
}

/** Berkas yang pantas dicoba sebagai foto: tipe gambar, atau HEIC yang tipenya kosong. */
export function looksLikeImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)
}

let worker: Worker | null = null
let idle: ReturnType<typeof setTimeout> | undefined
let nextId = 0
const pending = new Map<number, { resolve: (blob: Blob) => void; reject: (error: Error) => void }>()

function heicWorker(): Worker {
  clearTimeout(idle)
  if (worker) return worker
  worker = new Worker(new URL('../workers/heic.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<{ id: number; blob?: Blob }>) => {
    const { id, blob } = event.data
    const job = pending.get(id)
    pending.delete(id)
    if (blob) job?.resolve(blob)
    else job?.reject(new Error('HEIC gagal dibuka'))
    // Memori libheif cukup besar, jadi worker ditutup kalau sebentar tidak dipakai.
    if (!pending.size) idle = setTimeout(stopWorker, 20_000)
  }
  worker.onerror = () => {
    for (const job of pending.values()) job.reject(new Error('Worker HEIC gagal'))
    pending.clear()
    stopWorker()
  }
  return worker
}

function stopWorker() {
  worker?.terminate()
  worker = null
}

/** Ubah HEIC jadi JPEG dengan sisi panjang maksimal `maxSide`, di Web Worker. */
export async function heicToJpeg(file: Blob, maxSide = 2048): Promise<Blob> {
  const buffer = await file.arrayBuffer()
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    heicWorker().postMessage({ id, buffer, maxSide }, [buffer])
  })
}
