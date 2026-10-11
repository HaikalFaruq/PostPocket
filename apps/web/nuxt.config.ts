import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-10',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/fonts', '@pinia/nuxt', '@vueuse/nuxt', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],

  // Komponen bersama dipanggil dengan nama dari PRD: <StepCard>, <PillGroup>, dst.
  components: [{ path: '~/components', pathPrefix: false }],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: { include: ['reka-ui'] },
  },

  hooks: {
    // Worker HEIC berisi libheif (sekitar 2 MB). Tanpa ini, halaman yang memakai front-image.ts
    // (termasuk halaman surat penerima) ikut mem-preload-nya. Worker-nya cukup diunduh saat ada
    // foto HEIC yang tidak bisa dibuka browser (utils/heic.ts).
    'build:manifest'(manifest) {
      for (const entry of Object.values(manifest)) {
        entry.assets = entry.assets?.filter((file) => !file.includes('heic.worker'))
        if (entry.file.includes('heic.worker')) {
          entry.preload = false
          entry.prefetch = false
        }
      }
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'PostPocket',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#f1f4f8' },
        {
          name: 'description',
          content: 'Tangkap momen, simpan per hari, kirim sebagai surat foil 3D.',
        },
        { name: 'apple-mobile-web-app-title', content: 'PostPocket' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
      ],
    },
  },

  fonts: {
    // Huruf Latin saja (Indonesia dan nama berhuruf aksen). Tanpa ini setiap ketebalan Inter ikut
    // membawa @font-face Cyrillic, Yunani, dan Vietnam, dan CSS awal yang memblokir render jadi
    // sepertiganya deklarasi font.
    defaults: { subsets: ['latin', 'latin-ext'] },
    families: [
      { name: 'Bricolage Grotesque', provider: 'google', weights: [400, 500, 600, 700, 800] },
      { name: 'Caveat', provider: 'google', weights: [400, 500, 600] },
      { name: 'VT323', provider: 'google', weights: [400] },
    ],
  },

  // PWA: bisa dipasang ke layar utama dan tetap terbuka tanpa sinyal. Service worker hanya ada
  // di build production; `pnpm dev` tidak memakainya. Aturannya dijelaskan di docs/frontend.md.
  pwa: {
    registerType: 'prompt',
    registerWebManifestInRouteRules: true,
    client: { installPrompt: 'postpocket:install-hidden' },
    manifest: {
      id: '/',
      name: 'PostPocket',
      short_name: 'PostPocket',
      description: 'Tangkap momen, simpan per hari, kirim sebagai surat foil 3D.',
      lang: 'id',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#f1f4f8',
      theme_color: '#f1f4f8',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      // Aplikasi ini SSR, jadi tidak ada satu index.html yang bisa melayani semua halaman.
      navigateFallback: null,
      // Transform bawaan modul membuang `.html` dari URL (untuk situs statis), padahal server
      // ini hanya melayani `/offline.html`. Revisi berkas tetap dihitung Workbox.
      manifestTransforms: [],
      clientsClaim: true,
      // Stiker WebP ikut disimpan supaya kantong Pocket dan editor surat tetap lengkap offline.
      globPatterns: ['**/*.{js,css,svg,png,webp}', 'offline.html'],
      // Pengubah HEIC (sekitar 2 MB) hanya dipakai kalau ada foto HEIC, jadi tidak ikut precache;
      // setelah sekali dipakai, aturan /_nuxt/ di bawah tetap menyimpannya untuk offline.
      globIgnores: ['samples/**', '**/heic.worker-*.js'],
      runtimeCaching: [
        {
          // Halaman: jaringan dulu, salinan terakhir kalau offline. Surat penerima (/l/…)
          // isinya pribadi, jadi tidak pernah disimpan.
          urlPattern: ({ request, url }) =>
            request.mode === 'navigate' && !/^\/l(\/|$)/.test(url.pathname),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages',
            networkTimeoutSeconds: 4,
            expiration: { maxEntries: 24 },
            cacheableResponse: { statuses: [200] },
            matchOptions: { ignoreSearch: true, ignoreVary: true },
            precacheFallback: { fallbackURL: '/offline.html' },
          },
        },
        {
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkOnly',
          options: { precacheFallback: { fallbackURL: '/offline.html' } },
        },
        {
          // Font dari @nuxt/fonts: hanya subset yang benar-benar dipakai yang disimpan.
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/_fonts/'),
          handler: 'CacheFirst',
          options: { cacheName: 'fonts', expiration: { maxEntries: 40, maxAgeSeconds: 31536000 } },
        },
        {
          // Chunk dari versi lain yang tidak ada di precache, misalnya tab lama setelah deploy.
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/_nuxt/'),
          handler: 'CacheFirst',
          options: { cacheName: 'assets', expiration: { maxEntries: 80, maxAgeSeconds: 2592000 } },
        },
      ],
    },
  },

  nitro: {
    // Kontrak API untuk mock (server/utils/contract.ts), dibaca lewat useStorage('assets:contract').
    serverAssets: [
      { baseName: 'contract', dir: fileURLToPath(new URL('../../docs/api', import.meta.url)) },
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
      // Kanal "Lapor masalah" untuk tester; `{pesan}` diganti isi laporan. Kosong berarti GitHub
      // Issues repo ini (lihat utils/feedback.ts dan .env.example).
      feedbackUrl: '',
      // Versi yang ditulis di laporan: commit yang di-deploy Vercel, atau "lokal".
      appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'lokal',
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
