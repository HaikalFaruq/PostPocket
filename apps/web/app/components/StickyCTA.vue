<script setup lang="ts">
/** Tombol utama hitam selebar panel yang menempel di bawah. */
defineProps<{ disabled?: boolean; loading?: boolean }>()
</script>

<template>
  <div
    class="sticky bottom-0 z-10 border-t border-line-soft bg-panel/95 px-6 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] backdrop-blur-sm"
  >
    <button
      type="button"
      :disabled="disabled || loading"
      :aria-busy="loading || undefined"
      class="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-control bg-ink px-4 text-body font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-ink/90 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
    >
      <span
        v-if="loading"
        class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        aria-hidden="true"
      />
      <slot />
    </button>
  </div>
</template>
