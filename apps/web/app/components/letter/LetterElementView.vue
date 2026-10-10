<script setup lang="ts">
import { byId, letter, type LetterElement } from '@postpocket/presets'

/**
 * Tampilan satu elemen isi surat. Dipakai halaman surat di kartu dan di editor, jadi yang dilihat
 * penerima sama persis dengan yang disusun pengirim. Semua ukuran memakai `cqw` halaman.
 */
const props = defineProps<{
  element: LetterElement
  photoUrl?: string | null
  /** Pengganti blok teks kosong, hanya di editor. */
  textPlaceholder?: string
  /** Keterangan slot foto kosong atau foto yang sudah dihapus. */
  photoPlaceholder?: string
}>()

const sticker = computed(() =>
  props.element.kind === 'sticker' ? byId(letter.stickers, props.element.sticker) : undefined,
)
</script>

<template>
  <p
    v-if="element.kind === 'text'"
    class="letter-text"
    :class="{ 'letter-text--empty': !element.text }"
    :style="{ fontSize: `${element.size * 100}cqw`, textAlign: element.align }"
    v-text="element.text || textPlaceholder"
  />
  <div
    v-else-if="element.kind === 'photo'"
    class="letter-photo"
    :style="{ aspectRatio: element.aspect }"
  >
    <img v-if="photoUrl" :src="photoUrl" alt="" draggable="false" />
    <div v-else class="letter-photo__empty">
      <Icon name="camera" :size="16" />
      <span v-if="photoPlaceholder">{{ photoPlaceholder }}</span>
    </div>
  </div>
  <img
    v-else-if="sticker"
    class="letter-sticker"
    :src="sticker.src"
    :alt="sticker.label"
    draggable="false"
  />
</template>

<style scoped>
.letter-text {
  margin: 0;
  font-family: var(--font-letter);
  line-height: 1.2;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.letter-text--empty {
  opacity: 0.4;
}

.letter-photo {
  position: relative;
  background-color: var(--color-white);
  border-radius: 0.5cqw;
  box-shadow: 0 0.5cqw 1.6cqw rgb(17 17 20 / 0.18);
}

.letter-photo > img,
.letter-photo__empty {
  position: absolute;
  inset: 1.4cqw;
  width: calc(100% - 2.8cqw);
  height: calc(100% - 2.8cqw);
  border-radius: 0.3cqw;
}

.letter-photo > img {
  object-fit: cover;
  user-select: none;
}

.letter-photo__empty {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 1cqw;
  border: 0.4cqw dashed currentColor;
  color: rgb(17 17 20 / 0.45);
  font-family: var(--font-sans);
  font-size: 3cqw;
  text-align: center;
}

.letter-sticker {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 0.5cqw 0.8cqw rgb(17 17 20 / 0.2));
  user-select: none;
}
</style>
