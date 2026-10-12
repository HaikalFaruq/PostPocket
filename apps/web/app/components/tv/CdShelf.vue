<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { Box } from '~/utils/cd-flight'
import { shelfMetrics, shelfPositions, shelfVisible } from '~/utils/cd-shelf'
import type { AlbumView } from '~/utils/memories'

/**
 * Rak arsip CD (PRD modul 3, referensi Memory TV): deretan punggung CD dengan case yang miring.
 * Ketuk punggung untuk memilih CD (case-nya berputar menghadap depan), ketuk lagi untuk membuka
 * (piringannya bergeser keluar), lalu seret piringan ke TV atau tekan "Masukkan CD".
 * Pindah album juga bisa lewat swipe, tombol panah, dan keyboard.
 */
const props = defineProps<{
  albums: AlbumView[]
  covers: Record<string, string | null>
  /** Album yang piringannya sedang ada di TV. */
  playing?: string | null
  /** Album yang piringannya sedang diseret atau terbang, jadi tidak digambar di rak. */
  away?: string | null
  /** Momen yang baru ditambahkan, ditandai di deretan foto. */
  fresh?: string[]
  /** Berubah saat user diarahkan ke rak: CD terpilih melonjak kecil. */
  nudge?: number
  /** Layar TV sedang dipakai Booth. */
  boothOpen?: boolean
  busy?: boolean
}>()
const index = defineModel<number>({ default: 0 })
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  insert: [album: AlbumView]
  eject: [album: AlbumView]
  add: [album: AlbumView]
  grab: [album: AlbumView, event: PointerEvent, disc: HTMLElement]
}>()
const memories = useMemories()

const current = computed(() => props.albums[index.value])
const stage = ref<HTMLElement | null>(null)
const { width: stageWidth } = useElementSize(stage)
// Sebelum rak terukur, tebak lebarnya dari layar supaya ukuran CD tidak melompat (dan tidak
// memicu ResizeObserver dua kali).
const firstGuess = import.meta.client ? Math.min(innerWidth - 32, 860) : 640
const metrics = computed(() => shelfMetrics(stageWidth.value || firstGuess))
const isPlaying = (album?: AlbumView) => !!album && props.playing === album.id
// Piringan album yang sedang diputar ada di TV, jadi case-nya kosong. Piringan yang sedang
// diseret atau terbang tetap ada di DOM (hanya tak terlihat), supaya tujuan pulangnya terukur.
const discHere = computed(() => !!current.value && !isPlaying(current.value))
const discAway = computed(() => !!current.value && props.away === current.value.id)

const positions = computed(() =>
  shelfPositions(props.albums.length, index.value, open.value, metrics.value),
)
function itemStyle(i: number): CSSProperties {
  const m = metrics.value
  const left = positions.value[i] ?? 0
  const width = i === index.value ? m.spine + m.face + (open.value ? m.discOut : 0) : m.step
  const visible = shelfVisible(left, width, stageWidth.value || firstGuess)
  return {
    transform: `translateX(${left}px)`,
    opacity: visible ? '1' : '0',
    pointerEvents: visible ? 'auto' : 'none',
    zIndex: String(100 - Math.abs(i - index.value)),
  }
}

watch(
  () => props.albums.length,
  (length) => {
    if (index.value > length - 1) index.value = Math.max(0, length - 1)
  },
)
watch(index, () => (open.value = false))

// Lonjakan kecil di CD terpilih, untuk menunjukkan tempat mengetuk.
const nudged = ref(false)
watch(
  () => props.nudge,
  async () => {
    nudged.value = false
    await nextTick()
    nudged.value = true
    setTimeout(() => (nudged.value = false), 900)
  },
)

function go(step: number) {
  index.value = Math.min(props.albums.length - 1, Math.max(0, index.value + step))
}

/** Ketuk CD lain untuk memilihnya; ketuk CD yang terpilih untuk membuka atau menutupnya. */
function onCase(i: number) {
  if (i !== index.value) index.value = i
  else open.value = !open.value
}

function caseLabel(album: AlbumView, i: number) {
  const base = `${album.title}, ${album.moments.length} foto`
  if (i !== index.value) return `Pilih CD ${base}`
  return `${open.value ? 'Tutup' : 'Buka'} CD ${base}`
}

// Swipe di rak untuk pindah album.
let swipeFrom: number | null = null
function onStageDown(event: PointerEvent) {
  swipeFrom = event.clientX
}
function onStageUp(event: PointerEvent) {
  if (swipeFrom === null) return
  const dx = event.clientX - swipeFrom
  swipeFrom = null
  if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') go(1)
  else if (event.key === 'ArrowLeft') go(-1)
  else if (event.key === 'Enter' && current.value) {
    if (isPlaying(current.value)) emit('eject', current.value)
    else emit('insert', current.value)
  } else if (event.key === ' ') open.value = !open.value
  else if (event.key === 'Escape' && open.value) open.value = false
  else return
  event.preventDefault()
}

