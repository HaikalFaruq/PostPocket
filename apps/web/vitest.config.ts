import { defineConfig } from 'vitest/config'

// Unit test untuk logika murni di app/utils. Perilaku halaman diuji Playwright di e2e/.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
