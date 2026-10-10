<script setup lang="ts">
import { RadioGroupItem } from 'reka-ui'

/**
 * Satu pilihan warna di dalam <SwatchGroup>.
 * `sm` 30 px (kertas), `md` 40 px (kantong), `lg` 48 px dengan ikon di slot (warna foil).
 */
withDefaults(
  defineProps<{
    value: string
    label: string
    color?: string
    size?: 'sm' | 'md' | 'lg'
    check?: boolean
  }>(),
  { color: undefined, size: 'sm', check: false },
)

const sizes = {
  sm: 'size-[30px]',
  md: 'size-10',
  lg: 'size-12',
}
</script>

<template>
  <RadioGroupItem
    :value="value"
    :aria-label="label"
    :title="label"
    class="group relative grid shrink-0 place-items-center rounded-full transition-shadow duration-150"
    :class="[
      sizes[size],
      size === 'lg'
        ? 'data-[state=checked]:bg-surface data-[state=checked]:inset-ring-[1.5px] data-[state=checked]:inset-ring-ink'
        : 'data-[state=checked]:shadow-[0_0_0_2.5px_var(--swatch-gap,var(--color-panel)),0_0_0_4px_var(--color-ink)]',
    ]"
  >
    <span
      v-if="color"
      class="size-full rounded-full inset-ring inset-ring-line"
      :class="size === 'lg' && 'size-[34px]'"
      :style="{ backgroundColor: color }"
    />
    <slot />
    <span
      v-if="check"
      class="absolute -top-1 -right-1 hidden size-4 place-items-center rounded-full bg-surface text-ink shadow-float group-data-[state=checked]:grid"
      aria-hidden="true"
    >
      <Icon name="check" :size="10" />
    </span>
  </RadioGroupItem>
</template>
