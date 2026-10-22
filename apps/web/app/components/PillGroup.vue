<script setup lang="ts">
import { RadioGroupRoot } from 'reka-ui'

interface PillOption {
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
  <!-- Jarak antarbaris 14 px: bidang ketuk 44 px tiap pil (7 px di atas dan bawahnya) bertemu di
       tengah celah, jadi ketukan di celah tidak diambil pil di baris lain. -->
  <RadioGroupRoot
    v-model="model"
    :aria-label="label"
    orientation="horizontal"
    loop
    class="flex flex-wrap gap-x-2 gap-y-3.5"
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
