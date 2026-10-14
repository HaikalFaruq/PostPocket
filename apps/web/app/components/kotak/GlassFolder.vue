<script setup lang="ts">
import { byId, kotak } from '@postpocket/presets'
import { FOLDER_HEADROOM, fanSlot, hashString, openRoom, rng } from '~/utils/folder-art'
import { paintArt } from '~/utils/folder-paint'

/**
 * Folder kaca untuk Kotak surat, diadaptasi dari komponen "Glassmorphism Folder Cards" karya
 * Kedhareswer Naidu (https://21st.dev/kedhareswer/glass-folder-cards/default, lisensi MIT,
 * pemberitahuannya di docs/assets.md). Tiga lapis dari belakang ke depan: panel belakang berisi
 * seni dari preset, surat-surat di dalamnya, lalu panel depan dari kaca buram yang mengaburkan apa
 * pun di belakangnya.
 *
 * - Diam: rata dan tertutup, ujung atas surat baru sedikit terlihat di balik kaca.
 * - Disorot mouse atau difokus keyboard: kaca condong ke depan di engsel bawahnya, surat sedikit
 *   terangkat. Tidak setelah diketuk di HP, supaya folder yang ditutup kembali rata.
 * - Dibuka (ketuk, Enter, Spasi): kaca jatuh lebih jauh, surat naik dan menyebar seperti kipas,
 *   dan tiap surat jadi tombol. Ruang di atas folder ikut membesar, jadi kipasnya tidak menutupi
 *   judul di atasnya.
 * - Disegel (`sealed`): tidak bisa dibuka, dengan cap tanggal di kacanya, dan bergoyang saat
 *   diketuk.
 */
export interface FolderFile {
  id: string
  /** Baris pertama di lembarnya, misalnya "Dari Budi". */
  name: string
  meta?: string
  /** Gambar depan surat. Tanpa gambar, lembarnya jadi kertas bergaris. */
  image?: string | null
  /** Warna kertas di balik gambarnya. */
  paper?: string
  unread?: boolean
}

const props = withDefaults(
  defineProps<{
    label: string
    /** Baris kedua. Bawaannya jumlah surat. */
    meta?: string
    /** Id `kotak.folders`, atau `none` untuk panel belakang polos. */
    art?: string
    /** Susunan lain dari resep yang sama. */
    seed?: number
    files?: FolderFile[]
    /** Lebar dalam px; tingginya 0,96 × lebar. */
    width?: number
    /** Tersusun sendiri saat pertama kali terlihat di layar. */
    appear?: boolean
    appearDelay?: number
    labelPlacement?: 'bottom-left' | 'top-left'
    /** Belum bisa dibuka; `sealedText` tampil sebagai cap di kacanya. */
    sealed?: boolean
    sealedText?: string
  }>(),
  {
    meta: undefined,
    art: 'par-avion',
    seed: 3,
    files: () => [],
    width: 340,
    appear: true,
    appearDelay: 0,
    labelPlacement: 'bottom-left',
    sealed: false,
    sealedText: undefined,
  },
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [file: FolderFile, index: number] }>()

// Geometri dalam satuan folder sendiri: panggungnya digambar 340 × 272 lalu diskalakan ke
// `width`, jadi bentuknya bisa berupa path tetap.
const W = 340
const H = 272
/** Ruang di atas panel belakang tempat surat naik saat folder dibuka. */
const HEADROOM = FOLDER_HEADROOM
const FRONT_TOP = 74
const FRONT_H = H - FRONT_TOP
const SHEET_W = 272
const SHEET_H = 184
/** Surat yang terlihat di kipas. Sisanya ada di daftar di bawah folder. */
const MAX_VISIBLE = 4

const BACK_PATH =
  'M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z'
const FRONT_PATH = `M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 ${FRONT_H - 22}A22 22 0 0 1 318 ${FRONT_H}L22 ${FRONT_H}A22 22 0 0 1 0 ${FRONT_H - 22}Z`

const uid = useId()
const rimId = `gf-rim-${uid}`
const root = ref<HTMLElement | null>(null)
const hit = ref<HTMLButtonElement | null>(null)
const artCanvas = ref<HTMLCanvasElement | null>(null)
const artReady = ref(false)
const entered = ref(!props.appear)

const k = computed(() => props.width / W)
const recipe = computed(() => (props.art === 'none' ? null : byId(kotak.folders, props.art)))

