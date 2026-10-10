<script setup lang="ts">
import type { LetterContent } from '@postpocket/presets'
import { elementStyle } from '~/utils/letter-page'

/**
 * Halaman surat yang tinggal dilihat: di dalam kartu editor, dan nanti di halaman penerima.
 * Mengisi seluruh muka kartu; ukurannya mengikuti `container-type` muka kartu itu.
 */
defineProps<{
  content: LetterContent
  photoUrls: Record<string, string>
  /** Keterangan untuk slot foto tanpa gambar, misalnya foto yang sudah dihapus. */
  photoPlaceholder?: string
}>()
</script>

<template>
  <div class="letter-page" data-testid="letter-page">
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
