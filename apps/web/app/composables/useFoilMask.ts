import type { Ref } from 'vue'
import type { FoilMapMode } from '~/utils/foil-map'
import { foilMapOffThread } from '~/utils/foil-map-worker'

// Mask yang sudah dibuat dipakai ulang (per gambar dan mode). Yang paling lama dibuang.
const cache = new Map<string, string>()
const CACHE_LIMIT = 12
// Mask yang sedang dibuat, supaya kartu yang sedang disiapkan dan kartu yang tampil tidak
// menghitung gambar yang sama dua kali.
const running = new Map<string, Promise<string | undefined>>()

function remember(key: string, url: string) {
  cache.set(key, url)
  if (cache.size <= CACHE_LIMIT) return
  const oldest = cache.keys().next().value
  if (oldest === undefined) return
  const oldUrl = cache.get(oldest)
  cache.delete(oldest)
  if (oldUrl) URL.revokeObjectURL(oldUrl)
}

/** Mask dari cache tanpa menunggu: `null` kalau masih harus dihitung. */
function cachedMask(source: string | undefined, design: string | undefined, mode: string) {
  if (mode === 'design') return design
  if (!source) return undefined
  return cache.get(`${source}#${mode}`) ?? null
}

/**
 * Mask foil untuk gambar `source`, dari cache kalau sudah pernah dihitung. Dipakai juga untuk
 * menyiapkan kartu sebelum tampil (`warmCardFront`), jadi hasilnya sama dengan `useFoilMask`.
 */
export function foilMaskFor(
  source: string | undefined,
  design: string | undefined,
  mode: string,
): Promise<string | undefined> {
  const hit = cachedMask(source, design, mode)
  if (hit !== null) return Promise.resolve(hit)
  const key = `${source}#${mode}`
  let job = running.get(key)
  if (!job) {
    job = (async () => {
      try {
        const image = await rasterize(source!)
        const alpha = await foilMapOffThread(image, mode as FoilMapMode)
        const url = await maskToUrl(alpha, image.width, image.height)
        remember(key, url)
        return url
      } catch {
        return undefined
      } finally {
        running.delete(key)
      }
    })()
    running.set(key, job)
  }
  return job
}

/**
 * Mask foil untuk kartu. Mode "Sesuai desain" memakai lapisan foil bawaan ilustrasi; mode
 * Detail, Bayangan, dan Satu warna dihitung dari gambar depan di browser.
 */
export function useFoilMask(
  art: Ref<string | undefined>,
  designMask: Ref<string | undefined>,
  mode: Ref<string>,
) {
  // Selama mask dihitung, lapisan foil bawaan ilustrasi yang tampil, seperti sebelumnya.
  const first = cachedMask(art.value, designMask.value, mode.value)
  const mask = ref<string | undefined>(first ?? designMask.value)
  const busy = ref(false)
  let token = 0

  watch(
    [art, designMask, mode],
    async ([source, design, current]) => {
      const run = ++token
      const hit = cachedMask(source, design, current)
      if (hit !== null) {
        mask.value = hit
        busy.value = false
        return
      }
      busy.value = true
      const url = await foilMaskFor(source, design, current)
      if (run !== token) return
      mask.value = url
      busy.value = false
    },
    { immediate: true },
  )

  return { mask, busy }
}