// Surat pertama di depan (paling dekat ke kaca dan paling atas), sisanya di belakangnya.
const visible = computed(() => props.files.slice(0, MAX_VISIBLE))
const count = computed(() => props.files.length)
const metaLine = computed(() => props.meta ?? `${count.value} surat`)

// Saat terbuka, kipas tiga atau empat lembar naik lebih tinggi dari HEADROOM, jadi ruangnya ikut
// membesar (dan foldernya turun) supaya kipasnya tidak menutupi judul di atas folder.
const room = computed(() =>
  open.value && !props.sealed ? openRoom(visible.value.length) : HEADROOM,
)

function sheetStyle(file: FolderFile, index: number) {
  const jitter = rng(hashString(file.id))
  const depth = index
  return {
    '--gf-slot': String(fanSlot(visible.value.length - 1 - index, visible.value.length)),
    '--gf-depth': String(depth),
    '--gf-jx': `${((jitter() - 0.5) * 10).toFixed(2)}px`,
    '--gf-jr': `${((jitter() - 0.5) * 3.2).toFixed(2)}deg`,
    '--gf-paper': file.paper ?? '#ffffff',
    zIndex: String(MAX_VISIBLE - index),
  }
}

// Folder yang disegel bergoyang sedikit saat diketuk, tanda belum bisa dibuka.
const nudging = ref(false)
function toggle() {
  if (props.sealed) {
    nudging.value = false
    requestAnimationFrame(() => (nudging.value = true))
    return
  }
  open.value = !open.value
}
function endNudge(event: AnimationEvent) {
  if (event.target === event.currentTarget) nudging.value = false
}

// Seni panel belakang dilukis sekali per resep dan ukuran, lalu dipakai bersama.
async function paint() {
  const art = recipe.value
  const canvas = artCanvas.value
  if (!art || !canvas) return
  artReady.value = false
  const cpu = document.documentElement.dataset.render === 'cpu'
  const density =
    Math.min(1.5, Math.max(1, cpu ? 1 : window.devicePixelRatio || 1)) * Math.min(1, k.value)
  const source = await paintArt(
    art,
    props.seed,
    Math.round((W + 24) * density),
    Math.round((H + 24) * density),
  )
  if (artCanvas.value !== canvas || recipe.value !== art) return
  canvas.width = source.width
  canvas.height = source.height
  canvas.getContext('2d')?.drawImage(source, 0, 0)
  artReady.value = true
}

// Tersusun sendiri saat pertama kali terlihat di layar.
let io: IntersectionObserver | undefined
let enterTimer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  void paint()
  if (entered.value) return
  const el = root.value
  if (!el || typeof IntersectionObserver === 'undefined') {
    entered.value = true
    return
  }
  io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      io?.disconnect()
      enterTimer = setTimeout(() => (entered.value = true), props.appearDelay)
    },
    { threshold: 0.25 },
  )
  io.observe(el)
})
watch([recipe, () => props.seed, k], () => void paint())
onBeforeUnmount(() => {
  io?.disconnect()
  clearTimeout(enterTimer)
})

// Cahaya dan paralaks mengikuti kursor (bukan sentuhan), tanpa render ulang.
let raf = 0
let px = 0
let py = 0
function writePointer() {
  raf = 0
  root.value?.style.setProperty('--gf-px', px.toFixed(3))
  root.value?.style.setProperty('--gf-py', py.toFixed(3))
}
function onPointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch' || !root.value) return
  const rect = root.value.getBoundingClientRect()
  px = ((event.clientX - rect.left) / rect.width) * 2 - 1
  py = ((event.clientY - rect.top) / rect.height) * 2 - 1
  raf ||= requestAnimationFrame(writePointer)
}
function onPointerLeave() {
  px = 0
  py = 0
  raf ||= requestAnimationFrame(writePointer)
}
onBeforeUnmount(() => cancelAnimationFrame(raf))

// Esc menutup folder yang terbuka dan mengembalikan fokus ke kacanya.
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  event.stopPropagation()
  open.value = false
  hit.value?.focus()
}

defineExpose({
  /** Kotak layar lembar surat `id`, untuk animasi surat keluar dari folder. */
  sheetRect(id: string): DOMRect | null {
    const sheet = root.value?.querySelector<HTMLElement>(`[data-file="${CSS.escape(id)}"]`)
    return sheet?.getBoundingClientRect() ?? null
  },
  focus: () => hit.value?.focus(),
})
</script>

