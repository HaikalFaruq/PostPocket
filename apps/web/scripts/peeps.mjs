// Lembar orang Open Peeps (Pablo Stanley, CC0) untuk kerumunan di Beranda. Diunduh dari aset
// pen zadvorsky yang dipakai Skiper 39 dan dicek hash-nya. Dari 105 orang diambil 36 (tanpa yang
// kausnya bertulisan), garis hitamnya diwarnai tinta PostPocket (#18204A, isinya tetap putih),
// diperkecil ke sel 180 × 243, lalu disimpan sebagai WebP 9 × 4 dengan Chromium milik
// Playwright, sama seperti scripts/stickers.mjs. Ukuran lembarnya dipakai CrowdStreet.vue.
//
//   node scripts/peeps.mjs

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const SOURCE = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/175711/open-peeps-sheet.png'
const SHA256 = 'abdb8990a7bef8c2f5af3e45f0a3c969c4b0603fba8be92e81347de4ea4e1ed7'
/** Lembar sumber 15 × 7, sel 240 × 324. */
const SRC_COLS = 15
const SRC_CELL = [240, 324]
/** Lembar hasil 9 × 4, sel 180 × 243: cukup tajam untuk orang setinggi ±150 px di layar 2×. */
const COLS = 9
const CELL = [180, 243]
/** Orang yang dipakai: sel bernomor genap di lembar sumber, kecuali 18 dan 70 (kaus bertulisan) dan 68 (petir). */
const PICK = Array.from({ length: 53 }, (_, i) => i * 2)
  .filter((i) => ![18, 68, 70].includes(i))
  .slice(0, COLS * 4)
const INK = [24, 32, 74]

const response = await fetch(SOURCE)
if (!response.ok) throw new Error(`${response.status} ${SOURCE}`)
const png = Buffer.from(await response.arrayBuffer())
const hash = createHash('sha256').update(png).digest('hex')
if (hash !== SHA256) throw new Error(`Hash lembar Open Peeps berubah: ${hash}`)

const browser = await chromium.launch()
const page = await browser.newPage()
const webp = await page.evaluate(
  async ({ png, pick, srcCols, srcCell, cols, cell, ink }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${png}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = cols * cell[0]
    canvas.height = Math.ceil(pick.length / cols) * cell[1]
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    pick.forEach((from, to) => {
      const [sx, sy] = [(from % srcCols) * srcCell[0], Math.floor(from / srcCols) * srcCell[1]]
      const [dx, dy] = [(to % cols) * cell[0], Math.floor(to / cols) * cell[1]]
      ctx.drawImage(image, sx, sy, srcCell[0], srcCell[1], dx, dy, cell[0], cell[1])
      // Sisa tangan orang di sel sebelahnya, yang kadang melewati batas sel.
      ctx.clearRect(dx, dy, 3, cell[1])
      ctx.clearRect(dx + cell[0] - 3, dy, 3, cell[1])
    })
    // Hitam jadi tinta, putih tetap putih, abu-abu tepi garis di antaranya.
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = pixels.data
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue
      const light = (d[i] + d[i + 1] + d[i + 2]) / 765
      for (let c = 0; c < 3; c++) d[i + c] = Math.round(ink[c] + (255 - ink[c]) * light)
    }
    ctx.putImageData(pixels, 0, 0)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  },
  {
    png: png.toString('base64'),
    pick: PICK,
    srcCols: SRC_COLS,
    srcCell: SRC_CELL,
    cols: COLS,
    cell: CELL,
    ink: INK,
  },
)
await browser.close()

const outDir = fileURLToPath(new URL('../public/peeps/', import.meta.url))
mkdirSync(outDir, { recursive: true })
writeFileSync(`${outDir}open-peeps.webp`, Buffer.from(webp))
console.log('open-peeps.webp', `${(webp.length / 1024).toFixed(1)} KB`)
