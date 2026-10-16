// Gambar promo README ala App Store (1320 x 2868): layar produksi asli di dalam bingkai iPhone 17
// yang digambar sendiri, di atas amplop bertutup emas, dengan judul Gantari dan satu kata tulisan
// tangan. Hasilnya docs/gambar/promo-*.webp.
//
//   node scripts/promo-readme.mjs [kata-kunci]
//
// Butuh Google Chrome (kartu foil butuh GPU) dan dependensi apps/web (`pnpm install`). Data contoh
// hanya masuk IndexedDB browser sementara; tidak ada surat yang dikirim ke server.

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const { chromium } = createRequire(join(REPO, 'apps/web/package.json'))('@playwright/test')
const BASE = process.env.PROMO_BASE_URL ?? 'https://postpocket.vercel.app'
const WORK = mkdtempSync(join(tmpdir(), 'postpocket-promo-'))
const OUT = join(REPO, 'docs/gambar')
const only = process.argv[2]

const promos = [
  {
    file: 'promo-1-beranda',
    screen: 'beranda',
    title: 'Kirim momenmu<br>jadi <span class="hand">surat</span> foil',
    sub: 'Kartu 3D yang bisa diputar dan dibuka.<br>Penerima cukup ketuk satu link.',
    tilt: -4,
    stickers: [{ name: 'love-letter', x: 1040, y: 1900, w: 240, r: 12 }],
    stamp: true,
  },
  {
    file: 'promo-2-surat-foil',
    screen: 'surat',
    title: 'Kartu foil,<br><span class="hand">desainmu sendiri</span>',
    sub: 'Lima desain siap pakai atau foto sendiri,<br>dengan enam warna foil dan kertas.',
    tilt: 4,
    stickers: [
      { name: 'balloon', x: 46, y: 1120, w: 240, r: -10 },
      { name: 'party', x: 1052, y: 1930, w: 230, r: 12 },
    ],
  },
  {
    file: 'promo-3-isi-surat',
    screen: 'isi-surat',
    title: 'Isi surat pakai<br><span class="hand">tulisan tangan</span>',
    sub: 'Tambah foto dan stiker. Isinya selalu rapi,<br>tidak ada yang saling menimpa.',
    tilt: -4,
    stickers: [
      { name: 'cake', x: 1046, y: 1080, w: 240, r: 9 },
      { name: 'heart', x: 46, y: 1820, w: 210, r: -12 },
    ],
  },
  {
    file: 'promo-4-pocket',
    screen: 'pocket',
    title: 'Satu kantong<br>untuk <span class="hand">setiap hari</span>',
    sub: 'Simpan foto tiap hari di kalender,<br>lalu putar album bulanannya di TV.',
    tilt: 4,
    stickers: [
      { name: 'strawberry', x: 52, y: 1180, w: 220, r: -10 },
      { name: 'sunflower', x: 1050, y: 1960, w: 240, r: 10 },
    ],
  },
]

const browser = await chromium.launch({ channel: 'chrome' })

// ---------- 1. Layar produksi: iPhone 17 (402 x 874 pt) tanpa status bar 62 pt, @3x ----------

