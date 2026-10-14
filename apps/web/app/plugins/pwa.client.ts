import { requestPersistentStorage, warmPages } from '~/utils/pwa'

/**
 * Pelengkap @vite-pwa/nuxt: aplikasi yang dibuka dari layar utama meminta penyimpanan
 * permanen, dan begitu service worker aktif, Beranda, editor surat, Pocket, TV, dan halaman yang
 * sedang dibuka disimpan supaya bisa dibuka lagi tanpa sinyal.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) requestPersistentStorage()
  window.addEventListener('appinstalled', () => requestPersistentStorage())

  // Editor surat, Pocket, dan TV ikut disimpan: datanya di IndexedDB dan halamannya hanya
  // dirender di browser, jadi salinan halamannya tidak memuat data pribadi.
  nuxtApp.hook('service-worker:activated', () => {
    // Halaman galat (misalnya 404) tidak disimpan; menyimpannya hanya menghasilkan request gagal.
    const current = nuxtApp.payload.error ? [] : [window.location.pathname]
    warmPages(['/', '/letter/new', '/pocket', '/tv', '/kotak', ...current])
  })
})
