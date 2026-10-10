<script setup lang="ts">
import type { FoilColor, Paper } from '@postpocket/presets'

/** Sampul kartu mini tanpa gerak, untuk pilihan gambar depan. */
const props = defineProps<{
  art: string
  foilMask?: string
  foil: FoilColor
  paper: Paper
}>()

const style = computed(() => ({
  backgroundColor: props.paper.color,
  '--metal': metalGradient(props.foil),
}))

const maskStyle = computed(() =>
  props.foilMask
    ? { maskImage: `url("${props.foilMask}")`, WebkitMaskImage: `url("${props.foilMask}")` }
    : undefined,
)
</script>

<template>
  <span class="foil-thumb" :style="style" aria-hidden="true">
    <img :src="art" alt="" class="foil-thumb__art" draggable="false" />
    <span v-if="maskStyle" class="foil-thumb__foil" :style="maskStyle" />
  </span>
</template>

<style scoped>
.foil-thumb {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 4px;
}

.foil-thumb__art,
.foil-thumb__foil {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.foil-thumb__art {
  object-fit: cover;
}

.foil-thumb__foil {
  background-image: var(--metal);
  background-size: 220% 220%;
  background-position: 35% 30%;
  mask-size: cover;
  mask-position: center;
  mask-repeat: no-repeat;
  -webkit-mask-size: cover;
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
}
</style>
