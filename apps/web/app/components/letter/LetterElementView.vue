<script setup lang="ts">
import { byId, letter, type LetterElement } from '@postpocket/presets'
import { fittedScale } from '~/utils/letter-page'

/**
 * Tampilan satu elemen isi surat. Dipakai halaman surat di kartu dan di editor, jadi yang dilihat
 * penerima sama persis dengan yang disusun pengirim. Semua ukuran memakai `cqw` halaman.
 */
const props = defineProps<{
  element: LetterElement
  photoUrl?: string | null
  /** Pengganti blok teks kosong, misalnya di editor. */
  textPlaceholder?: string
  /** Keterangan slot foto kosong atau foto yang sudah dihapus. */
  photoPlaceholder?: string
  /**
   * Tinggi maksimal blok teks dalam piksel (`textRooms()` kali tinggi halaman). Tulisan yang lebih
   * tinggi dari ini diperkecil hurufnya sampai muat.
   */
  maxHeight?: number
}>()

const emit = defineEmits<{
  /**
   * Skala huruf blok teks setelah disesuaikan dengan ruangnya (1 berarti tidak diperkecil), dan
   * apakah tulisannya tetap lebih tinggi dari ruangnya walau sudah sekecil mungkin.
   */
  fit: [scale: number, overflow: boolean]
}>()

const sticker = computed(() =>
  props.element.kind === 'sticker' ? byId(letter.stickers, props.element.sticker) : undefined,
)

const textEl = ref<HTMLElement | null>(null)
const scale = ref(1)

/**
 * Ukur tinggi tulisan di layar, lalu cari skala huruf terbesar yang masih muat. Ukuran huruf
 * memakai `cqw`, jadi skala yang sama berlaku di kartu, editor, dan tampilan baca.
 */
function refit() {
  const el = textEl.value
  const element = props.element
  if (!el || element.kind !== 'text') return
  const sizeAt = (value: number) => `${element.size * value * 100}cqw`
  // Ruang 0 juga batas: tulisannya diperkecil sekecil-kecilnya, bukan dibiarkan menabrak.
  const next =
    props.maxHeight !== undefined
      ? fittedScale(props.maxHeight, (value) => {
          el.style.fontSize = sizeAt(value)
          return el.offsetHeight
        })
      : 1
  // Ukuran akhir ditulis langsung, karena Vue tidak menulis ulang gaya yang nilainya tidak berubah.
  el.style.fontSize = sizeAt(next)
  const overflow = props.maxHeight !== undefined && el.offsetHeight > props.maxHeight + 0.5
  scale.value = next
  emit('fit', next, overflow)
}

// Sumbernya dipisah, jadi pengukuran hanya diulang kalau salah satu nilainya berubah, bukan
// setiap kali isi surat diperbarui (misalnya saat elemen lain digeser).
watch(
  [
    () => (props.element.kind === 'text' ? props.element.text : null),
    () => (props.element.kind === 'text' ? props.element.size : null),
    () => props.element.width,
    () => props.maxHeight,
    () => props.textPlaceholder,
  ],
  () => nextTick(refit),
)
onMounted(() => {
  refit()
  // Huruf tulisan tangan dimuat belakangan; ukurannya baru benar setelah hurufnya siap.
  document.fonts?.ready.then(refit)
  document.fonts?.addEventListener?.('loadingdone', refit)
})
onBeforeUnmount(() => document.fonts?.removeEventListener?.('loadingdone', refit))
</script>

<template>
  <p
    v-if="element.kind === 'text'"
    ref="textEl"
    class="letter-text"
    :class="{ 'letter-text--empty': !element.text }"
    :style="{ fontSize: `${element.size * scale * 100}cqw`, textAlign: element.align }"
    :data-fit="scale < 1 ? scale.toFixed(2) : undefined"
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
  word-spacing: var(--letter-word-spacing);
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

/* Selama fotonya dimuat, bagian dalam bingkai tidak tampak kosong. */
.letter-photo::before {
  content: '';
  position: absolute;
  inset: 1.4cqw;
  background-color: rgb(17 17 20 / 0.07);
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