<template>
  <div
    ref="root"
    class="gf-root"
    :data-open="open || undefined"
    :data-entered="entered || undefined"
    :data-place="labelPlacement"
    :data-sealed="sealed || undefined"
    :data-nudge="nudging || undefined"
    :style="{ width: `${width}px`, height: `${(H + room) * k}px` }"
    data-testid="glass-folder"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @keydown="onKeydown"
  >
    <div class="gf-stage" :style="{ transform: `translateY(${room * k}px) scale(${k})` }">
      <div class="gf-tilt" @animationend="endNudge">
        <div class="gf-shadow" aria-hidden="true" />

        <!-- Panel belakang dan seninya. -->
        <div class="gf-back" :style="{ clipPath: `path('${BACK_PATH}')` }" aria-hidden="true">
          <canvas
            v-if="recipe"
            ref="artCanvas"
            class="gf-art"
            :data-ready="artReady || undefined"
            :style="{ width: `${W + 24}px`, height: `${H + 24}px` }"
          />
          <div class="gf-back-sheen" />
        </div>
        <svg class="gf-rim gf-back-rim" :viewBox="`0 0 ${W} ${H}`" aria-hidden="true">
          <path :d="BACK_PATH" />
        </svg>

        <!-- Kaca depan, berengsel di tepi bawahnya. -->
        <div class="gf-front" :style="{ clipPath: `path('${FRONT_PATH}')` }">
          <div class="gf-tint" aria-hidden="true" />
          <div class="gf-spec" aria-hidden="true" />
          <svg class="gf-rim gf-front-rim" :viewBox="`0 0 ${W} ${FRONT_H}`" aria-hidden="true">
            <defs>
              <linearGradient :id="rimId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#fff" stop-opacity="0.95" />
                <stop offset="0.35" stop-color="#fff" stop-opacity="0.35" />
                <stop offset="1" stop-color="#fff" stop-opacity="0.12" />
              </linearGradient>
            </defs>
            <path :d="FRONT_PATH" :stroke="`url(#${rimId})`" />
          </svg>
          <button
            ref="hit"
            type="button"
            class="gf-hit"
            :aria-expanded="sealed ? undefined : open"
            :aria-disabled="sealed || undefined"
            :aria-label="
              sealed
                ? `${label}, ${metaLine}. ${sealedText ?? 'Belum bisa dibuka'}.`
                : `${open ? 'Tutup' : 'Buka'} ${label}, ${metaLine}`
            "
            data-testid="folder-toggle"
            @click="toggle"
          />
          <div class="gf-label">
            <span class="gf-title">{{ label }}</span>
            <span :key="metaLine" class="gf-meta">{{ metaLine }}</span>
          </div>
          <span v-if="sealed && sealedText" class="gf-seal" aria-hidden="true">{{
            sealedText
          }}</span>
        </div>

        <!-- Isinya: sesudah kaca di urutan tab, di belakang kaca di layar. -->
        <div class="gf-files" role="group" :aria-label="`Isi ${label}`" :inert="!open">
          <button
            v-for="(file, index) in visible"
            :key="file.id"
            type="button"
            class="gf-sheet"
            :class="{ 'gf-sheet--art': !!file.image }"
            :style="sheetStyle(file, index)"
            :data-file="file.id"
            :aria-label="`${file.name}${file.meta ? `, ${file.meta}` : ''}${file.unread ? ', belum dibuka' : ''}`"
            @click="emit('select', file, index)"
          >
            <img
              v-if="file.image"
              class="gf-sheet-art"
              :src="file.image"
              alt=""
              draggable="false"
              decoding="async"
              :width="SHEET_W"
              :height="SHEET_H"
            />
            <span v-else class="gf-lines" aria-hidden="true">
              <i style="width: 86%" />
              <i style="width: 92%" />
              <i style="width: 64%" />
              <i style="width: 88%" />
              <i style="width: 42%" />
            </span>
            <span v-if="file.name || file.meta" class="gf-sheet-head" aria-hidden="true">
              <span v-if="file.name" class="gf-sheet-name">{{ file.name }}</span>
              <span v-if="file.meta" class="gf-sheet-meta">{{ file.meta }}</span>
            </span>
            <span v-if="file.unread" class="gf-unread" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gf-root {
  --gf-px: 0;
  --gf-py: 0;
  --gf-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --gf-spring: cubic-bezier(0.34, 1.36, 0.5, 1);
  --gf-hinge: 0deg;
  --gf-lift: 42px;
  --gf-spread: 0px;
  --gf-fan: 0deg;
  --gf-stack: 15px;
  position: relative;
  display: inline-block;
  flex: none;
  vertical-align: top;
  color: var(--color-ink);
  /* Halaman induknya boleh rata tengah; isi folder tetap rata kiri. */
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  isolation: isolate;
  transition: height 0.6s var(--gf-ease);
}

