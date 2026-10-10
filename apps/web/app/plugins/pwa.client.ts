import { requestPersistentStorage, warmPages } from '~/utils/pwa'

/**
 * Pelengkap @vite-pwa/nuxt: aplikasi yang dibuka dari layar utama meminta penyimpanan
 * permanen, dan begitu service worker aktif, Beranda serta halaman yang sedang dibuka
 * disimpan supaya bisa dibuka lagi tanpa sinyal.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) requestPersistentStorage()
  window.addEventListener('appinstalled', () => requestPersistentStorage())

  nuxtApp.hook('service-worker:activated', () => {
    warmPages(['/', window.location.pathname])
  })
})
