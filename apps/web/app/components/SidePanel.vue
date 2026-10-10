<script setup lang="ts">
/** Wadah panel opsi di desktop: kolom kanan 400 px setinggi layar. Di HP pakai <BottomSheet>. */
defineProps<{ label: string }>()
</script>

<template>
  <aside
    :aria-label="label"
    class="sticky top-0 flex h-dvh w-[400px] shrink-0 flex-col border-l border-line-soft bg-panel"
  >
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <slot />
    </div>
    <slot name="footer" />
  </aside>
</template>
