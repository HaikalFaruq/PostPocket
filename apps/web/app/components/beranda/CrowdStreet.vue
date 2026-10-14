<script setup lang="ts">
import {
  PEEPS,
  calmSpots,
  crowdSize,
  nextPeep,
  peepHeight,
  peepWidth,
  walkSpeed,
} from '~/utils/crowd'
import { calmMotion } from '~/utils/render'

/**
 * Orang-orang yang berjalan pelan di atas footer Beranda. Diadaptasi dari Skiper 39 (Crowd
 * Canvas) karya Skiper UI, yang terinspirasi dari pen zadvorsky; gambar orangnya Open Peeps karya
 * Pablo Stanley (CC0), diwarnai tinta PostPocket (lihat docs/assets.md). Lebih tenang dari
 * aslinya: lebih sedikit orang, langkahnya pelan, dan pinggirnya memudar. Gambarnya baru dimuat
 * saat pitanya hampir terlihat, dan kerumunannya diam saat tidak terlihat, saat tab ditinggal,
 * saat gerakan diminta dikurangi, dan di perangkat tanpa GPU.
 */
const box = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

interface Walker {
  cell: number
  x: number
  y: number
  dir: 1 | -1
  speed: number
  step: number
}

let dispose: (() => void) | undefined

onMounted(() => {
  const el = box.value
  const cv = canvas.value
  const ctx = cv?.getContext('2d')
  if (!el || !cv || !ctx) return
  const calm = calmMotion()
  const image = new Image()
  const walkers: Walker[] = []
  let width = 0
  let height = 0
  let ph = 0
  let pw = 0
  let ready = false
  let near = false
  let raf = 0
  let last = 0
  // Gambar yang selesai dimuat setelah komponennya dilepas tidak boleh menyalakan putaran lagi.
  let alive = true

  /** Satu orang baru: masuk dari salah satu tepi, atau sudah `progress` jalan di tengah. */
  function walker(progress: number, dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1): Walker {
    const span = width + pw
    return {
      cell: nextPeep(
        walkers.map((w) => w.cell),
        Math.random(),
      ),
      x: dir > 0 ? -pw + span * progress : width - span * progress,
      // Yang lebih rendah di layar terasa lebih dekat; separuh badan bawahnya terpotong tepi pita.
      y: height - ph * (0.62 + 0.3 * Math.random() ** 1.6),
      dir,
      speed: walkSpeed(Math.random()),
      step: Math.random() * Math.PI,
    }
  }

  function draw(t: number) {
    ctx!.clearRect(0, 0, width, height)
    for (const w of walkers) {
      const bob = calm ? 0 : -Math.abs(Math.sin(w.step + t * 6.2)) * 2.6
      const sx = (w.cell % PEEPS.cols) * PEEPS.cell[0]
      const sy = Math.floor(w.cell / PEEPS.cols) * PEEPS.cell[1]
      ctx!.save()
      ctx!.translate(w.dir < 0 ? w.x + pw : w.x, w.y + bob)
      ctx!.scale(w.dir, 1)
      ctx!.drawImage(image, sx, sy, PEEPS.cell[0], PEEPS.cell[1], 0, 0, pw, ph)
      ctx!.restore()
    }
  }

  function layout() {
    width = el!.clientWidth
    height = el!.clientHeight
    if (!width || !height || !ready) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv!.width = Math.round(width * dpr)
    cv!.height = Math.round(height * dpr)
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    ph = peepHeight(height)
    pw = peepWidth(ph)
    walkers.length = 0
    const n = crowdSize(width, pw)
    // Tanpa gerakan: berjajar rata dan bergantian arah, supaya tetap terlihat seperti kerumunan.
    const spots = calmSpots(n, width, pw)
    for (let i = 0; i < n; i++) {
      walkers.push(
        calm ? { ...walker(0, i % 2 ? -1 : 1), x: spots[i] ?? 0 } : walker(Math.random()),
      )
    }
    walkers.sort((a, b) => a.y - b.y)
    draw(performance.now() / 1000)
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    let joined = false
    walkers.forEach((w, i) => {
      w.x += w.dir * w.speed * dt
      if ((w.dir > 0 && w.x > width) || (w.dir < 0 && w.x < -pw)) {
        walkers[i] = walker(0)
        joined = true
      }
    })
    if (joined) walkers.sort((a, b) => a.y - b.y)
    draw(now / 1000)
    raf = requestAnimationFrame(frame)
  }

  /** Jalan hanya selama pitanya terlihat dan tabnya dibuka. */
  function update() {
    const run = alive && ready && near && !calm && document.visibilityState === 'visible'
    if (run && !raf) {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    } else if (!run && raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  const seen = new IntersectionObserver(
    (entries) => {
      near = entries.some((entry) => entry.isIntersecting)
      if (near && !image.src) {
        image.src = PEEPS.src
        image
          .decode()
          .then(() => {
            if (!alive) return
            ready = true
            layout()
            update()
          })
          .catch(() => {})
      }
      update()
    },
    { rootMargin: '300px 0px' },
  )
  seen.observe(el)
  let pending = 0
  const resized = new ResizeObserver(() => {
    cancelAnimationFrame(pending)
    pending = requestAnimationFrame(layout)
  })
  resized.observe(el)
  document.addEventListener('visibilitychange', update)

  dispose = () => {
    alive = false
    seen.disconnect()
    resized.disconnect()
    cancelAnimationFrame(pending)
    cancelAnimationFrame(raf)
    document.removeEventListener('visibilitychange', update)
  }
})
onBeforeUnmount(() => dispose?.())
</script>

<template>
  <div ref="box" class="crowd" aria-hidden="true">
    <canvas ref="canvas" class="block size-full" />
  </div>
</template>

<style scoped>
/* Pinggir kiri dan kanan memudar, jadi orang muncul dan pergi dengan halus. */
.crowd {
  mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent);
}
</style>
