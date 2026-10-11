<script setup lang="ts">
import type { AlbumView } from '~/utils/memories'

/**
 * Rak arsip CD coverflow 3D. Pindah album lewat swipe, tombol panah, atau keyboard (PRD).
 * CD di tengah terbuka: piringannya bisa diketuk atau digeser ke kanan untuk masuk ke TV.
 */
const props = defineProps<{ albums: AlbumView[]; playing?: string | null }>()
const index = defineModel<number>({ default: 0 })
const emit = defineEmits<{ insert: [album: AlbumView]; add: [album: AlbumView] }>()
const memories = useMemories()

const current = computed(() => props.albums[index.value])
const covers = ref<Record<string, string | null>>({})

watch(
  () => props.albums,
  async (list) => {
    for (const album of list) {
      const first = album.moments[0]
      const cover = first ? await memories.photoUrl(first) : null
      if (covers.value[album.id] !== cover) covers.value = { ...covers.value, [album.id]: cover }
    }
  },
  { immediate: true, deep: true },
)

watch(
  () => props.albums.length,
  (length) => {
    if (index.value > length - 1) index.value = Math.max(0, length - 1)
  },
)

function go(step: number) {
  index.value = Math.min(props.albums.length - 1, Math.max(0, index.value + step))
}

function caseStyle(offset: number): Record<string, string> {
  const distance = Math.abs(offset)
  const rotate = offset === 0 ? 0 : offset < 0 ? 50 : -50
  return {
    transform: `translateX(${offset * 58}%) translateZ(${-distance * 70}px) rotateY(${rotate}deg)`,
    zIndex: String(10 - distance),
    opacity: distance > 3 ? '0' : '1',
    pointerEvents: distance > 3 ? 'none' : 'auto',
  }
}

// Swipe di rak.
let swipeFrom: number | null = null
function onShelfDown(event: PointerEvent) {
  swipeFrom = event.clientX
}
function onShelfUp(event: PointerEvent) {
  if (swipeFrom === null) return
  const dx = event.clientX - swipeFrom
  swipeFrom = null
  if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') go(1)
  else if (event.key === 'ArrowLeft') go(-1)
  else if (event.key === 'Enter' && current.value) emit('insert', current.value)
  else return
  event.preventDefault()
}

// Piringan: ketuk, atau geser ke kanan lebih dari 60 px, untuk memasukkan CD.
const discX = ref(0)
let discFrom: number | null = null
let discMoved = false
function onDiscDown(event: PointerEvent) {
  event.stopPropagation()
  discFrom = event.clientX
  discMoved = false
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
}
function onDiscMove(event: PointerEvent) {
  if (discFrom === null) return
  const dx = Math.max(0, event.clientX - discFrom)
  if (dx > 4) discMoved = true
  discX.value = Math.min(dx, 140)
}
function onDiscUp(event: PointerEvent) {
  if (discFrom === null) return
  event.stopPropagation()
  discFrom = null
  if (current.value && (!discMoved || discX.value > 60)) emit('insert', current.value)
  discX.value = 0
}

function caseLabel(album: AlbumView) {
  return `${album.title}, ${album.moments.length} foto`
}
</script>

