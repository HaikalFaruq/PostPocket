<script setup lang="ts">
import { stripGeometry, type BoothLayout } from '~/utils/booth'

/**
 * Pratinjau hasil Booth di pojok layar kamera: kertas kecil dengan petak foto yang sama persis
 * dengan hasil akhirnya (strip 1×4, grid 2×2, atau satu foto). Petak terisi tiap kali jepretan
 * diambil, dan petak berikutnya berkedip, jadi user tahu bentuk hasilnya dan sudah sampai mana.
 */
const props = defineProps<{
  layout: BoothLayout
  /** Jepretan yang sudah diambil, sebagai URL gambar kecil. */
  shots: string[]
  /** Sedang hitung mundur atau memotret: petak berikutnya ditandai. */
  active?: boolean
}>()

const geometry = computed(() => stripGeometry(props.layout))
const percent = (value: number, total: number) => `${(value / total) * 100}%`
const cells = computed(() =>
  geometry.value.cells.map((cell) => ({
    left: percent(cell.x, geometry.value.width),
    top: percent(cell.y, geometry.value.height),
    width: percent(cell.width, geometry.value.width),
    height: percent(cell.height, geometry.value.height),
  })),
)
</script>

<template>
  <div
    class="booth-preview"
    :class="`is-${layout}`"
    :style="{ aspectRatio: `${geometry.width} / ${geometry.height}` }"
    data-testid="booth-preview"
    :data-layout="layout"
    aria-hidden="true"
  >
    <span
      v-for="(cell, i) in cells"
      :key="i"
      class="booth-preview__cell"
      :class="{ 'is-next': active && i === shots.length, 'is-filled': !!shots[i] }"
      :style="cell"
    >
      <img v-if="shots[i]" :src="shots[i]" alt="" />
      <span v-else>{{ i + 1 }}</span>
    </span>
    <span class="booth-preview__footer" />
  </div>
</template>

<style scoped>
/* Kertas hasil Booth versi mini, di pojok kanan bawah layar kamera. */
.booth-preview {
  position: absolute;
  right: 3.5%;
  bottom: 5%;
  border-radius: 4px;
  background: #fbf9f4;
  box-shadow:
    0 10px 24px -10px rgb(0 0 0 / 0.7),
    0 0 0 1px rgb(255 255 255 / 0.5);
  transform: rotate(3deg);
  transition:
    height 300ms var(--ease-card),
    width 300ms var(--ease-card);
}

.booth-preview.is-strip {
  height: 60%;
}

.booth-preview.is-grid,
.booth-preview.is-single {
  width: 30%;
}

.booth-preview__cell {
  position: absolute;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 2px;
  background: rgb(24 32 74 / 0.16);
  font-family: var(--font-tv);
  font-size: 15px;
  line-height: 1;
  color: rgb(24 32 74 / 0.55);
}

.booth-preview__cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: cell-in 260ms var(--ease-card);
}

.booth-preview__cell.is-next {
  background: rgb(24 32 74 / 0.08);
  box-shadow: inset 0 0 0 2px var(--color-tv-accent);
  animation: cell-next 900ms ease-in-out infinite;
}

/* Garis tanggal di kaki kertas, seperti di hasil akhirnya. */
.booth-preview__footer {
  position: absolute;
  bottom: 3.2%;
  left: 50%;
  width: 34%;
  height: 2px;
  border-radius: 2px;
  background: rgb(24 32 74 / 0.25);
  transform: translateX(-50%);
}

@keyframes cell-next {
  50% {
    box-shadow: inset 0 0 0 2px transparent;
  }
}

@keyframes cell-in {
  from {
    opacity: 0;
    transform: scale(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .booth-preview {
    transition: none;
  }

  .booth-preview__cell.is-next,
  .booth-preview__cell img {
    animation: none;
  }
}
</style>
