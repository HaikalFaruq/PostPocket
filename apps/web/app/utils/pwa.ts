/** Kunci localStorage untuk kartu "Pasang PostPocket" yang sudah ditutup. Dipakai juga @vite-pwa/nuxt. */
export const INSTALL_HIDDEN_KEY = 'postpocket:install-hidden'

/** Nama cache halaman di service worker, sama dengan `pwa.workbox.runtimeCaching` di nuxt.config. */
export const PAGES_CACHE = 'pages'

/**
 * Halaman surat penerima, kotak bareng penerima, dan halaman titip isinya pribadi, jadi tidak
 * pernah disimpan service worker.
 */
export function isPrivatePath(path: string): boolean {
  return /^\/(l|k|titip)(\/|$)/.test(path)
}

export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  // iPadOS mengaku sebagai Mac; bedanya ada layar sentuh.
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

/** Browser bawaan aplikasi lain (Instagram, Facebook, LINE, TikTok) tidak bisa memasang web app. */
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly|Bytedance/i.test(userAgent)
}

export interface InstallEnv {
  userAgent: string
  maxTouchPoints: number
  /** Sudah dibuka sebagai aplikasi terpasang. */
  standalone: boolean
  /** Browser sudah mengirim `beforeinstallprompt`, jadi tombol Pasang bisa memanggil dialognya. */
  canPrompt: boolean
  /** User sudah menutup kartu ini sebelumnya. */
  dismissed: boolean
}

/**
 * Ajakan pasang yang cocok: `prompt` untuk browser yang punya dialog pasang (Chrome, Edge,
 * Samsung Internet), `ios` untuk petunjuk Bagikan lalu Tambah ke Layar Utama, atau `null`.
 */
export function installHint(env: InstallEnv): 'prompt' | 'ios' | null {
  if (env.dismissed || env.standalone) return null
  if (env.canPrompt) return 'prompt'
  if (isIos(env.userAgent, env.maxTouchPoints) && !isInAppBrowser(env.userAgent)) return 'ios'
  return null
}

/**
 * Penulisan ke IndexedDB ditolak karena ruang simpan browser untuk situs ini sudah habis
 * (`QuotaExceededError`), termasuk kalau error itu dibungkus sebagai `cause`.
 */
export function isStorageFull(problem: unknown): boolean {
  for (let error = problem, depth = 0; error && depth < 5; depth++) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') return true
    if (error instanceof Error && /quota/i.test(error.message)) return true
    error = (error as { cause?: unknown }).cause
  }
  return false
}

/**
 * Minta penyimpanan permanen supaya draf dan foto di IndexedDB tidak dihapus browser saat ruang
 * penuh atau, di Safari, setelah 7 hari tidak dibuka.
 */
export async function requestPersistentStorage(
  storage: Pick<StorageManager, 'persist' | 'persisted'> | undefined = globalThis.navigator
    ?.storage,
): Promise<boolean> {
  if (!storage?.persist) return false
  try {
    if (await storage.persisted()) return true
    return await storage.persist()
  } catch {
    return false
  }
}

/**
 * Simpan halaman ke cache service worker sejak kunjungan pertama, supaya aplikasi yang baru
 * dipasang tetap bisa dibuka offline. Halaman pribadi dilewati dan yang sudah ada tidak diunduh
 * ulang; kegagalan diabaikan karena ini hanya persiapan.
 */
export async function warmPages(
  paths: readonly string[],
  storage: CacheStorage | undefined = globalThis.caches,
): Promise<void> {
  if (!storage) return
  const targets = [...new Set(paths)].filter((path) => path.startsWith('/') && !isPrivatePath(path))
  if (targets.length === 0) return
  try {
    const cache = await storage.open(PAGES_CACHE)
    await Promise.all(
      targets.map(async (path) => {
        if (await cache.match(path, { ignoreSearch: true })) return
        await cache.add(path).catch(() => {})
      }),
    )
  } catch {
    // Cache Storage bisa ditolak, misalnya di mode privat. Aplikasi tetap jalan online.
  }
}
