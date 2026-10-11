<script setup lang="ts">
import { INSTALL_HIDDEN_KEY, installHint, requestPersistentStorage } from '~/utils/pwa'

/**
 * Ajakan memasang PostPocket ke layar utama. Chrome dan sejenisnya memakai dialog pasang
 * bawaan; di iPhone ditampilkan petunjuk Bagikan lalu Tambah ke Layar Utama. Aplikasi yang
 * terpasang terhindar dari penghapusan data otomatis Safari.
 */
const { $pwa } = useNuxtApp()
const env = ref<{ userAgent: string; maxTouchPoints: number; standalone: boolean } | null>(null)
const dismissed = ref(false)

onMounted(() => {
  env.value = {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  }
  try {
    dismissed.value = localStorage.getItem(INSTALL_HIDDEN_KEY) === 'true'
  } catch {
    // localStorage bisa ditolak; kartu tetap boleh tampil.
  }
})

const hint = computed(() =>
  env.value
    ? installHint({
        ...env.value,
        canPrompt: !!$pwa?.showInstallPrompt,
        dismissed: dismissed.value,
      })
    : null,
)

async function install() {
  const choice = await $pwa?.install()
  if (choice?.outcome === 'accepted') requestPersistentStorage()
}

function dismiss() {
  const usedPrompt = hint.value === 'prompt'
  dismissed.value = true
  // Untuk dialog bawaan, @vite-pwa/nuxt yang menyimpan kuncinya.
  if (usedPrompt) return $pwa?.cancelInstall()
  try {
    localStorage.setItem(INSTALL_HIDDEN_KEY, 'true')
  } catch {
    // Tidak tersimpan: kartu muncul lagi di kunjungan berikutnya.
  }
}
</script>

<template>
  <aside
    v-if="hint"
    class="flex items-start gap-3 rounded-[20px] bg-surface p-4 shadow-raised"
    aria-label="Pasang PostPocket"
    data-testid="install-card"
    :data-hint="hint"
  >
    <img src="/pwa-192x192.png" alt="" class="size-11 shrink-0 rounded-[10px]" />
    <div class="min-w-0 flex-1">
      <p class="text-[15px] font-semibold">Pasang PostPocket</p>
      <p v-if="hint === 'prompt'" class="mt-0.5 text-caption text-ink-muted">
        Buka langsung dari layar utama, dan tetap bisa dipakai saat sinyal hilang.
      </p>
      <p v-else class="mt-0.5 text-caption text-ink-muted">
        Ketuk <Icon name="share" :size="14" class="inline-block align-[-2px]" /> Bagikan, lalu
        <span class="font-semibold text-ink">Tambah ke Layar Utama</span>. Dengan begitu Safari
        tidak menghapus draf dan fotomu.
      </p>
      <div class="mt-3 flex gap-2">
        <button
          v-if="hint === 'prompt'"
          type="button"
          class="inline-flex h-9 items-center gap-1.5 rounded-control bg-ink px-3.5 text-body font-semibold text-white hover:bg-ink/90"
          @click="install"
        >
          <Icon name="download" :size="15" /> Pasang
        </button>
        <button
          type="button"
          class="inline-flex h-9 items-center rounded-control px-3 text-body text-ink-muted hover:bg-fill hover:text-ink"
          :class="hint === 'ios' && '-ml-3'"
          @click="dismiss"
        >
          {{ hint === 'prompt' ? 'Nanti saja' : 'Oke, mengerti' }}
        </button>
      </div>
    </div>
  </aside>
</template>