// Piringan yang keluar: diseret ke TV, atau diketuk untuk langsung dimasukkan. Elemennya ada di
// dalam v-for (hanya untuk CD terpilih), jadi disimpan lewat function ref.
const disc = ref<HTMLElement | null>(null)
const setDisc = (el: unknown) => (disc.value = (el as HTMLElement | null) ?? null)
function onDiscDown(event: PointerEvent) {
  event.stopPropagation()
  swipeFrom = null
  if (!current.value || !disc.value) return
  // Jari atau kursor tetap terpegang walau keluar dari piringan atau jendela.
  disc.value.setPointerCapture?.(event.pointerId)
  emit('grab', current.value, event, disc.value)
}

const anchor = ref<HTMLElement | null>(null)
const setAnchor = (el: unknown) => (anchor.value = (el as HTMLElement | null) ?? null)
/** Tempat piringan di dalam case terpilih, untuk tujuan piringan yang dikeluarkan dari TV. */
function discBox(albumId: string): Box | null {
  if (current.value?.id !== albumId || !anchor.value) return null
  const rect = anchor.value.getBoundingClientRect()
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}
defineExpose({ discBox, disc })

// Deretan foto di CD terpilih, supaya kelihatan isinya dan foto yang baru masuk.
const thumbs = ref<{ id: string; url: string }[]>([])
const strip = ref<HTMLElement | null>(null)
watch(
  () => current.value?.moments.slice(-24).join(),
  async () => {
    const ids = current.value?.moments.slice(-24) ?? []
    const next = []
    for (const id of ids) {
      const url = await memories.photoUrl(id)
      if (url) next.push({ id, url })
    }
    thumbs.value = next
    // Foto baru ada di ujung kanan; geser ke sana supaya kelihatan.
    if (props.fresh?.length)
      nextTick(() => strip.value?.scrollTo({ left: 1e6, behavior: 'smooth' }))
  },
  { immediate: true },
)

const hint = computed(() => {
  const album = current.value
  if (!album) return ''
  if (isPlaying(album) && props.boothOpen) return 'Ada di TV. Keluar dari Booth untuk memutarnya.'
  if (isPlaying(album)) return 'Sedang diputar di TV.'
  if (!album.moments.length) return 'CD ini masih kosong. Tambah foto dulu.'
  if (open.value) return 'Seret piringan ke TV, atau tekan Masukkan CD.'
  return 'Ketuk CD untuk membuka, lalu seret piringannya ke TV.'
})
</script>