/*
 * Condong saat disorot mouse atau difokus keyboard. Bukan saat diketuk: di HP :hover menempel dan
 * tombol yang diketuk ikut terfokus, jadi folder yang baru ditutup akan tampak setengah terbuka.
 * Dua aturan terpisah, supaya browser tanpa :has() tetap memakai yang pertama.
 */
@media (hover: hover) {
  .gf-root:hover {
    --gf-hinge: -11deg;
    --gf-lift: -34px;
    --gf-spread: 8px;
    --gf-fan: 1.4deg;
    --gf-stack: 10px;
  }
}

.gf-root:has(:focus-visible) {
  --gf-hinge: -11deg;
  --gf-lift: -34px;
  --gf-spread: 8px;
  --gf-fan: 1.4deg;
  --gf-stack: 10px;
}

.gf-root[data-open] {
  --gf-hinge: -24deg;
  --gf-lift: -96px;
  --gf-spread: 40px;
  --gf-fan: 5deg;
  --gf-stack: 30px;
}

/* Folder yang disegel tidak condong saat disorot, karena memang belum bisa dibuka. */
.gf-root[data-sealed] {
  --gf-hinge: 0deg;
  --gf-lift: 42px;
  --gf-spread: 0px;
  --gf-fan: 0deg;
  --gf-stack: 15px;
}

.gf-stage {
  position: absolute;
  left: 0;
  top: 0;
  width: 340px;
  height: 272px;
  transform-origin: 0 0;
  transition: transform 0.6s var(--gf-ease);
}

.gf-root[data-nudge] .gf-tilt {
  animation: gf-nudge 0.46s var(--gf-ease);
}

@keyframes gf-nudge {
  0%,
  100% {
    translate: 0 0;
  }

  20% {
    translate: -7px 0;
  }

  45% {
    translate: 6px 0;
  }

  70% {
    translate: -3px 0;
  }
}

.gf-tilt {
  position: absolute;
  inset: 0;
  transform: perspective(1400px) rotateX(calc(var(--gf-py) * -3deg))
    rotateY(calc(var(--gf-px) * 4deg));
  transition: transform 0.9s var(--gf-ease);
}

.gf-shadow {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: -6px;
  height: 60px;
  border-radius: 40px;
  background: rgb(24 32 74 / 0.3);
  filter: blur(22px);
  transform: translateX(calc(var(--gf-px) * -8px));
  transition:
    transform 0.9s var(--gf-ease),
    opacity 0.9s var(--gf-ease);
}

.gf-back {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(180deg, #f3f4f8 0%, #e1e5ee 100%);
}

.gf-art {
  position: absolute;
  left: -12px;
  top: -12px;
  max-width: none;
  opacity: 0;
  filter: blur(14px) saturate(0.6);
  transform: translate(calc(var(--gf-px) * -7px), calc(var(--gf-py) * -6px)) scale(1.02);
  transition:
    transform 1.1s var(--gf-ease),
    opacity 1.2s var(--gf-ease),
    filter 1.2s var(--gf-ease);
}

.gf-art[data-ready] {
  opacity: 1;
  filter: none;
}

.gf-back-sheen {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.22) 0%, rgb(255 255 255 / 0) 22%),
    radial-gradient(120% 80% at 80% 0%, rgb(255 255 255 / 0.16), rgb(255 255 255 / 0) 60%);
  pointer-events: none;
}

.gf-rim {
  position: absolute;
  left: 0;
  top: 0;
  max-width: none;
  overflow: visible;
  pointer-events: none;
  fill: none;
}

.gf-back-rim {
  width: 340px;
  height: 272px;
}

.gf-back-rim path {
  stroke: rgb(255 255 255 / 0.45);
  stroke-width: 1;
}

/* Isi folder ----------------------------------------------------------------------------- */
.gf-files {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  /* Tidak ada yang menggantung keluar dari dasar kantong, setinggi apa pun tumpukannya. */
  clip-path: inset(-400px -400px 10px -400px);
}

