import type { Ref } from 'vue'

// Gambar cetak gabungan dipakai ulang per ilustrasi dan warna tinta.
const cache = new Map<string, string>()

export interface Front {
  art: string
  /** Lapisan foil bawaan; kosong untuk foto user. */
  foil?: string
}

/**
 * Gambar cetak untuk `front`, langsung dari cache kalau sudah pernah dibuat. Dipakai juga untuk
 * menyiapkan kartu sebelum tampil (`warmCardFront`), jadi hasilnya sama dengan `usePrintArt`.
 */
export async function printArtFor(
  front: Front | undefined,
  ink: string,
  mode: string,
): Promise<string | undefined> {
  if (!front || mode === 'design' || !front.foil) return front?.art
  const key = `${front.art}|${front.foil}|${ink}`
  const hit = cache.get(key)
  if (hit) return hit
  try {
    const inked = await inkedIllustration(front.art, front.foil, ink)
    cache.set(key, inked)
    return inked
  } catch {
    return front.art
  }
}

/** Gambar cetak dari cache, tanpa menunggu; `null` kalau belum pernah dibuat. */
function cachedPrintArt(front: Front | undefined, ink: string, mode: string) {
  if (!front || mode === 'design' || !front.foil) return front?.art
  return cache.get(`${front.art}|${front.foil}|${ink}`) ?? null
}

/**
 * Gambar yang dicetak di sampul. Mode "Sesuai desain" dan foto user memakai gambarnya langsung;
 * ilustrasi di mode lain memakai versi yang lapisan foilnya dicetak sebagai tinta.
 */
export function usePrintArt(front: Ref<Front | undefined>, ink: Ref<string>, mode: Ref<string>) {
  // Kartu yang sudah disiapkan langsung tampil dengan gambar akhirnya, tanpa berganti gambar.
  const url = ref<string | undefined>(
    cachedPrintArt(front.value, ink.value, mode.value) ?? front.value?.art,
  )
  let token = 0

  watch(
    [front, ink, mode],
    async ([source, color, current]) => {
      const run = ++token
      const hit = cachedPrintArt(source, color, current)
      if (hit !== null) {
        url.value = hit
        return
      }
      const inked = await printArtFor(source, color, current)
      if (run === token) url.value = inked
    },
    { immediate: true },
  )

  return url
}
