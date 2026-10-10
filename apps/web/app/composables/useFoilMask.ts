import type { Ref } from 'vue'
import { foilMap, type FoilMapMode } from '~/utils/foil-map'

// Mask yang sudah dibuat dipakai ulang (per gambar dan mode). Yang paling lama dibuang.
const cache = new Map<string, string>()
const CACHE_LIMIT = 12

function remember(key: string, url: string) {
  cache.set(key, url)
  if (cache.size <= CACHE_LIMIT) return
  const oldest = cache.keys().next().value
  if (oldest === undefined) return
  const oldUrl = cache.get(oldest)
  cache.delete(oldest)
  if (oldUrl) URL.revokeObjectURL(oldUrl)
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
  const mask = ref<string | undefined>(designMask.value)
  const busy = ref(false)
  let token = 0

  watch(
    [art, designMask, mode],
    async ([source, design, current]) => {
      const run = ++token
      if (current === 'design' || !source) {
        mask.value = current === 'design' ? design : undefined
        busy.value = false
        return
      }
      const key = `${source}#${current}`
      const hit = cache.get(key)
      if (hit) {
        mask.value = hit
        busy.value = false
        return
      }
      busy.value = true
      try {
        const image = await rasterize(source)
        const url = await maskToUrl(
          foilMap(image, current as FoilMapMode),
          image.width,
          image.height,
        )
        remember(key, url)
        if (run === token) mask.value = url
      } catch {
        if (run === token) mask.value = undefined
      } finally {
        if (run === token) busy.value = false
      }
    },
    { immediate: true },
  )

  return { mask, busy }
}