<template>
  <div
    class="cd-shelf"
    :style="{
      '--spine': `${metrics.spine}px`,
      '--face': `${metrics.face}px`,
      '--step': `${metrics.step}px`,
    }"
  >
    <div
      ref="stage"
      class="cd-stage"
      role="group"
      aria-label="Arsip CD. Panah kiri dan kanan untuk pindah album, Spasi untuk membuka CD, Enter untuk memutar."
      tabindex="0"
      data-testid="cd-shelf"
      :data-index="index"
      :data-open="open ? 'true' : undefined"
      @pointerdown="onStageDown"
      @pointerup="onStageUp"
      @keydown="onKeydown"
    >
      <div
        v-for="(album, i) in albums"
        :key="album.id"
        class="cd-item"
        :class="{
          'is-current': i === index,
          'is-open': i === index && open,
          'is-nudged': i === index && nudged,
        }"
        :style="itemStyle(i)"
        :data-album="album.id"
      >
        <template v-if="i === index">
          <span :ref="setAnchor" class="cd-item__anchor" aria-hidden="true" />
          <span v-if="discHere" class="cd-item__disc" :class="{ 'is-away': discAway }">
            <span
              :ref="setDisc"
              class="cd-item__disc-grip"
              :class="{ 'is-ready': open }"
              data-testid="cd-disc"
              @pointerdown="onDiscDown"
            >
              <CdDisc :cover="covers[album.id] ?? null" :emoji="album.emoji" :spinning="open" />
            </span>
          </span>
        </template>
        <button
          type="button"
          class="cd-case"
          :style="{ '--album': album.color }"
          :aria-label="caseLabel(album, i)"
          :aria-expanded="i === index ? open : undefined"
          :aria-current="i === index ? 'true' : undefined"
          tabindex="-1"
          @click="onCase(i)"
        >
          <span class="cd-case__spine">
            <span class="cd-case__emoji">{{ album.emoji }}</span>
            <span class="cd-case__title">{{ album.title }}</span>
          </span>
          <span class="cd-case__front">
            <span
              v-if="covers[album.id]"
              class="cd-case__art"
              :style="{ backgroundImage: `url(${covers[album.id]})` }"
            />
            <span class="cd-case__frost" />
            <span class="cd-case__window">
              <img v-if="covers[album.id]" :src="covers[album.id]!" alt="" draggable="false" />
              <span v-else>{{ album.emoji }}</span>
            </span>
            <span v-if="isPlaying(album)" class="cd-case__badge">Di TV</span>
          </span>
        </button>
      </div>
    </div>

    <div v-if="current" class="mt-3 flex items-center justify-between gap-2">
      <IconButton label="Album sebelumnya" :disabled="index === 0" @click="go(-1)">
        <Icon name="chevron-left" :size="16" />
      </IconButton>
      <div class="min-w-0 text-center">
        <p class="truncate text-[16px] font-bold tracking-[-0.01em]">
          {{ current.emoji }} {{ current.title }}
        </p>
        <p class="text-caption text-ink-muted" data-testid="cd-hint">
          <template v-if="current.moments.length">{{ current.moments.length }} foto. </template
          >{{ hint }}
        </p>
      </div>
      <IconButton label="Album berikutnya" :disabled="index >= albums.length - 1" @click="go(1)">
        <Icon name="chevron-right" :size="16" />
      </IconButton>
    </div>

    <div v-if="current" class="mt-3 flex flex-wrap items-center justify-center gap-2">
      <!-- CD kosong belum bisa diputar: tambah foto jadi aksi utamanya. -->
      <button
        type="button"
        class="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-body font-semibold"
        :class="
          current.moments.length
            ? 'bg-surface inset-ring inset-ring-line hover:bg-panel'
            : 'bg-ink text-white'
        "
        @click="emit('add', current)"
      >
        <Icon name="plus" :size="15" /> Foto
      </button>
      <button
        v-if="isPlaying(current)"
        type="button"
        class="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-body font-semibold inset-ring inset-ring-line hover:bg-panel"
        :disabled="busy"
        @click="emit('eject', current)"
      >
        <Icon name="eject" :size="15" /> Keluarkan CD
      </button>
      <button
        v-else-if="current.moments.length"
        type="button"
        class="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-body font-semibold text-white disabled:opacity-50"
        :disabled="busy"
        data-testid="cd-insert"
        @click="emit('insert', current)"
      >
        <Icon name="play" :size="14" /> Masukkan CD
      </button>
    </div>

    <slot name="status" />

    <ul
      v-if="thumbs.length"
      ref="strip"
      class="cd-thumbs mx-auto mt-4 flex w-fit max-w-full gap-1.5 overflow-x-auto pb-1"
      :aria-label="`Foto di CD ${current?.title}`"
      data-testid="cd-thumbs"
    >
      <li
        v-for="thumb in thumbs"
        :key="thumb.id"
        class="cd-thumb"
        :class="{ 'is-fresh': fresh?.includes(thumb.id) }"
      >
        <img :src="thumb.url" alt="" class="size-full object-cover" draggable="false" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cd-stage {
  position: relative;
  height: calc(var(--face) + 36px);
  perspective: 1200px;
  perspective-origin: 50% 40%;
  touch-action: pan-y;
  outline: none;
  overflow: hidden;
}

.cd-stage:focus-visible {
  border-radius: 20px;
  box-shadow: 0 0 0 2px var(--focus-ring, var(--color-ink));
}

.cd-item {
  position: absolute;
  top: 14px;
  left: 50%;
  height: var(--face);
  transform-style: preserve-3d;
  transition:
    transform 480ms var(--ease-card),
    opacity 300ms;
}

/* Muka case yang tertutup diputar menjauh; yang terlihat tinggal punggung dan sedikit sisi muka. */
.cd-case {
  position: relative;
  z-index: 2;
  display: flex;
  height: 100%;
  transform-style: preserve-3d;
  cursor: pointer;
  transition: transform 220ms var(--ease-card);
}

.cd-item.is-nudged .cd-case {
  animation: case-nudge 800ms var(--ease-card);
}

@keyframes case-nudge {
  30% {
    transform: translateY(-14px);
  }
  55% {
    transform: translateY(0);
  }
  75% {
    transform: translateY(-5px);
  }
}

/* CD tertutup hanya bisa diklik di punggung dan sisi mukanya yang kelihatan, supaya tidak
   menutupi CD di sebelahnya. */
.cd-item:not(.is-current) .cd-case {
  width: var(--step);
}

.cd-item:not(.is-current) .cd-case:hover {
  transform: translateY(-5px);
}

