import { createArtJob, type ArtJob, type ArtRecipe } from './folder-art'

// Satu pelukis untuk semua folder di halaman: tiap folder mengantrekan seninya di sini, dan antrean
// hanya memakai beberapa milidetik per frame, jadi deretan folder tidak membuat layar tersendat.
// Hasilnya disimpan per resep dan ukuran, jadi folder dengan seni yang sama tidak dilukis ulang.
// Diadaptasi dari komponen "Glassmorphism Folder Cards" karya Kedhareswer Naidu di 21st.dev (MIT,
// lihat docs/assets.md).

const cache = new Map<string, Promise<HTMLCanvasElement>>()
const queue: { job: ArtJob; priority: number; done: (canvas: HTMLCanvasElement) => void }[] = []
let pumping = false
/** Waktu kerja per frame. Sisanya untuk animasi dan input. */
const BUDGET_MS = 6

function pump() {
  if (pumping) return
  pumping = true
  const tick = () => {
    const until = performance.now() + BUDGET_MS
    while (queue.length && performance.now() < until) {
      const head = queue[0]!
      if (!head.job.step()) continue
      queue.shift()
      const canvas = document.createElement('canvas')
      canvas.width = head.job.width
      canvas.height = head.job.height
      canvas
        .getContext('2d')
        ?.putImageData(new ImageData(head.job.pixels, canvas.width, canvas.height), 0, 0)
      head.done(canvas)
    }
    if (queue.length) requestAnimationFrame(tick)
    else pumping = false
  }
  requestAnimationFrame(tick)
}

/**
 * Lukis seni `recipe` selebar `width` × `height` piksel. Prioritas kecil dikerjakan dulu, tapi
 * pekerjaan yang sedang berjalan tidak pernah disela.
 */
export function paintArt(
  recipe: ArtRecipe,
  seed: number,
  width: number,
  height: number,
  priority = 0,
): Promise<HTMLCanvasElement> {
  const key = JSON.stringify([recipe, seed, Math.round(width), Math.round(height)])
  let painted = cache.get(key)
  if (!painted) {
    painted = new Promise<HTMLCanvasElement>((done) => {
      let at = queue.length
      while (at > 1 && queue[at - 1]!.priority > priority) at--
      queue.splice(at, 0, { job: createArtJob(width, height, recipe, seed), priority, done })
      pump()
    })
    cache.set(key, painted)
  }
  return painted
}
