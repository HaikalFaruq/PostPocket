import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-10',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/fonts', '@pinia/nuxt', '@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],

  // Komponen bersama dipanggil dengan nama dari PRD: <StepCard>, <PillGroup>, dst.
  components: [{ path: '~/components', pathPrefix: false }],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: { include: ['reka-ui'] },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'PostPocket',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#f5f5f3' },
        {
          name: 'description',
          content: 'Tangkap momen, simpan per hari, kirim sebagai surat foil 3D.',
        },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'Caveat', provider: 'google', weights: [400, 500, 600] },
      { name: 'VT323', provider: 'google', weights: [400] },
    ],
  },

  runtimeConfig: {
    // Mock API surat di /mock-api untuk development dan E2E (NUXT_MOCK_API=1). Mati di produksi.
    mockApi: false,
    public: {
      // Diisi dari .env (lihat .env.example). Secret key Supabase tidak pernah dipakai di sini.
      supabaseUrl: '',
      supabasePublishableKey: '',
      // Kosong berarti fungsi Supabase (<supabaseUrl>/functions/v1); `/mock-api` untuk mock.
      apiBase: '',
    },
  },

  routeRules: {
    // Halaman lab hanya alat uji: tidak perlu SSR dan tidak boleh diindeks.
    '/lab/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    // Editor surat bekerja dengan draf di IndexedDB, jadi cukup dirender di browser.
    '/letter/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    // TV, Booth, dan Pocket membaca data dari IndexedDB dan kamera, jadi cukup di browser.
    '/tv': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    '/pocket': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    '/pocket/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    // Surat penerima di-SSR supaya meta OG terbaca crawler WhatsApp, tapi tidak boleh diindeks.
    '/l/**': { headers: { 'X-Robots-Tag': 'noindex' } },
  },
})