const phone = await browser.newContext({
  viewport: { width: 402, height: 812 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
})
// Seperti HP sungguhan: bukan webdriver (jadi tidak masuk mode CPU), splash dilewati.
await phone.addInitScript(() => {
  Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
  try {
    sessionStorage.setItem('postpocket:splash', '1')
  } catch {}
})
const page = await phone.newPage()
page.on('dialog', (dialog) => dialog.accept())
await page.clock.setFixedTime(new Date('2026-10-16T10:00:00+07:00'))

const sample = `data:image/svg+xml;base64,${readFileSync(join(REPO, 'apps/web/app/assets/lab/contoh-foto.svg')).toString('base64')}`
/** Foto JPEG dari gambar contoh, dengan rona dan potongan berbeda supaya tampak seperti foto lain. */
async function photo(hue, zoom, width, height) {
  const base64 = await page.evaluate(
    async ([src, hue, zoom, width, height]) => {
      const image = new Image()
      image.src = src
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.filter = `hue-rotate(${hue}deg) saturate(1.1)`
      const scale = Math.max(width / image.width, height / image.height) * zoom
      const w = image.width * scale
      const h = image.height * scale
      ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h)
      return canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
    },
    [sample, hue, zoom, width, height],
  )
  return { name: `foto-${hue}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') }
}
const shot = (name) => page.screenshot({ path: join(WORK, `${name}.png`) })

await page.goto(`${BASE}/`)
await page.getByRole('button', { name: /Contoh surat/ }).waitFor()
await page.waitForTimeout(2500)
await shot('beranda')

// Editor dengan desain Ulang tahun; daftar opsinya punya scroll sendiri, jadi dikembalikan ke atas.
await page.goto(`${BASE}/letter/new`)
await page.locator('.foil-rotor').waitFor()
const designs = page.getByRole('radiogroup', { name: 'Gambar depan' })
await designs.getByRole('radio', { name: 'Ulang tahun' }).tap()
await designs.evaluate((element) => {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) node.scrollTop = 0
  }
  window.scrollTo(0, 0)
})
await page.waitForTimeout(2000)
await shot('surat')

// Editor isi surat: 1 foto + teks, stiker kue, dan baki stiker terbuka.
const editor = page.getByTestId('letter-editor')
await editor
  .getByRole('radiogroup', { name: 'Template isi surat' })
  .getByRole('radio', { name: '1 foto + teks' })
  .tap()
await page
  .getByRole('textbox', { name: 'Isi surat' })
  .fill(
    'Selamat ulang tahun, Rara!\nSemoga tahun ini penuh tawa, sehat terus, dan semua rencanamu jalan. Makasih udah jadi teman paling seru.\nPeluk dari Dinda',
  )
await page.getByTestId('open-content-editor').tap()
await page.getByTestId('content-photo-upload').setInputFiles(await photo(0, 1.15, 1200, 900))
await page.getByTestId('content-page').locator('[data-kind="photo"] img').waitFor()
const tools = page.getByTestId('content-editor')
await tools.getByRole('button', { name: 'Lepas pilihan' }).tap()
await tools.getByRole('button', { name: 'Stiker', exact: true }).tap()
await tools.getByRole('button', { name: 'Kue ulang tahun', exact: true }).tap()
await tools.getByRole('button', { name: 'Lepas pilihan' }).tap()
await tools.getByRole('button', { name: 'Stiker', exact: true }).tap()
await page.waitForTimeout(1500)
await shot('isi-surat')

// Pocket: empat hari terisi kantong berfoto.
await page.goto(`${BASE}/pocket`)
for (const [day, hue] of [
  ['2026-10-03', 0],
  ['2026-10-07', 200],
  ['2026-10-09', 120],
  ['2026-10-14', 260],
]) {
  await page.locator(`[data-day="${day}"]`).tap()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await page.getByTestId('moment-upload').setInputFiles([await photo(hue, 1.3, 900, 1200)])
  await dialog
    .getByRole('button', { name: /^Hapus foto/ })
    .first()
    .waitFor()
  await dialog.getByRole('button', { name: 'Simpan kantong' }).tap()
  await dialog.waitFor({ state: 'hidden', timeout: 20000 })
}
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(2000)
await shot('pocket')
await phone.close()

// ---------- 2. Rakit gambar promo ----------

const STICKERS = `file://${join(REPO, 'apps/web/public/stickers')}`
const SYMBOL = readFileSync(join(REPO, 'docs/brand/postpocket-symbol.svg'), 'utf8').replace(
  /role="img"[^>]*?>/,
  'aria-hidden="true">',
)

// Ikon status bar iOS, digambar sendiri.
const statusIcons = `
<svg width="18" height="12" viewBox="0 0 18 12"><g fill="#000"><rect x="0" y="7.5" width="3.2" height="4.5" rx="1"/><rect x="4.8" y="5.2" width="3.2" height="6.8" rx="1"/><rect x="9.6" y="2.7" width="3.2" height="9.3" rx="1"/><rect x="14.4" y="0" width="3.2" height="12" rx="1"/></g></svg>
<svg width="16" height="12" viewBox="0 0 16 12"><g fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><path d="M1.6 4.3a9.2 9.2 0 0 1 12.8 0"/><path d="M4.2 7a5.4 5.4 0 0 1 7.6 0"/></g><circle cx="8" cy="10.1" r="1.6" fill="#000"/></svg>
<svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.6" y="0.6" width="23" height="11.8" rx="3.6" fill="none" stroke="#000" stroke-opacity="0.38" stroke-width="1.2"/><rect x="2.4" y="2.4" width="19.4" height="8.2" rx="2.1" fill="#000"/><path d="M25.2 4.4v4.2c.9-.3 1.5-1.2 1.5-2.1s-.6-1.8-1.5-2.1z" fill="#000" fill-opacity="0.45"/></svg>`

// Perangko PostPocket seperti SupportStamp, dengan cap pos bulat.
const stamp = `
<div class="stamp">
  <div class="stamp-paper"><div class="stamp-face">
    <span class="stamp-value">Gratis</span>
    <span class="stamp-logo">${SYMBOL}</span>
    <span class="stamp-country">Indonesia</span>
  </div></div>
  <svg class="postmark" viewBox="0 0 80 80" aria-hidden="true">
    <defs><path id="arc" d="M12 40a28 28 0 0 1 56 0"/></defs>
    <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="40" cy="40" r="26" fill="none" stroke="currentColor" stroke-width="1.2"/>
    <text class="ring"><textPath href="#arc" startOffset="50%" text-anchor="middle">POSTPOCKET</textPath></text>
    <text x="40" y="47" text-anchor="middle" class="date">16 OKT 2026</text>
  </svg>
</div>`

const style = `
:root { --ink: #18204a; --canvas: #f1f4f8; --gold: #d9b45a; --line: rgba(24, 32, 74, 0.14); }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1320px; height: 2868px; overflow: hidden; background: var(--canvas); }
body { position: relative; font-family: Gantari, sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }
.dots { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(24, 32, 74, 0.2) 2.4px, transparent 3px); background-size: 36px 36px; background-position: 18px 18px; -webkit-mask-image: radial-gradient(ellipse 80% 62% at 50% 52%, #000 30%, transparent 78%); }
header { position: absolute; top: 150px; left: 0; right: 0; text-align: center; }
h1 { font-weight: 800; font-size: 122px; line-height: 1.04; letter-spacing: -0.045em; }
.hand { font-family: 'Delicious Handrawn', cursive; font-weight: 400; font-size: 1.36em; letter-spacing: 0; word-spacing: 0.15em; line-height: 0.7; display: inline-block; transform: rotate(-3deg) translateY(6px); }
p.sub { margin-top: 44px; font-weight: 500; font-size: 44px; line-height: 1.42; letter-spacing: -0.01em; color: rgba(24, 32, 74, 0.68); }
.envelope { position: absolute; left: 40px; top: 1640px; width: 1240px; height: 760px; filter: drop-shadow(0 30px 40px rgba(24, 32, 74, 0.16)) drop-shadow(0 4px 8px rgba(24, 32, 74, 0.08)); }
.envelope svg { width: 100%; height: 100%; overflow: visible; }
.phone { position: absolute; left: 200px; top: 790px; width: 920px; height: 1944px; border-radius: 142px; background: linear-gradient(150deg, #4a4a52 0%, #26262b 22%, #1a1a1e 50%, #2e2e34 80%, #46464d 100%); box-shadow: 0 60px 90px rgba(24, 32, 74, 0.32), 0 18px 30px rgba(24, 32, 74, 0.2); }
.bezel { position: absolute; inset: 7px; border-radius: 135px; background: #050507; }
.screen { position: absolute; left: 24px; top: 24px; width: 872px; height: 1896px; border-radius: 118px; overflow: hidden; }
.screen-inner { position: absolute; left: 0; top: 0; width: 402px; height: 874px; transform: scale(2.1692); transform-origin: 0 0; }
.bar { position: relative; height: 62px; }
.time { position: absolute; left: 26px; top: 19px; width: 86px; text-align: center; font: 600 17px/22px -apple-system, 'SF Pro Text', sans-serif; letter-spacing: -0.02em; color: #000; }
.icons { position: absolute; right: 25px; top: 23px; display: flex; gap: 6px; align-items: center; }
.shot { display: block; width: 402px; height: 812px; }
.island { position: absolute; left: 50%; top: 24px; width: 274px; height: 80px; margin-left: -137px; border-radius: 40px; background: #000; }
.home { position: absolute; left: 50%; bottom: 18px; width: 300px; height: 11px; margin-left: -150px; border-radius: 6px; background: rgba(0, 0, 0, 0.82); }
.button { position: absolute; width: 12px; border-radius: 4px; background: linear-gradient(90deg, #1e1e22, #4a4a52 60%, #2a2a2f); }
.sticker { position: absolute; filter: drop-shadow(0 22px 26px rgba(24, 32, 74, 0.26)) drop-shadow(0 4px 6px rgba(24, 32, 74, 0.12)); }
.stamp { position: absolute; left: 58px; top: 1190px; width: 240px; aspect-ratio: 4 / 5; rotate: -9deg; filter: drop-shadow(0 2px 2px rgba(24, 32, 74, 0.14)) drop-shadow(0 18px 24px rgba(24, 32, 74, 0.22)); }
.stamp-paper { position: absolute; inset: 0; padding: 9%; background: #fff; -webkit-mask: radial-gradient(circle closest-side, #0000 62%, #000 70%) round -6% -4.8% / 12% 9.6%, linear-gradient(#000 0 0) no-repeat 50% / 88% 90.4%; }
.stamp-face { display: flex; height: 100%; flex-direction: column; align-items: center; justify-content: space-between; padding: 10% 7% 8%; background: var(--canvas); box-shadow: inset 0 0 0 2px var(--line); }
.stamp-value { align-self: flex-end; font-weight: 800; font-size: 30px; letter-spacing: -0.02em; line-height: 1; }
.stamp-logo svg { display: block; height: 92px; width: auto; }
.stamp-country { align-self: flex-start; font-weight: 500; font-size: 22px; line-height: 1; color: rgba(24, 32, 74, 0.66); }
.postmark { position: absolute; right: -44%; bottom: -26%; width: 76%; rotate: -14deg; color: var(--ink); opacity: 0.55; mix-blend-mode: multiply; }
.postmark .ring, .postmark .date { font: 700 7.5px Gantari, sans-serif; letter-spacing: 0.12em; fill: currentColor; }
.postmark .date { letter-spacing: 0.02em; }`

function html(promo, bar) {
  const stickers = promo.stickers
    .map(
      (s) =>
        `<img class="sticker" src="${STICKERS}/${s.name}.webp" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;transform:rotate(${s.r}deg)" alt="">`,
    )
    .join('\n')
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Delicious+Handrawn&family=Gantari:wght@500;800&display=block" rel="stylesheet">
<style>${style}</style></head><body>
<div class="dots"></div>
<header><h1>${promo.title}</h1><p class="sub">${promo.sub}</p></header>
<div class="envelope" style="transform: rotate(${promo.tilt}deg)">
  <svg viewBox="0 0 1240 760" aria-hidden="true">
    <path d="M24 2 L620 -330 L1216 2 Z" fill="var(--gold)" stroke="var(--ink)" stroke-opacity="0.22" stroke-width="3" stroke-linejoin="round"/>
    <rect x="2" y="2" width="1236" height="756" rx="30" fill="#fff" stroke="var(--ink)" stroke-opacity="0.24" stroke-width="3"/>
    <path d="M14 30 L620 430 L1226 30 M14 742 L520 380 M1226 742 L720 380" fill="none" stroke="var(--ink)" stroke-opacity="0.16" stroke-width="3" stroke-linecap="round"/>
  </svg>
</div>
<div class="phone">
  <span class="button" style="left:-9px;top:330px;height:96px"></span>
  <span class="button" style="left:-9px;top:480px;height:150px"></span>
  <span class="button" style="left:-9px;top:660px;height:150px"></span>
  <span class="button" style="right:-9px;top:560px;height:230px"></span>
  <div class="bezel"></div>
  <div class="screen" style="background:${bar}">
    <div class="screen-inner">
      <div class="bar" style="background:${bar}"><span class="time">09.41</span><span class="icons">${statusIcons}</span></div>
      <img class="shot" src="file://${join(WORK, `${promo.screen}.png`)}" alt="">
    </div>
    <div class="island"></div>
    <div class="home"></div>
  </div>
</div>
${stickers}
${promo.stamp ? stamp : ''}
</body></html>`
}

const poster = await browser.newPage({ viewport: { width: 1320, height: 2868 } })
for (const promo of promos) {
  if (only && !promo.file.includes(only)) continue
  // Status bar memakai warna baris teratas layarnya.
  const bar = await poster.evaluate(
    async (src) => {
      const image = new Image()
      image.src = src
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 6, 3, 1, 1, 0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return `rgb(${r}, ${g}, ${b})`
    },
    `data:image/png;base64,${readFileSync(join(WORK, `${promo.screen}.png`)).toString('base64')}`,
  )
  const file = join(WORK, `${promo.file}.html`)
  writeFileSync(file, html(promo, bar))
  await poster.goto(`file://${file}`)
  await poster.evaluate(() => document.fonts.ready)
  await poster.waitForLoadState('networkidle')
  const png = await poster.screenshot()
  // WebP lewat kanvas Chrome, supaya tidak butuh alat lain.
  const webp = await poster.evaluate(
    async (src) => {
      const image = new Image()
      image.src = src
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      canvas.getContext('2d').drawImage(image, 0, 0)
      return canvas.toDataURL('image/webp', 0.9).split(',')[1]
    },
    `data:image/png;base64,${png.toString('base64')}`,
  )
  writeFileSync(join(OUT, `${promo.file}.webp`), Buffer.from(webp, 'base64'))
  console.log(`docs/gambar/${promo.file}.webp`)
}
await browser.close()
