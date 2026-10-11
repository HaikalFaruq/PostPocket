import type { MaybeRefOrGetter } from 'vue'

/**
 * Tombol Back di HP menutup lembar layar penuh, bukan meninggalkan halaman. Selama `active`,
 * ada satu entri riwayat tambahan di URL yang sama; Back mengambil entri itu lalu memanggil
 * `close`. Kalau `close` mengembalikan `false` (misalnya user batal membuang hasil yang belum
 * disimpan), entrinya dipasang lagi dan lembarnya tetap terbuka. Lembar yang ditutup dengan cara
 * lain mengambil entrinya sendiri, dan pindah halaman selagi lembar terbuka tetap berjalan.
 */
export function useBackToClose(active: MaybeRefOrGetter<boolean>, close: () => unknown): void {
  if (import.meta.server) return
  const router = useRouter()
  let pushed = false
  // Tujuan pindah halaman yang ditunda sampai entri tambahan diambil.
  let leaving: string | null = null

  function push() {
    history.pushState({ ...history.state, sheet: true }, '')
    pushed = true
  }

  function pop() {
    pushed = false
    history.back()
  }

  function onPopState() {
    if (leaving) {
      const target = leaving
      leaving = null
      void router.push(target)
      return
    }
    if (!pushed) return
    pushed = false
    if (close() === false) push()
  }

  onMounted(() => {
    window.addEventListener('popstate', onPopState)
    watch(
      () => toValue(active),
      (on) => {
        if (on && !pushed) push()
        else if (!on && pushed) pop()
      },
      { immediate: true },
    )
  })

  onBeforeRouteLeave((to) => {
    if (!pushed) return true
    leaving = to.fullPath
    pop()
    return false
  })

  onBeforeUnmount(() => {
    window.removeEventListener('popstate', onPopState)
    if (pushed) pop()
  })
}