.gf-sheet {
  all: unset;
  box-sizing: border-box;
  position: absolute;
  left: 34px;
  top: 96px;
  width: 272px;
  height: 184px;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  pointer-events: auto;
  background: var(--gf-paper);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.9),
    0 0 0 0.5px rgb(24 32 74 / 0.12),
    0 10px 26px -8px rgb(24 32 74 / 0.3);
  transform-origin: 50% 100%;
  transform: translate(
      calc(var(--gf-jx) + var(--gf-slot) * var(--gf-spread)),
      calc(var(--gf-lift) + var(--gf-depth) * var(--gf-stack) * -1)
    )
    rotate(calc(var(--gf-jr) + var(--gf-slot) * var(--gf-fan)));
  transition:
    transform 0.75s var(--gf-spring) calc(var(--gf-depth) * 40ms),
    box-shadow 0.4s var(--gf-ease),
    translate 0.9s var(--gf-ease),
    opacity 0.9s var(--gf-ease);
}

.gf-root[data-open] .gf-sheet:focus-visible {
  transform: translate(
      calc(var(--gf-jx) + var(--gf-slot) * var(--gf-spread)),
      calc(var(--gf-lift) + var(--gf-depth) * var(--gf-stack) * -1 - 18px)
    )
    rotate(calc(var(--gf-slot) * var(--gf-fan) * 0.6));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.9),
    0 0 0 0.5px rgb(24 32 74 / 0.12),
    0 22px 40px -12px rgb(24 32 74 / 0.42);
  transition-delay: 0s;
}

@media (hover: hover) {
  .gf-root[data-open] .gf-sheet:hover {
    transform: translate(
        calc(var(--gf-jx) + var(--gf-slot) * var(--gf-spread)),
        calc(var(--gf-lift) + var(--gf-depth) * var(--gf-stack) * -1 - 18px)
      )
      rotate(calc(var(--gf-slot) * var(--gf-fan) * 0.6));
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.9),
      0 0 0 0.5px rgb(24 32 74 / 0.12),
      0 22px 40px -12px rgb(24 32 74 / 0.42);
    transition-delay: 0s;
  }
}

.gf-sheet:focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 2px;
}

.gf-sheet-art {
  position: absolute;
  inset: 0;
  width: 272px;
  height: 184px;
  max-width: none;
  object-fit: cover;
  object-position: 50% 30%;
}

.gf-sheet--art::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.2);
  pointer-events: none;
}

.gf-sheet-head {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 9px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  white-space: nowrap;
}

/*
 * Nama dan tanggal di label putih seperti etiket kertas, supaya terbaca (minimal 4,5:1) di atas
 * gambar depan apa pun, juga kertas gelap atau foto yang terang.
 */
.gf-sheet-name,
.gf-sheet-meta {
  padding: 3px 8px;
  border-radius: 8px;
  background: rgb(255 255 255 / 0.92);
  box-shadow: 0 1px 2px rgb(24 32 74 / 0.16);
}

.gf-sheet-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
  color: var(--color-ink);
}

.gf-sheet-meta {
  flex: none;
  margin-left: auto;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-ink-muted);
}

.gf-unread {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--color-ink);
  box-shadow: 0 0 0 3px #fff;
}

.gf-lines {
  position: absolute;
  left: 14px;
  right: 14px;
  top: 42px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.gf-lines i {
  display: block;
  height: 5px;
  border-radius: 3px;
  background: rgb(24 32 74 / 0.08);
}

.gf-lines i:first-child {
  height: 9px;
  margin-bottom: 4px;
  background: rgb(24 32 74 / 0.14);
}

/* Kaca depan ----------------------------------------------------------------------------- */
.gf-front {
  position: absolute;
  left: 0;
  top: 74px;
  width: 340px;
  height: 198px;
  z-index: 10;
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  backdrop-filter: blur(22px) saturate(1.5);
  transform-origin: 50% 100%;
  transform: perspective(760px) rotateX(var(--gf-hinge));
  transition:
    transform 0.8s var(--gf-spring),
    translate 1s var(--gf-ease),
    opacity 1s var(--gf-ease);
}

.gf-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 0.16) 0%,
    rgb(255 255 255 / 0.5) 42%,
    rgb(252 252 253 / 0.93) 100%
  );
}

