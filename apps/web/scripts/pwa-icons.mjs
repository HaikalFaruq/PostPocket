// Ikon aplikasi untuk PWA dan layar utama iPhone, dari amplop favicon. SVG-nya disusun di sini
// lalu dirender ke PNG dengan Chromium milik Playwright, jadi hasilnya selalu sama.
//
//   node scripts/pwa-icons.mjs

import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

// Sama dengan --color-canvas dan --color-ink di main.css, serta emas di favicon.svg.
const canvas = '#f5f5f3'
const ink = '#111114'
const gold = '#d9b45a'

/** Amplop favicon (kotak 32) selebar `width` kali ukuran ikon, di tengah. */
function envelope(size, width) {
  const scale = (width * size) / 26
  const x = size / 2 - 16 * scale
  const y = size / 2 - 16.5 * scale
  return (
    `<g transform="translate(${x} ${y}) scale(${scale})">` +
    `<rect x="3" y="7" width="26" height="19" rx="4" fill="${ink}"/>` +
    `<path d="M4.5 10.5 16 18l11.5-7.5" fill="none" stroke="${gold}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>`
  )
}

function icon({ size, width, radius = 0 }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${radius * size}" fill="${canvas}"/>` +
    envelope(size, width) +
    `</svg>`
  )
}

const icons = [
  // Ikon biasa dipakai apa adanya, misalnya di desktop, jadi sudutnya dibulatkan sendiri.
  { file: 'pwa-192x192.png', size: 192, width: 0.6, radius: 0.22 },
  { file: 'pwa-512x512.png', size: 512, width: 0.6, radius: 0.22 },
  // Maskable dipotong launcher Android; amplop harus muat di lingkaran aman 80%.
  { file: 'maskable-icon-512x512.png', size: 512, width: 0.56 },
  // iOS membulatkan sudut sendiri dan mengganti bagian transparan dengan hitam.
  { file: 'apple-touch-icon-180x180.png', size: 180, width: 0.6 },
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const item of icons) {
  await page.setViewportSize({ width: item.size, height: item.size })
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${icon(item)}`,
  )
  const path = fileURLToPath(new URL(`../public/${item.file}`, import.meta.url))
  await page.locator('svg').screenshot({ path, omitBackground: true })
  console.log(item.file)
}
await browser.close()
