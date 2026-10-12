<script setup lang="ts">
import {
  easeOutBack,
  flingTarget,
  lineSpring,
  nearestAt,
  pad2,
  printWidth,
  stringY,
  swingStep,
} from '~/utils/photo-line'

/**
 * Foto kantong yang sudah dibuka, dijepit jepitan kayu di tali yang melengkung (gaya Polaroid Line
 * Carousel). Tali bisa diseret, diketuk fotonya, digeser panah keyboard, atau lewat tombol; foto
 * berayun di jepitannya mengikuti kecepatan geseran lalu tenang dengan sedikit pantulan, dan tetap
 * bergoyang pelan tertiup angin. Foto di tengah adalah yang sedang dilihat (`v-model:index`).
 * Simulasinya ditulis langsung ke DOM tiap frame, bukan lewat state Vue.
 */
export interface LinePhoto {
  id: string
  src: string | null
  /** Tulisan di bingkai foto, misalnya jamnya. */
  note?: string
  /** Judul di bawah tali untuk foto yang sedang di tengah. */
  title: string
  caption?: string
}

const props = withDefaults(
  defineProps<{
    photos: LinePhoto[]
    frame?: 'polaroid' | 'stamp' | 'ticket'
    frameColor?: string
    /** Lebar foto paling besar, px. Di layar sempit mengecil. */
    maxPrint?: number
    /** Kedalaman lengkung tali di tengah, px. */
    sag?: number
    /** Seberapa kuat foto berayun; 0 membuatnya diam. */
    swing?: number
    /** Ms per foto. Berhenti untuk seterusnya begitu user menyentuh layar; 0 mematikannya. */
    autoplay?: number
    /** Foto pertama kali keluar dari elemen ini (kantong yang baru disobek), lalu terbang ke tali. */
    from?: HTMLElement | null
    /** Tinggi mulut kantong di elemen `from`, 0 di atas sampai 1 di bawah. */
    fromY?: number
  }>(),
  {
    frame: 'polaroid',
    frameColor: '#fbf6ec',
    maxPrint: 220,
    sag: 40,
    swing: 1,
    autoplay: 4500,
    from: null,
    fromY: 0.2,
  },
)

const index = defineModel<number>('index', { default: 0 })

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Tinggi ujung tali dari atas panggung.
const Y0 = 24
// Lama foto keluar dari kantong sampai dijepit, dan porsi waktu saat foto masih naik dari dalam.
const FLIGHT_MS = 900
const RISE = 0.28

const stage = ref<HTMLElement | null>(null)
const path = ref<SVGPathElement | null>(null)
const cards: (HTMLElement | null)[] = []
const size = reactive({ w: 0, cw: 160, sag: props.sag, stageH: 320 })
const dragging = ref(false)

const count = computed(() => props.photos.length)
const spacing = computed(() => size.cw * 1.08)
const current = computed(() => props.photos[clamp(index.value, 0, count.value - 1)])

// Keadaan simulasi: geseran tali, sudut dan putaran tiap foto.
const sim = { off: 0, vel: 0, target: 0, angle: [] as number[], spin: [] as number[] }
let active = clamp(index.value, 0, Math.max(0, count.value - 1))
let drag: null | {
  id: number
  x: number
  off: number
  lx: number
  lt: number
  v: number
  moved: boolean
} = null
// Foto keluar dari kantong satu per satu: waktu mulai per foto dan titik asalnya.
let entrance: { x: number; y: number; start: number[] } | null = null
let userTook = false

function goTo(i: number) {
  sim.target = clamp(i, 0, count.value - 1) * spacing.value
}

function step(dir: number) {
  userTook = true
  goTo(active + dir)
}

// Pindah dari luar (misalnya ke foto yang baru ditambahkan) juga menghentikan putar otomatis.
watch(index, (i) => {
  if (i === active) return
  userTook = true
  goTo(i)
})

