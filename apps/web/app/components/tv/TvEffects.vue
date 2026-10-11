<script setup lang="ts">
import { SCANLINE_ROWS } from '~/utils/photo-filter'

/**
 * Lapisan efek TV di atas layar: scanline dan noise sebagai overlay, RGB split lewat filter SVG
 * `#tv-rgb-split` yang dipasang di gambar atau video. Pasangannya di kanvas: `applyTvEffects`.
 */
defineProps<{ effects: readonly string[] }>()
</script>

<template>
  <svg class="absolute size-0" aria-hidden="true" focusable="false">
    <filter id="tv-rgb-split" color-interpolation-filters="sRGB">
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
        result="red"
      />
      <feOffset in="red" dx="2" result="red-shifted" />
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
        result="cyan"
      />
      <feOffset in="cyan" dx="-2" result="cyan-shifted" />
      <feBlend in="red-shifted" in2="cyan-shifted" mode="screen" />
    </filter>
  </svg>
  <div
    v-if="effects.includes('noise')"
    class="tv-noise pointer-events-none absolute inset-0"
    aria-hidden="true"
  />
  <div
    v-if="effects.includes('scanlines')"
    class="pointer-events-none absolute inset-0"
    :style="{
      backgroundImage:
        'repeating-linear-gradient(to bottom, rgb(0 0 0 / 0.18) 0, rgb(0 0 0 / 0.18) 33.3%, transparent 33.3%, transparent 100%)',
      backgroundSize: `100% calc(100% / ${SCANLINE_ROWS})`,
    }"
    aria-hidden="true"
  />
</template>

<style scoped>
.tv-noise {
  background-image: var(--texture-glitter);
  background-size: 120px;
  mix-blend-mode: overlay;
  opacity: 0.35;
  animation: tv-noise 0.4s steps(4) infinite;
}

@keyframes tv-noise {
  0% {
    background-position: 0 0;
  }
  25% {
    background-position: -30px 20px;
  }
  50% {
    background-position: 40px -10px;
  }
  75% {
    background-position: -15px -35px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tv-noise {
    animation: none;
  }
}
</style>
