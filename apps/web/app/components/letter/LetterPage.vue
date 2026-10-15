<script setup lang="ts">
import { textRooms, type LetterContent } from '@postpocket/presets'
import { elementStyle } from '~/utils/letter-page'

/**
 * Halaman surat yang tinggal dilihat: di dalam kartu dan di tampilan baca. Mengisi seluruh muka
 * kartu; ukurannya mengikuti `container-type` muka kartu itu. Tulisan yang terlalu panjang untuk
 * ruangnya diperkecil hurufnya (`textRooms()`), sama seperti di editor.
 */
const props = defineProps<{
  content: LetterContent
  photoUrls: Record<string, string>
  /** Keterangan untuk slot foto tanpa gambar, misalnya foto yang sudah dihapus. */
  photoPlaceholder?: string
  /** Pengganti blok teks kosong, misalnya petunjuk di kartu editor. */
  textPlaceholder?: string
}>()

const root = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(root)
// Rasio halaman diambil dari ukurannya sendiri. Halaman yang belum terukur tidak membatasi tulisan.
const rooms = computed(() =>
  width.value > 0 && height.value > 0 ? textRooms(props.content, width.value / height.value) : {},
)
function maxHeight(id: string): number | undefined {
  const room = rooms.value[id]
  return room === undefined ? undefined : room * height.value
}
</script>

<template>
  <div ref="root" class="letter-page" data-testid="letter-page">
    <div
      v-for="element in content.elements"
      :key="element.id"
      class="letter-item"
      :data-kind="element.kind"
      :style="elementStyle(element)"
    >
      <LetterElementView
        :element="element"
        :photo-url="element.kind === 'photo' && element.photo ? photoUrls[element.photo] : null"
        :photo-placeholder="photoPlaceholder"
        :text-placeholder="textPlaceholder"
        :max-height="maxHeight(element.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.letter-page {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.letter-item {
  position: absolute;
}
</style>
