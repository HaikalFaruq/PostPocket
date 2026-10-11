// Stiker isi surat dari Microsoft Fluent Emoji 3D (MIT). Diunduh dari commit yang dikunci,
// lalu diperkecil ke WebP 192 px dengan Chromium milik Playwright supaya halaman penerima
// tetap ringan. Daftar id dan label ada di packages/presets/letter.json (`stickers`).
//
//   node scripts/stickers.mjs            semua stiker
//   node scripts/stickers.mjs dog cat    hanya stiker tertentu, supaya berkas lain tidak berubah

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const COMMIT = '1ffb34c752ecf5d402f04cfb4b392c77f57c54bc'
const SIZE = 192

/** Nama aset di repo fluentui-emoji untuk tiap id stiker. */
const sources = {
  heart: 'Red heart',
  'smiling-face': 'Smiling face with hearts',
  sparkles: 'Sparkles',
  star: 'Glowing star',
  'cherry-blossom': 'Cherry blossom',
  tulip: 'Tulip',
  sunflower: 'Sunflower',
  ribbon: 'Ribbon',
  gift: 'Wrapped gift',
  balloon: 'Balloon',
  party: 'Party popper',
  cake: 'Birthday cake',
  rainbow: 'Rainbow',
  cloud: 'Cloud',
  moon: 'Crescent moon',
  cat: 'Cat face',
  bear: 'Teddy bear',
  dog: 'Dog face',
  'love-letter': 'Love letter',
  clover: 'Four leaf clover',
  strawberry: 'Strawberry',
}

const presets = JSON.parse(
  readFileSync(new URL('../../../packages/presets/letter.json', import.meta.url), 'utf8'),
)
const outDir = fileURLToPath(new URL('../public/stickers/', import.meta.url))
mkdirSync(outDir, { recursive: true })

const only = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage()
for (const { id } of presets.stickers) {
  if (only.length && !only.includes(id)) continue
  const name = sources[id]
  if (!name) throw new Error(`Sumber stiker "${id}" belum ada di scripts/stickers.mjs`)
  const file = `${name.toLowerCase().replaceAll(' ', '_')}_3d.png`
  const url = `https://raw.githubusercontent.com/microsoft/fluentui-emoji/${COMMIT}/assets/${encodeURIComponent(name)}/3D/${file}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${id}: ${response.status} ${url}`)
  const png = Buffer.from(await response.arrayBuffer()).toString('base64')
  const webp = await page.evaluate(
    async ({ png, size }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, 0, 0, size, size)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
      return Array.from(new Uint8Array(await blob.arrayBuffer()))
    },
    { png, size: SIZE },
  )
  writeFileSync(`${outDir}${id}.webp`, Buffer.from(webp))
  console.log(`${id}.webp`, `${(webp.length / 1024).toFixed(1)} KB`)
}
await browser.close()
