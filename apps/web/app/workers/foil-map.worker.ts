import { foilMap, type FoilMapMode, type Raster } from '../utils/foil-map'

// Worker peta foil (dipanggil dari utils/foil-map-worker.ts). Hitungannya sekitar 100 ms di Mac M4
// dan hampir 200 ms di HP kelas menengah, jadi tidak boleh di thread utama selagi kartu bergerak.

interface Job {
  id: number
  raster: Raster
  mode: FoilMapMode
}

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Job>) => void) | null
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

scope.onmessage = (event) => {
  const { id, raster, mode } = event.data
  try {
    const mask = foilMap(raster, mode)
    scope.postMessage({ id, mask }, [mask.buffer])
  } catch {
    scope.postMessage({ id })
  }
}
