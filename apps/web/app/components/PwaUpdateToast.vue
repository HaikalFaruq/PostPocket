<script setup lang="ts">
/**
 * Kabar versi baru dari service worker. User yang memilih kapan memuat ulang, supaya tulisan
 * yang sedang diketik tidak terpotong; versi baru juga terpakai sendiri di kunjungan berikutnya.
 */
const { $pwa } = useNuxtApp()

function reload() {
  $pwa?.updateServiceWorker(true)
}

function later() {
  $pwa?.cancelPrompt()
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="-translate-y-2 opacity-0"
    leave-active-class="transition duration-150 ease-in"
    leave-to-class="-translate-y-2 opacity-0"
  >
    <div
      v-if="$pwa?.needRefresh"
      role="status"
      class="fixed inset-x-4 top-[max(12px,env(safe-area-inset-top))] z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-caption text-white shadow-raised"
    >
      <span>Versi baru PostPocket siap.</span>
      <button
        type="button"
        class="h-7 rounded-full bg-white px-3 font-semibold text-ink hover:bg-white/90"
        @click="reload"
      >
        Muat ulang
      </button>
      <button
        type="button"
        aria-label="Nanti saja"
        title="Nanti saja"
        class="grid size-7 place-items-center rounded-full text-white/70 hover:text-white"
        @click="later"
      >
        <Icon name="close" :size="14" />
      </button>
    </div>
  </Transition>
</template>
