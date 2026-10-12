<script setup lang="ts">
import type { PhotoFilter } from '@postpocket/presets'
import type { AlbumView } from '~/utils/memories'

/**
 * Slideshow album di layar TV dengan filter aktif dan OSD gaya VT323 (judul album, tanggal
 * foto, urutan). Ganti filter langsung berlaku pada foto yang sedang tampil (PRD).
 */
const props = defineProps<{ album: AlbumView; filter: PhotoFilter }>()
const memories = useMemories()
const index = ref(0)
const url = ref<string | null>(null)

const moment = computed(() => memories.data.moments[props.album.moments[index.value] ?? ''])

watch(
  () => props.album.id,
  () => (index.value = 0),
)

// Foto yang baru ditambahkan ke CD yang sedang diputar langsung tampil, supaya terlihat masuk.
watch(
  () => props.album.moments.length,
  (length, before) => {
    if (before !== undefined && length > before) index.value = before
  },
)

watch(
  [() => props.album.moments, index],
  async ([ids, current]) => {
    const id = ids[current]
    url.value = id ? await memories.photoUrl(id) : null
    // Siapkan foto berikutnya supaya pergantiannya mulus.
    const next = ids[(current + 1) % Math.max(1, ids.length)]
    if (next) memories.photoUrl(next)
  },
  { immediate: true },
)

const timer = useIntervalFn(() => {
  if (props.album.moments.length > 1) index.value = (index.value + 1) % props.album.moments.length
}, 3200)

/** Ketuk layar untuk foto berikutnya; hitungan ganti otomatisnya diulang dari awal. */
function next() {
  if (props.album.moments.length < 2) return
  index.value = (index.value + 1) % props.album.moments.length
  timer.pause()
  timer.resume()
}

const filterCss = computed(() => {
  const parts = [
    props.filter.effects.includes('rgb-split') ? 'url(#tv-rgb-split)' : '',
    props.filter.css === 'none' ? '' : props.filter.css,
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : 'none'
})

const date = computed(() =>
  moment.value
    ? new Date(moment.value.takenAt)
        .toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .replaceAll('/', '.')
    : '',
)
</script>

<template>
  <div class="tv-slideshow absolute inset-0" data-testid="tv-slideshow" :data-filter="filter.id">
    <Transition name="tv-fade">
      <img
        v-if="url"
        :key="url"
        :src="url"
        alt=""
        class="absolute inset-0 size-full object-cover"
        :style="{ filter: filterCss }"
        draggable="false"
      />
    </Transition>
    <TvEffects :effects="filter.effects" />
    <!-- Bayangan tipis di atas dan bawah supaya teks OSD tetap terbaca di foto yang ramai. -->
    <div class="tv-scrim" aria-hidden="true" />
    <p class="tv-osd tv-osd--title top-3 left-4">▶ {{ album.title.toUpperCase() }}</p>
    <p v-if="!album.moments.length" class="tv-osd inset-x-0 top-1/2 -translate-y-1/2 text-center">
      CD KOSONG
    </p>
    <p v-if="date" class="tv-osd bottom-3 left-4">{{ date }}</p>
    <p v-if="album.moments.length" class="tv-osd right-4 bottom-3" data-testid="tv-counter">
      {{ index + 1 }}/{{ album.moments.length }}
    </p>
    <button
      v-if="album.moments.length > 1"
      type="button"
      class="absolute inset-0 z-[2] cursor-pointer"
      aria-label="Foto berikutnya"
      data-testid="tv-next"
      @click="next"
    />
  </div>
</template>

<style scoped>
/* Layar menyala saat CD masuk: garis terang yang melebar seperti TV tabung. */
.tv-slideshow {
  animation: tv-power-on 520ms var(--ease-card);
}

@keyframes tv-power-on {
  0% {
    filter: brightness(3);
    transform: scale(0.9, 0.006);
  }
  45% {
    filter: brightness(2);
    transform: scale(1, 0.012);
  }
  100% {
    filter: brightness(1);
    transform: scale(1);
  }
}

.tv-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgb(0 0 0 / 0.45),
    transparent 24%,
    transparent 74%,
    rgb(0 0 0 / 0.5)
  );
  pointer-events: none;
}

.tv-osd {
  position: absolute;
  z-index: 1;
  margin: 0;
  font-family: var(--font-tv);
  font-size: clamp(16px, 3.4vw, 24px);
  letter-spacing: 0.08em;
  color: var(--color-white);
  text-shadow:
    0 0 6px rgb(255 255 255 / 0.55),
    1px 1px 0 rgb(0 0 0 / 0.6);
}

.tv-osd--title {
  max-width: calc(100% - 2rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tv-fade-enter-active,
.tv-fade-leave-active {
  transition: opacity 450ms;
}

.tv-fade-enter-from,
.tv-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .tv-slideshow {
    animation: none;
  }
}
</style>
