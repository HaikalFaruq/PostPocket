<script setup lang="ts">
/** Tombol bulat untuk panah, tutup, dan chevron. `label` wajib karena isinya hanya ikon. */
withDefaults(
  defineProps<{
    label: string
    size?: 'sm' | 'md' | 'lg'
    variant?: 'surface' | 'ghost' | 'ink'
  }>(),
  { size: 'md', variant: 'surface' },
)

const sizes = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-11',
}

const variants = {
  surface: 'bg-surface text-ink shadow-float hover:bg-panel',
  ghost: 'text-ink hover:bg-fill',
  ink: 'bg-ink text-white hover:bg-ink/90',
}
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    class="inline-grid shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
    :class="[sizes[size], variants[variant]]"
  >
    <slot />
  </button>
</template>
