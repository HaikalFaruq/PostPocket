<script setup lang="ts">
import { RadioGroupRoot } from 'reka-ui'

export interface SwatchOption {
  value: string
  label: string
  color: string
}

/** Pilihan warna bulat. Label warna aktif ditampilkan pemanggil di samping judul langkah. */
withDefaults(
  defineProps<{
    label: string
    options?: SwatchOption[]
    size?: 'sm' | 'md' | 'lg'
    /** Tanda centang kecil di swatch aktif (gaya Day Pocket). */
    check?: boolean
  }>(),
  { options: undefined, size: 'sm', check: false },
)

const model = defineModel<string>({ required: true })
</script>

<template>
  <RadioGroupRoot
    v-model="model"
    :aria-label="label"
    orientation="horizontal"
    loop
    class="flex flex-wrap items-center gap-2.5"
  >
    <slot>
      <Swatch
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :label="option.label"
        :color="option.color"
        :size="size"
        :check="check"
      />
    </slot>
  </RadioGroupRoot>
</template>
