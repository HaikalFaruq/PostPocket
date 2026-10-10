<script setup lang="ts">
import type { FoilColor } from '@postpocket/presets'

/** Bunga kecil berkilau di dalam swatch warna foil (langkah 3 Letter). */
const props = defineProps<{ foil: FoilColor }>()

const style = computed(() => ({ '--metal': metalGradient(props.foil) }))
</script>

<template>
  <!-- Bayangan di pembungkus, mask di bentuk bunga: mask dijalankan setelah filter. -->
  <span class="foil-swatch-icon" aria-hidden="true">
    <span class="foil-swatch-icon__shape" :style="style" />
  </span>
</template>

<style scoped>
.foil-swatch-icon {
  display: block;
  filter: drop-shadow(0 0.5px 0.5px rgb(17 17 20 / 0.25));
}

.foil-swatch-icon__shape {
  display: block;
  width: 26px;
  height: 30px;
  background-image: var(--metal);
  background-size: 260% 260%;
  background-position: 40% 30%;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 30'%3E%3Cg fill='%23000'%3E%3Ccircle cx='13' cy='6.5' r='5.2'/%3E%3Ccircle cx='7' cy='11.5' r='5.2'/%3E%3Ccircle cx='19' cy='11.5' r='5.2'/%3E%3Ccircle cx='13' cy='15.5' r='4.4'/%3E%3Cpath d='M12 17h2v12h-2z'/%3E%3Cpath d='M13 24c-3-3-6-3-8-2 2 2 5 3 8 2zM13 22c3-3 6-3 8-2-2 2-5 3-8 2z'/%3E%3C/g%3E%3C/svg%3E")
    center / contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 30'%3E%3Cg fill='%23000'%3E%3Ccircle cx='13' cy='6.5' r='5.2'/%3E%3Ccircle cx='7' cy='11.5' r='5.2'/%3E%3Ccircle cx='19' cy='11.5' r='5.2'/%3E%3Ccircle cx='13' cy='15.5' r='4.4'/%3E%3Cpath d='M12 17h2v12h-2z'/%3E%3Cpath d='M13 24c-3-3-6-3-8-2 2 2 5 3 8 2zM13 22c3-3 6-3 8-2-2 2-5 3-8 2z'/%3E%3C/g%3E%3C/svg%3E")
    center / contain no-repeat;
}
</style>
