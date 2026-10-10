<script setup lang="ts">
import { RadioGroupItem } from 'reka-ui'

/** Satu pilihan di dalam <PillGroup>. Aktif = isi hitam, teks putih. */
defineProps<{ value: string; disabled?: boolean }>()
</script>

<template>
  <RadioGroupItem
    :value="value"
    :disabled="disabled"
    class="inline-flex h-[30px] items-center rounded-full bg-surface px-3 text-chip whitespace-nowrap text-ink inset-ring inset-ring-line transition-colors duration-150 hover:bg-panel disabled:pointer-events-none disabled:opacity-40 data-[state=checked]:bg-ink data-[state=checked]:text-white data-[state=checked]:inset-ring-ink"
  >
    <slot />
  </RadioGroupItem>
</template>
