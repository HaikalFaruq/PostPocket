import { foilMap, type FoilMapMode, type Raster } from './foil-map'

// Peta foil dihitung di Web Worker (workers/foil-map.worker.ts), supaya kartu yang sedang
// disiapkan atau dibuka tidak membekukan layar. Kalau worker tidak bisa dipakai (misalnya
// berkasnya belum tersimpan saat offline), peta foil dihitung di thread utama seperti dulu.

let worker: Worker | null = null
let broken = false
let nextId = 0
const pending = new Map<number, (mask: Uint8ClampedArray | null) => void>()

function foilWorker(): Worker | null {
  if (worker || broken) return worker
  if (typeof Worker === 'undefined') {
    broken = true
    return null
  }
  try {
    worker = new Worker(new URL('../workers/foil-map.worker.ts', import.meta.url), {
      type: 'module',
    })
  } catch {
    broken = true
    return null
  }
  worker.onmessage = (event: MessageEvent<{ id: number; mask?: Uint8ClampedArray }>) => {
    const done = pending.get(event.data.id)
    pending.delete(event.data.id)
    done?.(event.data.mask ?? null)
  }
  worker.onerror = () => {
    broken = true
    worker?.terminate()
    worker = null
    for (const done of pending.values()) done(null)
    pending.clear()
  }
  return worker
}

/** `foilMap()` di Web Worker. Pikselnya disalin, jadi `raster` tetap utuh untuk cadangannya. */
export async function foilMapOffThread(
  raster: Raster,
  mode: FoilMapMode,
): Promise<Uint8ClampedArray> {
  const target = foilWorker()
  if (target) {
    const id = nextId++
    const { data, width, height } = raster
    const mask = await new Promise<Uint8ClampedArray | null>((resolve) => {
      pending.set(id, resolve)
      target.postMessage({ id, raster: { data, width, height }, mode })
    })
    if (mask) return mask
  }
  return foilMap(raster, mode)
}