.cd-case__spine {
  position: relative;
  display: flex;
  flex: none;
  width: var(--spine);
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 9px 0 0 9px;
  background:
    linear-gradient(
      90deg,
      rgb(0 0 0 / 0.1),
      transparent 30%,
      rgb(255 255 255 / 0.28) 70%,
      transparent
    ),
    var(--album);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.35);
  overflow: hidden;
}

/* Engsel case: dua garis tipis di atas dan bawah punggung. */
.cd-case__spine::before,
.cd-case__spine::after {
  content: '';
  position: absolute;
  inset-inline: 5px;
  height: 2px;
  border-radius: 2px;
  background: rgb(255 255 255 / 0.6);
}

.cd-case__spine::before {
  top: 9px;
}

.cd-case__spine::after {
  bottom: 9px;
}

.cd-case__emoji {
  font-size: 12px;
  line-height: 1;
}

.cd-case__title {
  /* Nama panjang pindah ke kolom kedua, bukan dipotong dengan "…" (yang di Safari jadi titik). */
  max-width: calc(var(--spine) - 6px);
  max-height: calc(var(--face) - 52px);
  overflow: hidden;
  font-size: 10.5px;
  font-weight: 750;
  line-height: 1.05;
  letter-spacing: 0.1em;
  text-align: center;
  text-transform: uppercase;
  overflow-wrap: anywhere;
  color: rgb(24 32 74 / 0.82);
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

@media (max-width: 519px) {
  .cd-case__title {
    font-size: 9.5px;
    letter-spacing: 0.06em;
  }
}

.cd-case__front {
  position: relative;
  flex: none;
  width: var(--face);
  height: 100%;
  overflow: hidden;
  border-radius: 0 12px 12px 0;
  background: color-mix(in srgb, var(--album) 45%, white);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.65),
    0 22px 34px -22px rgb(24 32 74 / 0.55);
  transform-origin: left center;
  transform: rotateY(82deg);
  transition: transform 480ms var(--ease-card);
}

.cd-item.is-current .cd-case__front {
  transform: rotateY(0deg);
}

/* Sampul diburamkan di balik plastik case, seperti booklet yang terlihat dari luar. */
.cd-case__art {
  position: absolute;
  inset: -25%;
  background-position: center;
  background-size: cover;
  filter: blur(22px) saturate(1.4);
  opacity: 0.9;
}

.cd-case__frost {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      125deg,
      rgb(255 255 255 / 0.55),
      rgb(255 255 255 / 0.12) 38%,
      rgb(255 255 255 / 0) 55%,
      rgb(255 255 255 / 0.3)
    ),
    radial-gradient(circle at 70% 25%, rgb(255 255 255 / 0.45), transparent 45%);
}

.cd-case__window {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 46%;
  aspect-ratio: 1;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.6);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--album) 60%, white),
    0 10px 20px -10px rgb(24 32 74 / 0.6);
  font-size: calc(var(--face) * 0.16);
  transform: translate(-50%, -50%);
}

.cd-case__window img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cd-case__badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--color-ink);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-white);
}

/* Piringan ada di balik muka case; saat dibuka ia bergeser keluar ke kanan sambil berputar. */
.cd-item__anchor,
.cd-item__disc {
  position: absolute;
  top: calc(var(--face) * 0.06);
  left: calc(var(--spine) + var(--face) * 0.06);
  width: calc(var(--face) * 0.88);
  aspect-ratio: 1;
}

.cd-item__anchor {
  visibility: hidden;
}

.cd-item__disc {
  z-index: 1;
  transition: transform 560ms var(--ease-card);
}

.cd-item__disc.is-away {
  visibility: hidden;
}

.cd-item.is-open .cd-item__disc {
  transform: translateX(calc(var(--face) * 0.59));
}

.cd-item__disc-grip {
  display: block;
  border-radius: 50%;
  touch-action: none;
  transition: transform 560ms var(--ease-card);
}

.cd-item.is-open .cd-item__disc-grip {
  transform: rotate(200deg);
  cursor: grab;
}

.cd-thumbs {
  scrollbar-width: thin;
}

.cd-thumb {
  width: 52px;
  flex: none;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 8px;
  background: var(--color-fill);
}

.cd-thumb.is-fresh {
  box-shadow: 0 0 0 2px var(--color-ink);
  animation: thumb-in 420ms var(--ease-card);
}

@keyframes thumb-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.85);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cd-item,
  .cd-case,
  .cd-case__front,
  .cd-item__disc,
  .cd-item__disc-grip {
    transition: none;
  }

  .cd-thumb.is-fresh,
  .cd-item.is-nudged .cd-case {
    animation: none;
  }
}
</style>
