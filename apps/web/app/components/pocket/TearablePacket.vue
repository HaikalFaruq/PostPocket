<script setup lang="ts">
import type { Sticker } from '@postpocket/presets'
import {
  PACKET_W,
  TEAR_DONE,
  TEAR_MAX,
  TEAR_Y,
  autoTear,
  beginTear,
  extendTear,
  startEdge,
  tearProgress,
  tearTip,
  type Tear,
  type TearDir,
} from '~/utils/packet-tear'

/**
 * Kantong yang bisa dibuka dua cara: ketuk (atau Enter/Spasi) untuk menyobek otomatis dari kiri ke
 * kanan, atau geser jari di garis putus-putusnya (digores) dan sobekan memanjang mengikuti gerakan
 * jari, termasuk tinggi dan arahnya. Sobekan yang dilepas sudah hampir di ujung dituntaskan sendiri;
 * yang masih pendek tetap terbuka sebagian dan bisa dilanjutkan dengan goresan atau ketukan.
 * `restored` menampilkan kantong yang sudah terbuka tanpa animasi (kembali lewat Back).
 */
const props = withDefaults(
  defineProps<{ color: string; sticker?: Sticker; opened?: boolean; restored?: boolean }>(),
  { sticker: undefined, opened: false, restored: false },
)
const emit = defineEmits<{ open: [] }>()

const button = ref<HTMLButtonElement | null>(null)
const tear = shallowRef<Tear | null>(props.restored ? autoTear(1, 1) : null)
const pulling = ref(false)
/** Sobekan sedang dituntaskan otomatis (setelah ketuk atau goresan yang hampir sampai). */
const finishing = ref(false)
let gesture: null | {
  id: number
  x: number
  y: number
  /** Posisi jari terakhir dalam satuan gambar; sobekan memanjang sejauh jari bergerak. */
  last: number
  dir: TearDir | 0
  moved: boolean
  /** Hanya geseran yang dimulai di pita atas kantong yang menyobek. */
  band: boolean
} = null
// Klik yang menyusul seretan mouse diabaikan. Jari tidak mengirim klik itu, jadi tandanya dihapus
// lagi di sentuhan berikutnya, dan klik dari keyboard tidak pernah diabaikan.
let swallowClick = false
let anim = 0

/** Posisi jari dalam satuan gambar kantong (viewBox 200×290). */
function toArt(event: PointerEvent) {
  const box = button.value?.querySelector('svg')?.getBoundingClientRect()
  if (!box?.width) return { x: 0, y: TEAR_Y }
  const scale = PACKET_W / box.width
  return { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale }
}

function finish() {
  if (!props.opened) emit('open')
}

function onDown(event: PointerEvent) {
  if (props.opened || anim || (event.pointerType === 'mouse' && event.button !== 0)) return
  const point = toArt(event)
  swallowClick = false
  gesture = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    last: point.x,
    dir: 0,
    moved: false,
    band: point.y <= TEAR_MAX + 22,
  }
}

function onMove(event: PointerEvent) {
  const g = gesture
  if (!g || g.id !== event.pointerId || props.opened) return
  const dx = event.clientX - g.x
  const dy = event.clientY - g.y
  if (Math.hypot(dx, dy) > 8) g.moved = true
  if (!g.dir) {
    // Geser tegak dibiarkan untuk menggulir halaman; geser ke samping di pita atas mulai menyobek.
    if (!g.band || Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return
    // Sobekan yang sudah ada dilanjutkan searah; yang baru mulai dari tepi yang berlawanan.
    g.dir = tear.value?.dir ?? (dx > 0 ? 1 : -1)
    tear.value ??= beginTear(g.dir, toArt(event).y)
    pulling.value = true
    button.value?.setPointerCapture(event.pointerId)
  }
  const point = toArt(event)
  const step = (point.x - g.last) * g.dir
  g.last = point.x
  if (step <= 0) return
  const tip = tearTip(tear.value!)
  tear.value = extendTear(tear.value!, tip.x + g.dir * step, point.y)
  if (tearProgress(tear.value) >= 1) {
    gesture = null
    pulling.value = false
    swallowClick = true
    finish()
  }
}

function onUp(event: PointerEvent) {
  const g = gesture
  if (!g || g.id !== event.pointerId) return
  gesture = null
  if (g.moved) swallowClick = true
  if (!g.dir) return
  pulling.value = false
  if (tear.value && tearProgress(tear.value) >= TEAR_DONE) tearOpen()
}

function onClick(event: MouseEvent) {
  if (swallowClick && event.detail !== 0) {
    swallowClick = false
    return
  }
  if (!props.opened && !anim) tearOpen()
}

/** Sobek otomatis dari ujung sobekan sekarang (atau dari tepi kiri) sampai tuntas. */
function tearOpen() {
  const dir = tear.value?.dir ?? 1
  const from = tear.value ? tearProgress(tear.value) : 0
  let current = tear.value ?? beginTear(dir)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    tear.value = extendTear(current, startEdge(dir) + dir * PACKET_W, TEAR_Y)
    finish()
    return
  }
  const duration = 80 + 620 * (1 - from)
  const t0 = performance.now()
  finishing.value = true
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration)
    // Pelan di awal seperti menarik takik, lalu cepat sampai ujung.
    const p = from + (1 - from) * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
    const x = startEdge(dir) + dir * PACKET_W * p
    current = extendTear(current, x, TEAR_Y + Math.sin(x / 31) * 3.2)
    tear.value = current
    if (t < 1) anim = requestAnimationFrame(step)
    else {
      anim = 0
      finishing.value = false
      finish()
    }
  }
  anim = requestAnimationFrame(step)
}

onBeforeUnmount(() => cancelAnimationFrame(anim))

// Foto di tali terbang keluar dari kantong ini.
defineExpose({ el: button })

// Sobekan yang berhenti di tengah jalan: beri tahu cara melanjutkannya.
const started = computed(
  () => !!tear.value && tearProgress(tear.value) > 0.01 && !props.opened && !finishing.value,
)
</script>

<template>
  <div class="tearable">
    <button
      ref="button"
      type="button"
      class="tearable__packet"
      :class="{ 'is-pulling': pulling }"
      :aria-label="opened ? 'Kantong sudah dibuka' : 'Buka kantong'"
      :disabled="opened"
      data-testid="tearable-packet"
      :data-progress="tear ? tearProgress(tear).toFixed(2) : '0'"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @click="onClick"
    >
      <SnackPacket
        :color="color"
        :sticker="sticker"
        :tear="tear"
        :opened="opened"
        :instant="restored"
        guide
      />
    </button>
    <p
      v-if="!opened"
      class="mt-5 text-center text-caption text-pocket-muted"
      :class="{ invisible: finishing }"
      aria-hidden="true"
    >
      <template v-if="started">Geser terus sampai ujung, atau ketuk untuk membuka</template>
      <template v-else>
        Ketuk kantong, atau geser jari di
        <span class="whitespace-nowrap">garis putus-putus</span>
      </template>
    </p>
  </div>
</template>

<style scoped>
.tearable__packet {
  display: block;
  width: 100%;
  padding-top: 6%;
  cursor: pointer;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  border-radius: 12px;
}

.tearable__packet.is-pulling {
  cursor: grabbing;
}

.tearable__packet:disabled {
  cursor: default;
}
</style>
