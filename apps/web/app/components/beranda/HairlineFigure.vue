<script setup lang="ts">
import { HL } from '~/utils/hairline/kernel'
import type { HairlineFigure } from '~/utils/hairline/figure'

/**
 * Satu figur garis Hairline yang bergerak sendiri dalam putaran (tur) dan menjawab pointer:
 * begitu disentuh, "tangan" tak terlihatnya minggir, dan kembali berjalan setelah ditinggal.
 * Di server hanya kotak kosong 5:4, jadi halaman tidak bergeser saat figurnya digambar. Dengan
 * `prefers-reduced-motion` figurnya diam, tapi tetap menjawab pointer.
 */
const props = withDefaults(defineProps<{ figure: HairlineFigure; play?: boolean }>(), {
  play: true,
})
const host = ref<HTMLElement | null>(null)
let stop: (() => void) | undefined

onMounted(() => {
  const stage = host.value
  if (!stage) return
  HL.inject(document)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 400 320')
  svg.setAttribute('aria-hidden', 'true')
  stage.append(svg)
  // Keterangan figur (misalnya "kantong 2") ditulis ke data-read: dipakai E2E, tidak ditampilkan.
  const read = {
    get textContent() {
      return stage.dataset.read ?? null
    },
    set textContent(value: string | null) {
      stage.dataset.read = value ?? ''
    },
  }
  read.textContent = props.figure.rest
  // Tur didaftarkan lebih dulu, jadi di setiap frame tangannya bergerak sebelum figurnya menggambar.
  const tour = props.play ? HL.tour(stage, props.figure.tour ?? HL.LAP) : null
  const figure = props.figure.mount({ stage, svg, read }, props.figure.range[1] ?? 0)
  stop = () => {
    tour?.stop()
    figure.destroy()
    svg.remove()
  }
})
onBeforeUnmount(() => stop?.())
</script>

<template>
  <div
    ref="host"
    class="hairline"
    data-hairline
    role="img"
    :aria-label="figure.label"
    :data-figure="figure.name"
  />
</template>

<style scoped>
/*
 * Palet Hairline dari tinta PostPocket di atas kertas putih: plate harus sama dengan warna di
 * belakang figur, karena bidangnya diisi warna itu untuk menutupi garis di belakangnya.
 */
.hairline {
  /* Sama dengan gaya bawaan Hairline, supaya kotaknya sudah berukuran 5:4 sejak dirender server. */
  display: block;
  position: relative;
  aspect-ratio: 5 / 4;
  /* Hairline hanya mengizinkan geser vertikal di atas figur; cubit untuk memperbesar tetap jalan. */
  touch-action: pan-y pinch-zoom;
  --hairline-plate: var(--color-white);
  --hairline-hi: var(--color-ink);
  --hairline-edge: var(--color-hairline-edge);
  --hairline-mid: var(--color-hairline-mid);
  --hairline-lo: var(--color-hairline-lo);
  --hairline-stroke: 1;
}

/* Kisi titik isometrik di belakang figur, memudar ke tepi, seperti panggung Hairline. */
.hairline::before {
  content: '';
  position: absolute;
  inset: 4% 6%;
  background-image:
    radial-gradient(circle, var(--color-line) 0.8px, transparent 1.1px),
    radial-gradient(circle, var(--color-line) 0.8px, transparent 1.1px);
  background-position:
    0 0,
    7px 3.5px;
  background-size: 14px 7px;
  mask-image: radial-gradient(closest-side, #000 35%, transparent);
  pointer-events: none;
}
</style>
