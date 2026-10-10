import type { Ref } from 'vue'

// Gambar cetak gabungan dipakai ulang per ilustrasi dan warna tinta.
const cache = new Map<string, string>()

interface Front {
  art: string
  /** Lapisan foil bawaan; kosong untuk foto user. */
  foil?: string
}

/**
 * Gambar yang dicetak di sampul. Mode "Sesuai desain" dan foto user memakai gambarnya langsung;
 * ilustrasi di mode lain memakai versi yang lapisan foilnya dicetak sebagai tinta.
 */
export function usePrintArt(front: Ref<Front | undefined>, ink: Ref<string>, mode: Ref<string>) {
  const url = ref<string | undefined>(front.value?.art)
  let token = 0

  watch(
    [front, ink, mode],
    async ([source, color, current]) => {
      const run = ++token
      if (!source || current === 'design' || !source.foil) {
        url.value = source?.art
        return
      }
      const key = `${source.art}|${source.foil}|${color}`
      const hit = cache.get(key)
      if (hit) {
        url.value = hit
        return
      }
      try {
        const inked = await inkedIllustration(source.art, source.foil, color)
        cache.set(key, inked)
        if (run === token) url.value = inked
      } catch {
        if (run === token) url.value = source.art
      }
    },
    { immediate: true },
  )

  return url
}
