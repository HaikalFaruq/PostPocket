import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { splashScript } from './app/utils/splash'

// Versi rilis dari package.json, ditulis bersama commit yang di-deploy, misalnya "1.0.0 (1abb127)".
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Header keamanan untuk semua halaman dan aset (docs/frontend.md, Keamanan): tidak boleh dibingkai
// situs lain, jenis berkas tidak ditebak, alamat lengkap tidak dikirim ke situs lain, dan hanya
// kamera (Booth) yang boleh dipakai.
const securityHeaders = {
  'Content-Security-Policy':
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-10',
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
    // Alat uji: halaman /lab (komponen bersama, kartu foil, cek Safari, alur kirim) dan mock API
    // di server/ (beserta kontraknya). Ada di `pnpm dev` dan build E2E dengan mock API, tapi tidak
    // ikut build produksi, jadi di sana 404.
    (_options, nuxt) => {
      if (nuxt.options.dev || process.env.NUXT_MOCK_API === '1') {
        // Tidak perlu SSR dan tidak boleh diindeks.
        nuxt.options.routeRules = {
          ...nuxt.options.routeRules,
          '/lab/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
        }
        return
      }
      nuxt.hook('pages:extend', (pages) => {
        for (let i = pages.length - 1; i >= 0; i--) {
          if (pages[i]!.path.startsWith('/lab')) pages.splice(i, 1)
        }
      })
      const nitro = nuxt.options.nitro
      nitro.ignore = [...(nitro.ignore ?? []), 'routes/mock-api/**']
      nitro.serverAssets = nitro.serverAssets?.filter((asset) => asset?.baseName !== 'contract')
    },
  ],
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
      // Memutuskan splash (app/utils/splash.ts) sebelum halaman tergambar.
      script: [{ innerHTML: splashScript, tagPosition: 'head', tagPriority: 'critical' }],
    },
  },

  fonts: {
    // Huruf Latin saja (Indonesia dan nama berhuruf aksen). Tanpa ini setiap ketebalan ikut
    // membawa @font-face Cyrillic, Yunani, dan Vietnam, dan CSS awal yang memblokir render jadi
    // sepertiganya deklarasi font.
    // Font cadangan diukur sama dengan Arial (iPhone, desktop) atau Roboto (Android), supaya teks
    // tidak melompat saat font aslinya selesai dimuat.
    defaults: {
      subsets: ['latin', 'latin-ext'],
      fallbacks: {
        'sans-serif': ['Arial', 'Roboto'],
        'ui-sans-serif': ['Arial', 'Roboto'],
        cursive: ['Arial', 'Roboto'],
      },
    },
    priority: ['google'],
    families: [
      // Huruf antarmuka (docs/desain.md): Gantari dari Lafontype, foundry di Makassar. Variabel,
      // jadi satu berkas latin untuk semua ketebalan, dan di-preload karena dipakai di layar
      // pertama. Sengaja tanpa `provider`: dengan provider, font cadangan di atas diganti kategori
      // Google-nya (`sans-serif`) yang tidak punya ukuran.
      {
        name: 'Gantari',
        weights: [400, 500, 600, 700],
        subsets: ['latin'],
        preload: true,
      },
      // Isi surat: tulisan tangan Agung Rohmat (docs/desain.md). Satu ketebalan saja.
      { name: 'Delicious Handrawn', provider: 'google', weights: [400] },
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
      // setelah sekali dipakai, aturan /_nuxt/ di bawah tetap menyimpannya untuk offline. Gambar
      // kerumunan Beranda (178 KB) hanya hiasan dan baru dimuat saat footer didekati. Ilustrasi
      // kartu untuk bentuk Tegak, Persegi, dan Mendatar (sekitar 800 KB) disimpan saat dipakai
      // (aturan /illustrations/ di bawah); yang ikut precache hanya bentuk Asli.
      globIgnores: [
        'peeps/**',
        '**/heic.worker-*.js',
        'illustrations/*-{portrait,square,landscape}.svg',
        'illustrations/*-{portrait,square,landscape}-foil.svg',
      ],
      runtimeCaching: [
        {
          // Halaman: jaringan dulu, salinan terakhir kalau offline. Surat penerima (/l/…),
          // kotak bareng penerima (/k/…), dan halaman titip (/titip/…) isinya pribadi, jadi tidak
          // pernah disimpan.
          urlPattern: ({ request, url }) =>
            request.mode === 'navigate' && !/^\/(l|k|titip)(\/|$)/.test(url.pathname),
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
          // Ilustrasi kartu yang tidak ikut precache: langsung dari cache, lalu diperbarui di
          // belakang, karena nama berkasnya tetap saat desainnya diperbarui.
          urlPattern: ({ url, sameOrigin }) =>
            sameOrigin && url.pathname.startsWith('/illustrations/'),
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'illustrations',
            expiration: { maxEntries: 48 },
            cacheableResponse: { statuses: [200] },
          },
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
    // Di Vercel, header routeRules ditulis ke config tanpa `continue`, jadi berkas statis yang
    // punya aturan lebih spesifik (aset /_nuxt/, manifest dan service worker PWA) tidak ikut
    // mendapat header '/**'. Rute pertama ini memasangnya ke semua jalur lalu meneruskan routing.
    vercel: {
      config: {
        // Tipe rute di Nitro hanya mengenal header cache-control, padahal Vercel menerima header
        // apa pun.
        routes: [{ src: '/(.*)', headers: securityHeaders, continue: true } as never],
      },
    },
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
      // Kanal "Lapor masalah"; `{pesan}` diganti isi laporan. Kosong berarti GitHub
      // Issues repo ini (lihat utils/feedback.ts dan .env.example).
      feedbackUrl: '',
      // Versi yang ditulis di footer dan laporan masalah: rilis dan commit yang di-deploy.
      appVersion: `${version} (${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'lokal'})`,
      // Kotak bareng (kontrak 0.3.0). Menyala di produksi lewat env Vercel sejak Edge Function
      // `boxes` dan `k` ter-deploy. Mati: halamannya 404 dan pintu masuknya disembunyikan. E2E dan mock
      // menyalakannya dengan NUXT_PUBLIC_KOTAK_BARENG=1.
      kotakBareng: false,
    },
  },

  routeRules: {
    // Header keamanan untuk halaman yang dirender server dan berkas statis di server Node (E2E).
    '/**': { headers: securityHeaders },
    // Editor surat bekerja dengan draf di IndexedDB, jadi cukup dirender di browser.
    '/letter/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    // TV, Booth, dan Pocket membaca data dari IndexedDB dan kamera, jadi cukup di browser.
    '/tv': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    '/pocket': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    '/pocket/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    // Kotak surat membaca surat tersimpan dari IndexedDB, jadi cukup di browser.
    '/kotak': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    '/kotak/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    // Surat penerima di-SSR supaya meta OG terbaca crawler WhatsApp, tapi tidak boleh diindeks.
    '/l/**': { headers: { 'X-Robots-Tag': 'noindex' } },
    // Sama untuk kotak bareng: link buka penerima dan link titip teman-teman.
    '/k/**': { headers: { 'X-Robots-Tag': 'noindex' } },
    '/titip/**': { headers: { 'X-Robots-Tag': 'noindex' } },
  },
})
