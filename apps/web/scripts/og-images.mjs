// Gambar OG bawaan (JPEG 1200×630, di bawah 300 KB supaya tampil di WhatsApp):
// - og-surat.jpg: halaman penerima, kalau gambar OG suratnya sudah dihapus bersama cover;
// - og-beranda.jpg: link Beranda;
// - og-kotak.jpg dan og-titip.jpg: link buka dan link titip kotak bareng, dengan folder kaca.
// Disusun dengan HTML dari ilustrasi dan warna foil emas milik sendiri, lalu dirender Chromium
// milik Playwright, di kanvas berkisi titik seperti Beranda, dengan huruf Gantari dan kata "surat"
// dalam Delicious Handrawn (docs/desain.md). Fontnya diambil dari Google Fonts saat skrip jalan.
//
//   node scripts/og-images.mjs                 # semua gambar
//   node scripts/og-images.mjs og-kotak.jpg    # hanya gambar tertentu

import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { brandLockupSvg } from '../app/utils/brand-logo.ts'

const publicFile = (path) => fileURLToPath(new URL(`../public/${path}`, import.meta.url))
const svg = (path) =>
  `data:image/svg+xml;base64,${readFileSync(publicFile(path)).toString('base64')}`
// Lockup logo (app/utils/brand-logo.ts): P-amplop dan wordmark yang sudah jadi garis.
const logo = `data:image/svg+xml;base64,${Buffer.from(brandLockupSvg()).toString('base64')}`

// Sama dengan --color-canvas, --color-ink, kertas krem, dan foil emas di preset.
const canvas = '#f1f4f8'
const ink = '#18204a'
const paper = '#f2eadb'
const gold = { shade: '#6f5112', base: '#c9a227', light: '#fff1b8' }

const variants = [
  { file: 'og-surat.jpg', title: 'Ada surat untukmu.', note: 'Ketuk kartunya untuk membuka.' },
  {
    file: 'og-beranda.jpg',
    title: 'Kenangan kecil, dikirim jadi surat.',
    note: 'Kartu foil 3D lewat satu link.',
  },
  {
    file: 'og-kotak.jpg',
    title: 'Ada kotak surat untukmu.',
    note: 'Isinya surat dari teman-temanmu.',
    visual: 'folder',
  },
  {
    file: 'og-titip.jpg',
    title: 'Titip surat untuk dia.',
    note: 'Tulis kartu foil, masuk ke satu kotak.',
    visual: 'folder',
  },
]

// Seni par avion di panel belakang folder kaca (packages/presets/kotak.json), sebagai gradien.
const parAvion =
  'linear-gradient(125deg, #f4f6fb 6%, #d9e1f1 18%, #e23b3b 34%, #7a1f2b 44%, #18204a 58%, #4d6bb3 76%, #eef2fa 94%)'

/** Folder kaca: panel belakang bercorak, tiga lembar surat, dan kaca buram di depan. */
function folder() {
  const sheet = (rotate, left, top, fill) =>
    `<div class="sheet-card" style="left:${left}px;top:${top}px;transform:rotate(${rotate}deg);background:${fill}"></div>`
  const meadow = `${paper} url(${svg('illustrations/meadow.svg')}) center 30% / cover`
  return `<div class="folder">
    <div class="folder-back"></div>
    ${sheet(-8, 26, 66, '#ffffff')}
    ${sheet(5, 96, 52, '#f6e3e3')}
    ${sheet(-2, 62, 84, meadow)}
    <div class="folder-front"><span>Untukmu</span><small>12 surat</small></div>
  </div>`
}

