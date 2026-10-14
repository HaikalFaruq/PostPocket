import { defineConfig, devices } from '@playwright/test'

// Sinkron Pocket (e2e/sinkron.spec.ts) jalan ke stack Supabase lokal kalau SYNC_E2E=1, dengan
// API_URL, PUBLISHABLE_KEY, dan SECRET_KEY dari `supabase status -o env`. Port-nya sendiri, supaya
// server E2E biasa (tanpa Supabase) tidak terpakai ulang.
const syncE2E = process.env.SYNC_E2E === '1'
const port = syncE2E ? 4321 : 4320

// Gerbang Sprint 2 (e2e/live.spec.ts) jalan ke situs asli kalau LIVE_BASE_URL diisi, misalnya
// https://postpocket.vercel.app. Tanpa itu, semua tes memakai build lokal dan mock API.
const live = process.env.LIVE_BASE_URL
// Tiap run live menyimpan hasilnya di folder sendiri, supaya trace run yang gagal tidak dihapus
// run berikutnya. Nilainya diwariskan ke worker lewat env, jadi semua worker memakai folder sama.
if (live) process.env.LIVE_RUN ??= new Date().toISOString().replace(/[:.]/g, '-')

// Kamera palsu Chromium untuk uji Booth. WebKit tidak punya, jadi di sana diuji jalur tanpa kamera.
const fakeCamera = {
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
}

export default defineConfig({
  testDir: 'e2e',
  ...(live
    ? { testMatch: '**/live.spec.ts', outputDir: `test-results/live-${process.env.LIVE_RUN}` }
    : syncE2E
      ? { testMatch: '**/sinkron.spec.ts', outputDir: 'test-results/sinkron' }
      : { testIgnore: ['**/live.spec.ts', '**/sinkron.spec.ts'] }),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: live ?? `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    // Service worker hanya dinyalakan di e2e/pwa.spec.ts, supaya tes lain tidak memakai cache.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'], launchOptions: fakeCamera } },
    // WebKit di CI menggambar tanpa GPU, jadi tes Pocket di sini 15–30 detik, mepet batas bawaan
    // 30 detik. Batasnya dilonggarkan supaya CI yang sedang lambat tidak menggagalkan tes.
    { name: 'iphone', use: { ...devices['iPhone 15'] }, timeout: 60_000 },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: fakeCamera,
      },
    },
  ],
  // E2E selalu jalan di build production, sama seperti yang nanti di-deploy.
  webServer: live
    ? undefined
    : {
        command: `pnpm build && node .output/server/index.mjs`,
        // E2E memakai mock API surat (server/routes/mock-api), bukan Supabase sungguhan. Tanpa
        // URL Supabase, cadangan Pocket mati; SYNC_E2E mengarahkannya ke stack lokal.
        env: {
          NITRO_PORT: String(port),
          NITRO_HOST: '127.0.0.1',
          NUXT_MOCK_API: '1',
          NUXT_PUBLIC_API_BASE: '/mock-api',
          NUXT_PUBLIC_SUPABASE_URL: syncE2E ? (process.env.API_URL ?? '') : '',
          NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: syncE2E ? (process.env.PUBLISHABLE_KEY ?? '') : '',
        },
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
})
