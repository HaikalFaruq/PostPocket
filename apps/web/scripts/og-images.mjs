// Gambar OG bawaan (JPEG 1200×630, di bawah 300 KB supaya tampil di WhatsApp):
// - og-surat.jpg: halaman penerima, kalau gambar OG suratnya sudah dihapus bersama cover;
// - og-beranda.jpg: link Beranda.
// Disusun dengan HTML dari ilustrasi dan warna foil emas milik sendiri, lalu dirender Chromium
// milik Playwright, dengan bingkai par avion dan huruf Gantari (docs/desain.md). Fontnya diambil
// dari Google Fonts saat skrip jalan.
//
//   node scripts/og-images.mjs

import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const publicFile = (path) => fileURLToPath(new URL(`../public/${path}`, import.meta.url))
const svg = (path) =>
  `data:image/svg+xml;base64,${readFileSync(publicFile(path)).toString('base64')}`

// Sama dengan --color-canvas, --color-ink, --color-post-red, kertas krem, dan foil emas di preset.
const canvas = '#f1f4f8'
const ink = '#18204a'
const red = '#e23b3b'
const paper = '#f2eadb'
const gold = { shade: '#6f5112', base: '#c9a227', light: '#fff1b8' }

const variants = [
  { file: 'og-surat.jpg', title: 'Ada surat untukmu.', note: 'Ketuk kartunya untuk membuka.' },
  {
    file: 'og-beranda.jpg',
    title: 'Kenangan kecil, dikirim jadi surat.',
    note: 'Kartu foil 3D lewat satu link.',
  },
]

function page({ title, note }) {
  const metal = `linear-gradient(115deg, ${gold.shade} 0%, ${gold.base} 22%, ${gold.light} 40%, ${gold.base} 58%, ${gold.shade} 78%, ${gold.base} 100%)`
  const mask = svg('illustrations/meadow-foil.svg')
  return `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Gantari:wght@500;700&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden; box-sizing: border-box; padding: 26px;
    background: repeating-linear-gradient(-45deg, ${red} 0 24px, #fff 24px 36px, ${ink} 36px 60px, #fff 60px 72px);
    color: ${ink}; font-family: 'Gantari', sans-serif;
  }
  .sheet {
    height: 100%; display: grid; grid-template-columns: 1fr 440px; align-items: center;
    background: ${canvas};
  }
  .copy { padding-left: 74px; }
  .brand { display: flex; align-items: center; gap: 16px; font-size: 34px; font-weight: 700; letter-spacing: -0.03em; }
  .brand img { width: 56px; height: 56px; }
  h1 { margin: 40px 0 0; max-width: 580px; font-size: 70px; line-height: 0.98; font-weight: 700; letter-spacing: -0.035em; }
  p { margin: 22px 0 0; font-size: 30px; font-weight: 500; color: rgb(24 32 74 / 0.66); }
  .card {
    position: relative; width: 318px; height: 442px; border-radius: 5px; overflow: hidden;
    background: ${paper}; transform: rotate(-6deg);
    box-shadow: 0 34px 60px -24px rgb(17 17 20 / 0.5), 0 0 0 1px rgb(17 17 20 / 0.06);
  }
  .card img, .foil { position: absolute; inset: 0; width: 100%; height: 100%; }
  .card img { object-fit: cover; }
  .foil {
    background: ${metal};
    -webkit-mask: url(${mask}) center / cover no-repeat;
    mask: url(${mask}) center / cover no-repeat;
  }
</style></head><body><div class="sheet">
  <div class="copy">
    <div class="brand"><img src="${svg('favicon.svg')}" alt="">PostPocket</div>
    <h1>${title}</h1>
    <p>${note}</p>
  </div>
  <div class="card"><img src="${svg('illustrations/meadow.svg')}" alt=""><div class="foil"></div></div>
</div></body></html>`
}

const browser = await chromium.launch()
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
for (const variant of variants) {
  await tab.setContent(page(variant), { waitUntil: 'networkidle' })
  await tab.evaluate(() => document.fonts.ready)
  const path = publicFile(variant.file)
  await tab.screenshot({ path, type: 'jpeg', quality: 86 })
  const size = statSync(path).size
  if (size > 300_000) throw new Error(`${variant.file} ${size} byte, lebih dari 300 KB`)
  console.log(variant.file, `${(size / 1024).toFixed(0)} KB`)
}
await browser.close()