function page({ title, note, visual }) {
  const metal = `linear-gradient(115deg, ${gold.shade} 0%, ${gold.base} 22%, ${gold.light} 40%, ${gold.base} 58%, ${gold.shade} 78%, ${gold.base} 100%)`
  const mask = svg('illustrations/meadow-foil.svg')
  return `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Gantari:wght@500;700&family=Delicious+Handrawn&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden; box-sizing: border-box;
    background: ${canvas}; color: ${ink}; font-family: 'Gantari', sans-serif;
  }
  .sheet {
    position: relative; height: 100%; display: grid; grid-template-columns: 1fr 470px;
    align-items: center;
  }
  /* Kisi titik Hairline di belakang kartu, memudar ke tepi, sama dengan panggung di Beranda. */
  .sheet::before {
    content: ''; position: absolute; top: 40px; bottom: 40px; right: 10px; width: 560px;
    background-image: radial-gradient(circle, rgb(24 32 74 / 0.16) 1.3px, transparent 1.8px),
      radial-gradient(circle, rgb(24 32 74 / 0.16) 1.3px, transparent 1.8px);
    background-position: 0 0, 12px 6px; background-size: 24px 12px;
    -webkit-mask-image: radial-gradient(closest-side, #000 35%, transparent);
    mask-image: radial-gradient(closest-side, #000 35%, transparent);
  }
  .sheet > * { position: relative; }
  .copy { padding-left: 96px; }
  .hand { font-family: 'Delicious Handrawn', cursive; font-size: 1.16em; font-weight: 400; letter-spacing: normal; line-height: 1; }
  .brand { display: flex; }
  .brand img { height: 52px; width: auto; }
  h1 { margin: 40px 0 0; max-width: 580px; font-size: 70px; line-height: 0.98; font-weight: 700; letter-spacing: -0.035em; text-wrap: balance; }
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
  .folder { position: relative; width: 396px; height: 322px; margin-left: 4px; transform: rotate(-4deg); }
  .folder-back {
    position: absolute; inset: 0; border-radius: 28px; background: ${parAvion};
    clip-path: polygon(0 13%, 40% 13%, 47% 0, 100% 0, 100% 100%, 0 100%);
    box-shadow: 0 34px 60px -24px rgb(17 17 20 / 0.5);
  }
  .sheet-card {
    position: absolute; width: 276px; height: 194px; border-radius: 16px;
    box-shadow: 0 10px 26px -8px rgb(24 32 74 / 0.4), 0 0 0 1px rgb(24 32 74 / 0.06);
  }
  .folder-front {
    position: absolute; left: 0; right: 0; bottom: 0; height: 176px; border-radius: 28px;
    background: linear-gradient(180deg, rgb(255 255 255 / 0.72), rgb(252 252 253 / 0.98) 64%);
    box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.95), 0 30px 50px -26px rgb(24 32 74 / 0.45);
    display: flex; flex-direction: column; justify-content: flex-end; padding: 0 0 30px 32px;
  }
  .folder-front span { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; }
  .folder-front small { margin-top: 6px; font-size: 22px; font-weight: 500; color: rgb(24 32 74 / 0.66); }
</style></head><body><div class="sheet">
  <div class="copy">
    <div class="brand"><img src="${logo}" alt="PostPocket"></div>
    <h1>${title.replace('surat', '<span class="hand">surat</span>')}</h1>
    <p>${note}</p>
  </div>
  ${
    visual === 'folder'
      ? folder()
      : `<div class="card"><img src="${svg('illustrations/meadow.svg')}" alt=""><div class="foil"></div></div>`
  }
</div></body></html>`
}

const browser = await chromium.launch()
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
const only = process.argv.slice(2)
for (const variant of variants.filter((item) => !only.length || only.includes(item.file))) {
  await tab.setContent(page(variant), { waitUntil: 'networkidle' })
  await tab.evaluate(() => document.fonts.ready)
  const path = publicFile(variant.file)
  await tab.screenshot({ path, type: 'jpeg', quality: 86 })
  const size = statSync(path).size
  if (size > 300_000) throw new Error(`${variant.file} ${size} byte, lebih dari 300 KB`)
  console.log(variant.file, `${(size / 1024).toFixed(0)} KB`)
}
await browser.close()