.gf-spec {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    260px 200px at calc(50% + var(--gf-px) * 46%) calc(30% + var(--gf-py) * 40%),
    rgb(255 255 255 / 0.5),
    rgb(255 255 255 / 0) 70%
  );
  mix-blend-mode: soft-light;
  opacity: 0.9;
  pointer-events: none;
}

.gf-front-rim {
  width: 340px;
  height: 198px;
}

.gf-front-rim path {
  stroke-width: 2.4;
  transition: stroke-width 0.3s var(--gf-ease);
}

.gf-hit {
  all: unset;
  position: absolute;
  inset: 0;
  z-index: 1;
  cursor: pointer;
}

.gf-root[data-sealed] .gf-hit {
  cursor: default;
}

.gf-front:has(.gf-hit:focus-visible) .gf-front-rim path {
  stroke-width: 5;
}

.gf-hit:focus-visible ~ .gf-label .gf-title {
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 4px;
}

.gf-label {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 220px;
  pointer-events: none;
}

.gf-root[data-place='bottom-left'] .gf-label {
  left: 28px;
  bottom: 30px;
}

.gf-root[data-place='top-left'] .gf-label {
  left: 28px;
  top: 52px;
}

.gf-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.gf-meta {
  font-size: 14px;
  font-weight: 500;
  /* Lebih pekat dari ink-muted: kacanya bisa gelap di belakang seni atau surat bergambar. */
  color: rgb(24 32 74 / 0.8);
  white-space: nowrap;
  animation: gf-roll 0.5s var(--gf-ease) both;
}

@keyframes gf-roll {
  from {
    opacity: 0;
    translate: 0 7px;
    filter: blur(3px);
  }
  to {
    opacity: 1;
    translate: 0 0;
    filter: blur(0);
  }
}

/* Cap tanggal di kaca folder yang masih disegel. */
.gf-seal {
  position: absolute;
  right: 24px;
  bottom: 28px;
  z-index: 2;
  max-width: 132px;
  padding: 7px 10px;
  border: 2px solid var(--color-ink);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.04em;
  text-align: center;
  text-transform: uppercase;
  rotate: -6deg;
  pointer-events: none;
}

/* Masuk: folder tersusun sendiri ------------------------------------------------------- */
.gf-root:not([data-entered]) .gf-back,
.gf-root:not([data-entered]) .gf-back-rim {
  translate: 0 22px;
  opacity: 0;
}

.gf-root:not([data-entered]) .gf-sheet {
  translate: 0 -120px;
  opacity: 0;
}

.gf-root:not([data-entered]) .gf-front {
  translate: 0 46px;
  opacity: 0;
}

.gf-root:not([data-entered]) .gf-shadow {
  opacity: 0;
}

.gf-back,
.gf-back-rim {
  transition:
    translate 1s var(--gf-ease),
    opacity 0.9s var(--gf-ease);
}

.gf-root[data-entered] .gf-sheet {
  transition-delay:
    calc(var(--gf-depth) * 40ms), 0s, calc(0.18s + var(--gf-depth) * 90ms),
    calc(0.18s + var(--gf-depth) * 90ms);
}

.gf-root[data-entered] .gf-front {
  transition-delay: 0s, 0.42s, 0.42s;
}

/*
 * Tanpa GPU (data-render dari plugins/render.client.ts) atau kalau transparansi diminta dikurangi,
 * kacanya tidak dikaburkan: lapisan warnanya dibuat lebih pekat supaya isi di belakangnya tidak
 * terlihat tajam.
 */
[data-render='cpu'] .gf-front {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

[data-render='cpu'] .gf-tint {
  background: linear-gradient(
    180deg,
    rgb(241 244 248 / 0.82) 0%,
    rgb(248 250 252 / 0.92) 42%,
    rgb(252 252 253 / 0.98) 100%
  );
}

@media (prefers-reduced-transparency: reduce) {
  .gf-front {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .gf-tint {
    background: linear-gradient(
      180deg,
      rgb(241 244 248 / 0.82) 0%,
      rgb(248 250 252 / 0.92) 42%,
      rgb(252 252 253 / 0.98) 100%
    );
  }
}

@media (prefers-reduced-motion: reduce) {
  .gf-root,
  .gf-root *,
  .gf-root *::before,
  .gf-root *::after {
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    animation: none !important;
  }

  .gf-tilt {
    transform: none;
  }
}
</style>
