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
        { name: 'apple-mobile-web-app-title', content: 'PostPocket' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
      ],
    },
  },

  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700] },
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
      background_color: '#f5f5f3',
      theme_color: '#f5f5f3',
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
      globPatterns: ['**/*.{js,css,svg,png}', 'offline.html'],
      globIgnores: ['samples/**'],
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

  runtimeConfig: {
    public: {
      // Diisi dari .env (lihat .env.example). Secret key Supabase tidak pernah dipakai di sini.
      supabaseUrl: '',
      supabasePublishableKey: '',
    },
  },

  routeRules: {
    // Halaman lab hanya alat uji: tidak perlu SSR dan tidak boleh diindeks.
    '/lab/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    // Editor surat bekerja dengan draf di IndexedDB, jadi cukup dirender di browser.
    '/letter/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
  },
})
