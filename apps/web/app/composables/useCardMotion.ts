import type { Ref } from 'vue'
import {
  clamp,
  frameStats,
  frontAngle,
  hoverTilt,
  isTap,
  restAngle,
  sheen,
  springStep,
  type FrameStats,
} from '~/utils/card-motion'

interface Options {
  /** Area kartu, dipakai sebagai acuan posisi mouse untuk hover tilt. */
  stage: Ref<HTMLElement | null>
  /** Elemen yang diputar. Gaya ditulis langsung tiap frame, tanpa reaktivitas Vue. */
  rotor: Ref<HTMLElement | null>
  open: Ref<boolean>
  onTap: () => void
}

/**
 * Drag untuk memutar, tap untuk membuka, pegas kembali ke muka terdekat, dan kilau foil
 * yang mengikuti sudut. Setiap frame hanya menulis `transform` rotor dan empat CSS variable
 * (--mx, --my, --gx, --gy) yang dipakai lapisan foil.
 */
export function useCardMotion({ stage, rotor, open, onTap }: Options) {
  const reducedMotion = usePreferredReducedMotion()
  const state = { rx: 0, ry: 0, vx: 0, vy: 0, tx: 0, ty: 0 }
  let mode: 'rest' | 'drag' | 'spring' | 'bench' = 'rest'
  let frame = 0
  let lastTime = 0
  const drag = { id: -1, x: 0, y: 0, t: 0, rx: 0, ry: 0, moved: false }
  const samples: { t: number; ry: number }[] = []

  function write() {
    const el = rotor.value
    if (!el) return
    el.style.transform = `rotateX(${state.rx.toFixed(2)}deg) rotateY(${state.ry.toFixed(2)}deg)`
    const s = sheen(state.rx, state.ry)
    el.style.setProperty('--mx', `${s.metalX.toFixed(2)}%`)
    el.style.setProperty('--my', `${s.metalY.toFixed(2)}%`)
    el.style.setProperty('--gx', `${s.glareX.toFixed(2)}%`)
    el.style.setProperty('--gy', `${s.glareY.toFixed(2)}%`)
  }

  function loop(now: number) {
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 1 / 60)
    lastTime = now
    if (mode === 'spring') {
      ;[state.rx, state.vx] = springStep(state.rx, state.vx, state.tx, dt)
      ;[state.ry, state.vy] = springStep(state.ry, state.vy, state.ty, dt)
      // Selisih 0,25° tidak terlihat; kunci ke target supaya kartu tidak bergetar sub-piksel.
      const settled =
        Math.abs(state.rx - state.tx) < 0.25 &&
        Math.abs(state.ry - state.ty) < 0.25 &&
        Math.abs(state.vx) < 0.5 &&
        Math.abs(state.vy) < 0.5
      if (settled) {
        state.rx = state.tx
        state.ry = state.ty
        state.vx = 0
        state.vy = 0
        mode = 'rest'
      }
    }
    write()
    frame = mode === 'rest' || mode === 'bench' ? 0 : requestAnimationFrame(loop)
  }

  function kick() {
    if (frame) return
    lastTime = performance.now()
    frame = requestAnimationFrame(loop)
  }

  function springTo(rx: number, ry: number) {
    state.tx = rx
    state.ty = ry
    if (reducedMotion.value === 'reduce') {
      Object.assign(state, { rx, ry, vx: 0, vy: 0 })
      mode = 'rest'
      write()
      return
    }
    if (mode !== 'drag') mode = 'spring'
    kick()
  }

  /**
   * Kecepatan putar terakhir dalam derajat per milidetik. Nol kalau jari atau mouse sudah diam
   * sebelum dilepas, supaya kartu yang ditahan lalu dilepas tidak ikut terlempar.
   */
  function velocity(): number {
    const first = samples[0]
    const last = samples.at(-1)
    if (!first || !last || last.t - first.t < 8) return 0
    if (performance.now() - last.t > 60) return 0
    return (last.ry - first.ry) / (last.t - first.t)
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (mode === 'bench') return
    rotor.value?.setPointerCapture(event.pointerId)
    Object.assign(drag, {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
      rx: state.rx,
      ry: state.ry,
      moved: false,
    })
    samples.length = 0
    state.vx = 0
    state.vy = 0
    mode = 'drag'
    kick()
  }

  function onPointerMove(event: PointerEvent) {
    if (mode === 'drag' && event.pointerId === drag.id) {
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true
      // Kartu yang terbuka hanya boleh miring sedikit; yang tertutup bisa diputar sampai belakang.
      state.ry = open.value ? clamp(drag.ry + dx * 0.3, -16, 16) : drag.ry + dx * 0.45
      state.rx = clamp(drag.rx - dy * 0.25, open.value ? -10 : -28, open.value ? 10 : 28)
      const now = performance.now()
      samples.push({ t: now, ry: state.ry })
      while (samples.length > 2 && now - (samples[0]?.t ?? now) > 90) samples.shift()
      return
    }
    if (event.pointerType !== 'mouse' || mode === 'drag' || mode === 'bench') return
    if (reducedMotion.value === 'reduce' || !stage.value) return
    const rect = stage.value.getBoundingClientRect()
    const tilt = hoverTilt(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    )
    springTo(tilt.rx, restAngle(state.ty) + tilt.ry)
  }

  function onPointerUp(event: PointerEvent) {
    if (mode !== 'drag' || event.pointerId !== drag.id) return
    mode = 'spring'
    const ms = performance.now() - drag.t
    if (!drag.moved && isTap(event.clientX - drag.x, event.clientY - drag.y, ms)) {
      onTap()
      return
    }
    springTo(0, open.value ? 0 : restAngle(state.ry, velocity()))
  }

  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType === 'mouse' && mode !== 'drag' && mode !== 'bench') {
      springTo(0, restAngle(state.ty))
    }
  }

  /** Putar ke sampul depan, misalnya sebelum kartu dibuka. */
  function faceFront() {
    springTo(0, frontAngle(state.ry))
  }

  /** Putar sejauh `degrees` lalu berhenti di muka terdekat (tombol panah, Surprise me). */
  function turnBy(degrees: number) {
    if (open.value) return
    springTo(0, restAngle(state.ty + degrees))
  }

  /**
   * Uji performa: putar kartu mengikuti lintasan tetap selama `ms` dan catat durasi tiap frame.
   * Hasilnya bisa dibandingkan antar-perangkat karena lintasannya selalu sama.
   */
  function benchmark(ms = 4000): Promise<FrameStats> {
    return new Promise((resolve) => {
      cancelAnimationFrame(frame)
      frame = 0
      mode = 'bench'
      const deltas: number[] = []
      let start = 0
      let previous = 0
      const step = (now: number) => {
        if (!start) start = previous = now
        else deltas.push(now - previous)
        previous = now
        const t = (now - start) / 1000
        state.ry = Math.sin(t * 2.2) * 40 + Math.sin(t * 0.7) * 25
        state.rx = Math.sin(t * 3.1) * 14
        write()
        if (now - start < ms) {
          requestAnimationFrame(step)
          return
        }
        mode = 'rest'
        springTo(0, 0)
        resolve(frameStats(deltas))
      }
      requestAnimationFrame(step)
    })
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onTap()
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      turnBy(event.key === 'ArrowLeft' ? -180 : 180)
    }
  }

  onMounted(write)
  onBeforeUnmount(() => cancelAnimationFrame(frame))

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onPointerLeave,
    onKeydown,
    faceFront,
    turnBy,
    benchmark,
  }
}