<template>
  <div class="cd-shelf">
    <div
      class="cd-stage"
      role="group"
      aria-label="Arsip CD. Panah kiri dan kanan untuk pindah album, Enter untuk memutar."
      tabindex="0"
      data-testid="cd-shelf"
      :data-index="index"
      @pointerdown="onShelfDown"
      @pointerup="onShelfUp"
      @keydown="onKeydown"
    >
      <div
        v-for="(album, i) in albums"
        :key="album.id"
        class="cd-case"
        :class="{ 'is-current': i === index }"
        :style="caseStyle(i - index)"
        :data-album="album.id"
        :aria-label="caseLabel(album)"
        :aria-current="i === index ? 'true' : undefined"
        @click="index = i"
      >
        <div class="cd-case__spine" :style="{ backgroundColor: album.color }">
          <span class="cd-case__emoji">{{ album.emoji }}</span>
          <span class="cd-case__title">{{ album.title }}</span>
        </div>
        <div class="cd-case__front" :style="{ backgroundColor: album.color }">
          <img
            v-if="covers[album.id]"
            :src="covers[album.id]!"
            alt=""
            class="size-full object-cover"
            draggable="false"
          />
          <span v-else class="text-[42px]">{{ album.emoji }}</span>
        </div>
        <button
          v-if="i === index"
          type="button"
          class="cd-disc"
          :class="{ 'is-playing': playing === album.id }"
          :style="{ transform: `translateX(calc(62% + ${discX}px)) rotate(${discX * 2}deg)` }"
          :aria-label="`Putar ${album.title} di TV`"
          data-testid="cd-disc"
          @pointerdown="onDiscDown"
          @pointermove="onDiscMove"
          @pointerup="onDiscUp"
          @keydown.enter.stop
        >
          <span class="cd-disc__face" aria-hidden="true" />
          <span class="cd-disc__art">
            <img
              v-if="covers[album.id]"
              :src="covers[album.id]!"
              alt=""
              class="size-full object-cover"
              draggable="false"
            />
          </span>
          <span class="cd-disc__label">TAP</span>
        </button>
      </div>
    </div>

    <div class="mt-4 flex items-center justify-between gap-3">
      <IconButton label="Album sebelumnya" size="sm" :disabled="index === 0" @click="go(-1)">
        <Icon name="chevron-left" :size="16" />
      </IconButton>
      <div v-if="current" class="min-w-0 text-center">
        <p class="truncate text-[15px] font-semibold">{{ current.emoji }} {{ current.title }}</p>
        <p class="font-mono text-[11px] tracking-[0.14em] text-ink-muted uppercase">
          {{ current.moments.length }} foto · geser piringan untuk memasukkan
        </p>
      </div>
      <IconButton
        label="Album berikutnya"
        size="sm"
        :disabled="index >= albums.length - 1"
        @click="go(1)"
      >
        <Icon name="chevron-right" :size="16" />
      </IconButton>
    </div>
    <div v-if="current" class="mt-3 flex justify-center">
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-body font-semibold inset-ring inset-ring-line hover:bg-panel"
        @click="emit('add', current)"
      >
        <Icon name="plus" :size="15" /> Foto
      </button>
    </div>
  </div>
</template>

<style scoped>
.cd-stage {
  position: relative;
  height: 200px;
  perspective: 900px;
  touch-action: pan-y;
  outline: none;
}

.cd-stage:focus-visible {
  border-radius: 20px;
  box-shadow: 0 0 0 2px var(--color-ink);
}

.cd-case {
  position: absolute;
  top: 18px;
  left: 50%;
  display: flex;
  width: 168px;
  height: 152px;
  margin-left: -84px;
  transform-style: preserve-3d;
  transition:
    transform 420ms var(--ease-card),
    opacity 300ms;
  cursor: pointer;
}

.cd-case__spine {
  display: flex;
  width: 22px;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  border-radius: 6px 0 0 6px;
  filter: brightness(0.9);
  overflow: hidden;
}

.cd-case__emoji {
  font-size: 13px;
}

.cd-case__title {
  writing-mode: vertical-rl;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  color: rgb(17 17 20 / 0.75);
}

.cd-case__front {
  position: relative;
  z-index: 1;
  display: grid;
  width: 146px;
  place-items: center;
  overflow: hidden;
  border-radius: 0 6px 6px 0;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.35),
    0 14px 24px -12px rgb(17 17 20 / 0.5);
}

.cd-disc {
  position: absolute;
  top: 6px;
  left: 22px;
  z-index: 2;
  display: grid;
  width: 140px;
  height: 140px;
  place-items: center;
  border-radius: 50%;
  box-shadow: 0 10px 22px -10px rgb(17 17 20 / 0.55);
  transition: transform 220ms var(--ease-card);
  touch-action: none;
  cursor: grab;
}

/* Yang berputar hanya muka piringan; tombolnya tetap di posisi geser. */
.cd-disc__face,
.cd-disc__art {
  animation: cd-spin 2.4s linear infinite paused;
}

.cd-disc__face {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle, transparent 0 12%, rgb(255 255 255 / 0.85) 12% 14%, transparent 14%),
    conic-gradient(from 30deg, #e6e9ef, #c3c8d4, #f4f1ea, #c9d6e8, #e6e9ef);
}

.cd-disc__art {
  position: absolute;
  inset: 22%;
  overflow: hidden;
  border-radius: 50%;
  mask: radial-gradient(circle, transparent 0 22%, #000 22%);
  -webkit-mask: radial-gradient(circle, transparent 0 22%, #000 22%);
}

.cd-disc__label {
  position: relative;
  font-family: var(--font-tv);
  font-size: 18px;
  letter-spacing: 0.12em;
  color: var(--color-ink);
  text-shadow: 0 0 4px rgb(255 255 255 / 0.9);
}

.cd-disc.is-playing .cd-disc__face,
.cd-disc.is-playing .cd-disc__art {
  animation-play-state: running;
}

@keyframes cd-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cd-case,
  .cd-disc {
    transition: none;
  }
  .cd-disc__face,
  .cd-disc__art {
    animation: none;
  }
}
</style>