function measure() {
  const el = stage.value
  if (!el) return
  const w = el.clientWidth
  const cw = printWidth(w, Math.max(window.innerHeight * 0.62, 280), props.maxPrint)
  size.w = w
  size.cw = cw
  size.sag = Math.min(props.sag, w * 0.08)
  nextTick(() => {
    const tallest = Math.max(0, ...cards.map((card) => card?.offsetHeight ?? 0))
    size.stageH = Math.round(Y0 + size.sag + tallest + 18)
  })
}

// Geseran tali tetap di foto yang sama saat ukurannya berubah.
watch(spacing, (next) => {
  sim.target = active * next
  sim.off = active * next
})

watch(count, (n, before) => {
  if (active > n - 1) goTo(n - 1)
  if (n !== before) nextTick(measure)
})

function onDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  userTook = true
  drag = {
    id: event.pointerId,
    x: event.clientX,
    off: sim.off,
    lx: event.clientX,
    lt: event.timeStamp,
    v: 0,
    moved: false,
  }
}

function onMove(event: PointerEvent) {
  const d = drag
  if (!d || d.id !== event.pointerId) return
  const dx = event.clientX - d.x
  if (!d.moved && Math.abs(dx) > 5) {
    d.moved = true
    dragging.value = true
    stage.value?.setPointerCapture(event.pointerId)
  }
  if (!d.moved) return
  const dt = Math.max(1, event.timeStamp - d.lt)
  d.v = 0.7 * ((event.clientX - d.lx) / dt) + 0.3 * d.v
  d.lx = event.clientX
  d.lt = event.timeStamp
  // Di ujung tali geserannya makin berat, seperti ditahan.
  const max = (count.value - 1) * spacing.value
  let off = d.off - dx
  if (off < 0) off *= 0.35
  if (off > max) off = max + (off - max) * 0.35
  sim.off = off
}

function onUp(event: PointerEvent) {
  const d = drag
  if (!d || d.id !== event.pointerId) return
  drag = null
  if (d.moved) {
    dragging.value = false
    sim.vel = -d.v * 1000
    goTo(flingTarget(sim.off, d.v, spacing.value, count.value))
    return
  }
  // Ketukan (bukan geseran yang dibatalkan browser) di foto tetangga membawanya ke tengah.
  if (event.type !== 'pointerup') return
  const card = (event.target as HTMLElement).closest<HTMLElement>('[data-i]')
  if (card) goTo(Number(card.dataset.i))
}

function onKey(event: KeyboardEvent) {
  const keys: Record<string, number> = {
    ArrowRight: active + 1,
    ArrowLeft: active - 1,
    Home: 0,
    End: count.value - 1,
  }
  const next = keys[event.key]
  if (next === undefined) return
  event.preventDefault()
  userTook = true
  goTo(next)
}

let raf = 0
let visible = true
let reduce = false
let prev = 0
let observer: IntersectionObserver | null = null
let resize: ResizeObserver | null = null
let timer = 0

