<script setup lang="ts">
import { SUPPORT_NUDGE_KEY, SUPPORT_URL, supportNudgeVisible } from '~/utils/support'

/**
 * Ajakan Traktir kecil di layar yang baru saja berhasil (surat terkirim, hasil Booth tersimpan):
 * satu baris dengan perangko mini, bukan popup. Tautannya langsung ke Sociabuzz di tab baru.
 * Setelah ditutup atau ditekan, tidak muncul lagi di perangkat ini selama 30 hari.
 */
const visible = ref(false)
onMounted(() => {
  try {
    visible.value = supportNudgeVisible(localStorage.getItem(SUPPORT_NUDGE_KEY), new Date())
  } catch {
    // localStorage bisa ditolak; ajakannya tetap boleh tampil.
    visible.value = true
  }
})

function rest() {
  visible.value = false
  try {
    localStorage.setItem(SUPPORT_NUDGE_KEY, new Date().toISOString())
  } catch {
    // Tanpa localStorage, ajakannya hanya hilang sampai halaman dimuat ulang.
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="flex items-center gap-3 rounded-[16px] bg-panel py-2.5 pr-1.5 pl-3"
    data-testid="support-nudge"
  >
    <SupportStamp class="w-7 shrink-0" />
    <p class="min-w-0 flex-1 text-caption text-pretty text-ink-muted">
      Suka PostPocket?
      <a
        :href="SUPPORT_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="font-semibold text-ink underline underline-offset-2"
        data-testid="support-nudge-link"
        @click="rest"
        >Traktir seikhlasnya<span class="sr-only"> lewat Sociabuzz (dibuka di tab baru)</span></a
      >
      lewat Sociabuzz.
    </p>
    <IconButton label="Sembunyikan ajakan Traktir" size="sm" variant="ghost" @click="rest">
      <Icon name="close" :size="13" />
    </IconButton>
  </div>
</template>
