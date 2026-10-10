import { defineConfig, devices } from '@playwright/test'

const port = 4320

// Kamera palsu Chromium untuk uji Booth. WebKit tidak punya, jadi di sana diuji jalur tanpa kamera.
const fakeCamera = {
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'], launchOptions: fakeCamera } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
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
  webServer: {
    command: `pnpm build && node .output/server/index.mjs`,
    // E2E memakai mock API surat (server/routes/mock-api), bukan Supabase sungguhan.
    env: {
      NITRO_PORT: String(port),
      NITRO_HOST: '127.0.0.1',
      NUXT_MOCK_API: '1',
      NUXT_PUBLIC_API_BASE: '/mock-api',
    },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