function tick(now: number) {
  raf = 0
  if (!visible) return
  const dt = Math.min(0.033, (now - prev) / 1000)
  prev = now
  const n = count.value
  const { w, cw, sag } = size
  const gap = spacing.value
  const d = drag
  let lineVel: number
  if (d?.moved) {
    lineVel = d.v * 1000
  } else {
    const before = sim.off
    if (reduce) {
      sim.off = sim.target
      sim.vel = 0
    } else {
      ;[sim.off, sim.vel] = lineSpring(sim.off, sim.vel, sim.target, dt)
    }
    lineVel = -(sim.off - before) / Math.max(dt, 1e-3)
  }
  const gain = reduce ? 0 : props.swing
  const near = nearestAt(sim.off, gap, n)
  let flying = false
  for (let i = 0; i < n; i++) {
    const el = cards[i]
    if (!el) continue
    const x = w / 2 + i * gap - sim.off
    let angle = sim.angle[i] ?? 0
    let spin = sim.spin[i] ?? 0
    ;[angle, spin] = swingStep(angle, spin, lineVel, dt, gain)
    if (gain) angle += Math.sin(now / 1300 + i * 1.7) * 0.0009 * gain
    let left = x - cw / 2
    let top = stringY(x, w, Y0, sag) - 4
    let scale = 1
    let opacity = 1
    let behind = false
    const start = entrance?.start[i]
    if (entrance && start !== undefined) {
      const t = (now - start) / FLIGHT_MS
      if (t < 1) {
        flying = true
        // Naik dulu dari dalam kantong (di balik foilnya), lalu terbang dan dijepit di tali.
        const peek = entrance.y - 34
        if (t < RISE) {
          const u = Math.max(0, t) / RISE
          behind = true
          left = entrance.x - cw / 2
          top = entrance.y + 30 - (entrance.y + 30 - peek) * (1 - (1 - u) * (1 - u))
          scale = 0.55
          opacity = t <= 0 ? 0 : 1
          angle = (i % 2 ? 0.08 : -0.08) * u
        } else {
          const v = (t - RISE) / (1 - RISE)
          const e = easeOutBack(v)
          const lift = Math.sin(Math.PI * v) * 46
          left = entrance.x - cw / 2 + (left - (entrance.x - cw / 2)) * e
          top = peek + (top - peek) * e - lift
          scale = 0.55 + 0.45 * Math.min(1, e)
          angle = (1 - Math.min(1, e)) * (i % 2 ? 0.4 : -0.4)
        }
        spin = (i % 2 ? -1 : 1) * 2.4
      }
    }
    if (!flying && (x < -cw * 1.5 || x > w + cw * 1.5)) {
      el.style.visibility = 'hidden'
      continue
    }
    el.style.visibility = 'visible'
    sim.angle[i] = angle
    sim.spin[i] = spin
    el.style.opacity = opacity === 1 ? '' : opacity.toFixed(2)
    el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) rotate(${angle.toFixed(4)}rad)${scale === 1 ? '' : ` scale(${scale.toFixed(3)})`}`
    // Selama masih di dalam kantong, foto ada di belakang kantong (z-20); setelah keluar, di
    // depannya. Tetap di bawah modal dan lembar (z-40 ke atas).
    el.style.zIndex = behind
      ? '1'
      : String(21 + (i === near ? 15 : Math.max(0, 14 - Math.abs(i - near))))
  }
  if (entrance && !flying && now > Math.max(...entrance.start) + FLIGHT_MS) entrance = null
  path.value?.setAttribute('d', `M0 ${Y0} Q${w / 2} ${Y0 + 2 * sag} ${w} ${Y0}`)
  if (near !== active) {
    active = near
    index.value = near
  }
  raf = requestAnimationFrame(tick)
}

function startEntrance() {
  const origin = props.from?.getBoundingClientRect()
  const box = stage.value?.getBoundingClientRect()
  if (!origin || !box || reduce) return
  const now = performance.now()
  entrance = {
    x: origin.left + origin.width / 2 - box.left,
    y: origin.top + origin.height * props.fromY - box.top,
    start: props.photos.map((_, i) => now + 160 + i * 150),
  }
}

/** Putar otomatis ke foto berikutnya sampai user menyentuh layar atau menekan tombol. */
function autoplayTick() {
  if (userTook || drag || entrance || document.hidden || !visible) return
  goTo(active >= count.value - 1 ? 0 : active + 1)
}

function takeOver() {
  userTook = true
}

onMounted(() => {
  reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  sim.off = sim.target = active * spacing.value
  measure()
  resize = new ResizeObserver(measure)
  if (stage.value) resize.observe(stage.value)
  observer = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting
    if (visible && !raf) {
      prev = performance.now()
      raf = requestAnimationFrame(tick)
    }
  })
  if (stage.value) observer.observe(stage.value)
  nextTick(startEntrance)
  prev = performance.now()
  raf = requestAnimationFrame(tick)
  if (props.autoplay && !reduce) timer = window.setInterval(autoplayTick, props.autoplay)
  window.addEventListener('pointerdown', takeOver, { capture: true, passive: true })
  window.addEventListener('keydown', takeOver, { capture: true, passive: true })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
  resize?.disconnect()
  window.clearInterval(timer)
  window.removeEventListener('pointerdown', takeOver, { capture: true })
  window.removeEventListener('keydown', takeOver, { capture: true })
})

const live = computed(() =>
  current.value ? `Foto ${index.value + 1} dari ${count.value}: ${current.value.title}` : '',
)
</script>

<template>
  <div
    class="line"
    :class="{ 'is-drag': dragging }"
    role="region"
    aria-roledescription="carousel"
    aria-label="Foto di kantong"
    tabindex="0"
    data-testid="photo-line"
    :data-index="index"
    :style="{ '--print': `${size.cw}px` }"
    @keydown="onKey"
  >
    <div
      ref="stage"
      class="line__stage"
      :style="{ height: `${size.stageH}px` }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <svg class="line__string" aria-hidden="true">
        <path ref="path" fill="none" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <div
        v-for="(photo, i) in photos"
        :key="photo.id"
        :ref="(el) => (cards[i] = el as HTMLElement | null)"
        class="line__card"
        :data-i="i"
        :data-on="i === index"
        :aria-hidden="i === index ? undefined : true"
        data-testid="line-photo"
      >
        <div class="line__print">
          <PhotoFrame
            :variant="frame"
            :color="frameColor"
            :src="photo.src ?? undefined"
            :alt="`Foto ${i + 1} dari ${count}`"
            :caption="photo.note"
          >
            <span class="sr-only">Memuat foto</span>
          </PhotoFrame>
        </div>
        <span class="line__peg clothespin" aria-hidden="true" />
      </div>
    </div>

    <div class="line__bar">
      <div :key="index" class="line__cap" aria-hidden="true">
        <span class="line__title">{{ current?.title }}</span>
        <span v-if="current?.caption" class="line__sub">{{ current.caption }}</span>
      </div>
      <span class="line__count" aria-hidden="true" data-testid="line-count">
        <b>{{ pad2(index + 1) }}</b> / {{ pad2(count) }}
      </span>
      <IconButton label="Foto sebelumnya" size="sm" :disabled="index <= 0" @click="step(-1)">
        <Icon name="chevron-left" :size="16" />
      </IconButton>
      <IconButton label="Foto berikutnya" size="sm" :disabled="index >= count - 1" @click="step(1)">
        <Icon name="chevron-right" :size="16" />
      </IconButton>
    </div>
    <p class="sr-only" aria-live="polite">{{ live }}</p>
  </div>
</template>

<style scoped>
.line {
  position: relative;
  border-radius: 16px;
}

.line__stage {
  position: relative;
  /* Foto yang terbang dari kantong boleh lewat di atas panggung, tapi tidak membuat geser samping. */
  overflow-x: clip;
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.line.is-drag .line__stage {
  cursor: grabbing;
}

.line__string {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  stroke: var(--color-pocket-twine);
}

.line__card {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--print);
  transform-origin: 50% 0;
  will-change: transform;
  visibility: hidden;
}

.line__print {
  margin-top: 14px;
  transition:
    transform 500ms var(--ease-card),
    filter 500ms ease;
}

.line__card[data-on='false'] .line__print {
  transform: scale(0.9);
  filter: saturate(0.75) brightness(0.97);
}

.line__peg {
  position: absolute;
  top: 0;
  left: 50%;
  width: 11px;
  height: 30px;
  margin-left: -5.5px;
}

.line__bar {
  display: flex;
  max-width: 48rem;
  align-items: center;
  gap: 10px;
  margin-inline: auto;
  padding: 4px 16px 0;
}

.line__cap {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  padding-bottom: 0.15em;
}

.line__cap > * {
  display: block;
  animation: cap-in 550ms var(--ease-card) both;
}

.line__title {
  overflow: hidden;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line__sub {
  margin-top: 2px;
  color: var(--color-pocket-muted);
  font-size: var(--text-caption);
}

.line__count {
  color: var(--color-pocket-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.line__count b {
  color: var(--color-pocket-ink);
  font-weight: 600;
}

@keyframes cap-in {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .line__cap > * {
    animation: none;
  }

  .line__print {
    transition: none;
  }
}
</style>
