import { SUPPORT_PROMPT_KEY, supportPromptDue } from '~/utils/support'

/**
 * Dialog Traktir yang muncul sendiri setelah lembar yang berhasil ditutup (link surat siap, hasil
 * Booth yang sudah disimpan). Paling sering sekali per 30 hari di satu perangkat. Pasang
 * `<SupportDialog v-model:open="open" />` di halamannya, lalu panggil `offer()` saat lembarnya
 * ditutup.
 */
export function useSupportPrompt() {
  const open = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function offer() {
    try {
      if (!supportPromptDue(localStorage.getItem(SUPPORT_PROMPT_KEY), new Date())) return
      localStorage.setItem(SUPPORT_PROMPT_KEY, new Date().toISOString())
    } catch {
      // Tanpa localStorage, masa istirahatnya tidak bisa dicatat: lebih baik tidak muncul sendiri
      // daripada muncul setiap kali.
      return
    }
    // Ditunda sebentar: lembar sebelumnya selesai menutup dan mengambil entri riwayatnya
    // (useBackToClose) dulu, baru dialognya memasang entri baru.
    clearTimeout(timer)
    timer = setTimeout(() => (open.value = true), 400)
  }

  onBeforeUnmount(() => clearTimeout(timer))
  return { open, offer }
}
