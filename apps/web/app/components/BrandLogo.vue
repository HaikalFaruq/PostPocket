<script setup lang="ts">
import { BRAND_LOCKUP, BRAND_SYMBOL, BRAND_WORDMARK } from '~/utils/brand-logo'

/**
 * Logo PostPocket (docs/desain.md bagian Logo): P-amplop dengan tutup emas, dan wordmark yang
 * sudah jadi garis. Tingginya diatur lewat kelas (misalnya `h-7`), lebarnya mengikuti. Tinta
 * memakai `currentColor`, jadi ikut warna teks di sekitarnya.
 */
const props = withDefaults(defineProps<{ variant?: 'lockup' | 'symbol' | 'wordmark' }>(), {
  variant: 'lockup',
})

const box = computed(() => {
  if (props.variant === 'symbol') return { width: BRAND_SYMBOL.width, height: BRAND_SYMBOL.height }
  if (props.variant === 'wordmark') {
    return { width: BRAND_WORDMARK.width, height: BRAND_WORDMARK.cap + BRAND_WORDMARK.descent }
  }
  return { width: BRAND_LOCKUP.width, height: BRAND_LOCKUP.height }
})
const wordmarkX = computed(() =>
  props.variant === 'wordmark' ? 0 : BRAND_SYMBOL.width + BRAND_LOCKUP.gap,
)
</script>

<template>
  <svg
    :viewBox="`0 0 ${box.width} ${box.height}`"
    :style="{ aspectRatio: `${box.width} / ${box.height}` }"
    class="w-auto shrink-0"
    role="img"
    aria-label="PostPocket"
    fill="currentColor"
  >
    <template v-if="variant !== 'wordmark'">
      <path fill-rule="evenodd" :d="`${BRAND_SYMBOL.outline} ${BRAND_SYMBOL.flap}`" />
      <path class="fill-brand-gold" :d="BRAND_SYMBOL.flap" />
    </template>
    <path
      v-if="variant !== 'symbol'"
      :transform="`translate(${wordmarkX} ${BRAND_WORDMARK.cap})`"
      :d="BRAND_WORDMARK.d"
    />
  </svg>
</template>
