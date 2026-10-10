<script setup lang="ts">
import { RadioGroupRoot } from 'reka-ui'

export interface PillOption {
  value: string
  label: string
  disabled?: boolean
}

/** Pilihan teks tunggal berbentuk pil. Panah kiri/kanan pindah pilihan. */
defineProps<{
  /** Nama grup untuk pembaca layar, misalnya "Bentuk kartu". */
  label: string
  options?: PillOption[]
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <RadioGroupRoot
    v-model="model"
    :aria-label="label"
    orientation="horizontal"
    loop
    class="flex flex-wrap gap-2"
  >
    <slot>
      <PillChip
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </PillChip>
    </slot>
  </RadioGroupRoot>
</template>
