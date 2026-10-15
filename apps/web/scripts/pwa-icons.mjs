// Ikon aplikasi untuk PWA dan layar utama iPhone: P-amplop di latar kanvas Beranda, dari
// app/utils/brand-logo.ts (docs/desain.md bagian Logo). SVG-nya dirender ke PNG dengan Chromium
// milik Playwright, jadi hasilnya selalu sama.
//
//   node scripts/pwa-icons.mjs

import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { brandIconSvg } from '../app/utils/brand-logo.ts'

const icons = [
  // Ikon biasa dipakai apa adanya, misalnya di desktop, jadi sudutnya dibulatkan sendiri.
  { file: 'pwa-192x192.png', size: 192, radius: 0.22 },
  { file: 'pwa-512x512.png', size: 512, radius: 0.22 },
  // Maskable dipotong launcher Android; P harus muat di lingkaran aman 80%.
  { file: 'maskable-icon-512x512.png', size: 512, fill: 0.54 },
  // iOS membulatkan sudut sendiri dan mengganti bagian transparan dengan hitam.
  { file: 'apple-touch-icon-180x180.png', size: 180 },
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const { file, size, ...options } of icons) {
  await page.setViewportSize({ width: size, height: size })
  const markup = brandIconSvg(size, options).replace(
    '<svg ',
    `<svg width="${size}" height="${size}" `,
  )
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`,
  )
  const path = fileURLToPath(new URL(`../public/${file}`, import.meta.url))
  await page.locator('svg').screenshot({ path, omitBackground: true })
  console.log(file)
}
await browser.close()
