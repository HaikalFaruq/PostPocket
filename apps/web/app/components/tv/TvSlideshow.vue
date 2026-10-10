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

useIntervalFn(() => {
  if (props.album.moments.length > 1) index.value = (index.value + 1) % props.album.moments.length
}, 3200)

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
  <div class="absolute inset-0" data-testid="tv-slideshow" :data-filter="filter.id">
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
    <p class="tv-osd top-3 left-4">▶ {{ album.title.toUpperCase() }}</p>
    <p v-if="!album.moments.length" class="tv-osd inset-x-0 top-1/2 -translate-y-1/2 text-center">
      CD KOSONG
    </p>
    <p v-if="date" class="tv-osd bottom-3 left-4">{{ date }}</p>
    <p v-if="album.moments.length" class="tv-osd right-4 bottom-3">
      {{ index + 1 }}/{{ album.moments.length }}
    </p>
  </div>
</template>

<style scoped>
.tv-osd {
  position: absolute;
  margin: 0;
  font-family: var(--font-tv);
  font-size: clamp(16px, 3.4vw, 24px);
  letter-spacing: 0.08em;
  color: var(--color-white);
  text-shadow:
    0 0 6px rgb(255 255 255 / 0.55),
    1px 1px 0 rgb(0 0 0 / 0.6);
}

.tv-fade-enter-active,
.tv-fade-leave-active {
  transition: opacity 450ms;
}

.tv-fade-enter-from,
.tv-fade-leave-to {
  opacity: 0;
}
</style>
