<script setup lang="ts">
import { RadioGroupItem } from 'reka-ui'

/**
 * Satu pilihan di dalam <PillGroup>. Aktif = isi hitam, teks putih. Pilnya setinggi 30 px, tapi
 * bidang ketuknya 44 px (`before:` yang tidak terlihat), sesuai ukuran jari.
 */
defineProps<{ value: string; disabled?: boolean }>()
</script>

<template>
  <RadioGroupItem
    :value="value"
    :disabled="disabled"
    class="relative inline-flex h-[30px] items-center rounded-full bg-surface px-3 text-chip whitespace-nowrap text-ink inset-ring inset-ring-line transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-[''] hover:bg-panel disabled:pointer-events-none disabled:opacity-40 data-[state=checked]:bg-ink data-[state=checked]:text-white data-[state=checked]:inset-ring-ink"
  >
    <slot />
  </RadioGroupItem>
</template>
