import type { MaybeRefOrGetter } from 'vue'
import type { Router } from 'vue-router'

interface Sheet {
  close: () => unknown
  /** Lembar ini sedang punya satu entri riwayat tambahan. */
  pushed: boolean
}

// Lembar yang terpasang, yang terakhir dibuka paling belakang. Back hanya menutup lembar paling
// atas, jadi dialog di atas Hasil Booth tertutup lebih dulu daripada Hasil Booth-nya.
const sheets: Sheet[] = []
// Jumlah popstate yang masih ditunggu dari history.back() atau history.go() milik kode ini, bukan
// dari tombol Back.
let ownPops = 0
// Tujuan pindah halaman yang ditunda sampai semua entri tambahan diambil.
let leaving: string | null = null
let leaveTimer: ReturnType<typeof setTimeout> | undefined
let installed = false

function topSheet(): Sheet | undefined {
  for (let i = sheets.length - 1; i >= 0; i--) if (sheets[i]!.pushed) return sheets[i]
  return undefined
}

function push(sheet: Sheet) {
  // Lembar menutup di atas halaman, jadi saat entri tambahannya diambil lagi halamannya tetap di
  // tempat. Dengan scrollRestoration "auto" (Nuxt baru memakai "manual" setelah beberapa kali
  // pindah halaman), Chrome mengembalikan halaman ke posisi saat lembarnya dibuka, misalnya folder
  // Kotak surat yang ditutup setelah halamannya digulir.
  history.scrollRestoration = 'manual'
  history.pushState({ ...history.state, sheet: true }, '')
  sheet.pushed = true
  sheets.splice(sheets.indexOf(sheet), 1)
  sheets.push(sheet)
}

/** Ambil satu entri tambahan. Semua entri tambahan sama isinya, jadi urutannya tidak penting. */
function pop(sheet: Sheet) {
  sheet.pushed = false
  ownPops++
  history.back()
}

function leave(router: Router) {
  clearTimeout(leaveTimer)
  const target = leaving
  leaving = null
  if (target) void router.push(target)
}

function install(router: Router) {
  if (installed) return
  installed = true
  window.addEventListener('popstate', () => {
    if (ownPops) {
      ownPops--
      if (!ownPops) leave(router)
      return
    }
    const top = topSheet()
    if (!top) return
    top.pushed = false
    if (top.close() === false) push(top)
  })
  // Pindah ke halaman lain selagi ada lembar terbuka (atau entrinya sedang diambil): pindahnya
  // ditunda sampai semua entri tambahan diambil, supaya Back dari halaman tujuan tidak mendarat
  // di entri kosong. Menunggu di dalam guard tidak bisa, karena popstate membatalkan navigasi
  // yang sedang berjalan.
  router.beforeEach((to, from) => {
    if (to.path === from.path) return true
    const open = sheets.filter((sheet) => sheet.pushed)
    if (!open.length && !ownPops) return true
    for (const sheet of open) sheet.pushed = false
    leaving = to.fullPath
    if (open.length) {
      ownPops++
      history.go(-open.length)
    }
    // Jaga-jaga kalau popstate-nya tidak pernah datang: user tidak boleh tertahan di sini.
    clearTimeout(leaveTimer)
    leaveTimer = setTimeout(() => {
      ownPops = 0
      leave(router)
    }, 600)
    return false
  })
}

/**
 * Tombol Back di HP menutup lembar layar penuh, bukan meninggalkan halaman. Selama `active`, ada
 * satu entri riwayat tambahan di URL yang sama; Back mengambil entri itu lalu memanggil `close`
 * milik lembar yang paling atas. Kalau `close` mengembalikan `false` (misalnya user batal membuang
 * hasil yang belum disimpan), entrinya dipasang lagi dan lembarnya tetap terbuka. Lembar yang
 * ditutup dengan cara lain mengambil entrinya sendiri, dan pindah halaman tetap berjalan.
 */
export function useBackToClose(active: MaybeRefOrGetter<boolean>, close: () => unknown): void {
  if (import.meta.server) return
  install(useRouter())
  const sheet: Sheet = { close, pushed: false }
  sheets.push(sheet)

  onMounted(() => {
    watch(
      () => toValue(active),
      (on) => {
        if (on && !sheet.pushed) push(sheet)
        else if (!on && sheet.pushed) pop(sheet)
      },
      { immediate: true },
    )
  })

  onBeforeUnmount(() => {
    if (sheet.pushed) pop(sheet)
    sheets.splice(sheets.indexOf(sheet), 1)
  })
}
