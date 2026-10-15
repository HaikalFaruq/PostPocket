// Master logo di docs/brand dan favicon.svg, dibangun dari app/utils/brand-logo.ts (docs/desain.md
// bagian Logo). Jalankan ulang setelah geometri atau warna logo berubah, lalu pwa-icons.mjs dan
// og-images.mjs supaya PNG dan JPG-nya ikut.
//
//   node scripts/brand.mjs

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  BRAND_COLORS,
  BRAND_LOCKUP,
  BRAND_SYMBOL,
  BRAND_WORDMARK,
  brandIconSvg,
  brandLockupSvg,
  brandSymbolPaths,
  brandSymbolSvg,
  brandWordmarkPath,
} from '../app/utils/brand-logo.ts'

const { ink, gold } = BRAND_COLORS
const docs = fileURLToPath(new URL('../../../docs/brand/', import.meta.url))
mkdirSync(docs, { recursive: true })
const write = (path, content) => {
  writeFileSync(path, content + '\n')
  console.log(path.replace(fileURLToPath(new URL('../../../', import.meta.url)), ''))
}

// Simbol: warna, satu warna (tutupnya lubang), terbalik untuk latar navy, dan potongan kecil.
write(`${docs}postpocket-symbol.svg`, brandSymbolSvg({ gold }))
write(`${docs}postpocket-symbol-mono.svg`, brandSymbolSvg({ ink }))
write(`${docs}postpocket-symbol-reversed.svg`, brandSymbolSvg({ ink: '#ffffff', gold }))
write(`${docs}postpocket-symbol-white.svg`, brandSymbolSvg({ ink: '#ffffff' }))
write(`${docs}postpocket-symbol-small.svg`, brandSymbolSvg({ gold, small: true }))

// Lockup horizontal dalam empat versi yang sama.
write(`${docs}postpocket-horizontal.svg`, brandLockupSvg({ gold }))
write(`${docs}postpocket-horizontal-mono.svg`, brandLockupSvg({ ink }))
write(`${docs}postpocket-horizontal-reversed.svg`, brandLockupSvg({ ink: '#ffffff', gold }))
write(`${docs}postpocket-horizontal-white.svg`, brandLockupSvg({ ink: '#ffffff' }))

// Bertumpuk: P 1,5× di tengah atas, wordmark di bawahnya berjarak 0,45 × tinggi kapital.
{
  const scale = 1.5
  const width = BRAND_WORDMARK.width
  const symbolX = (width - BRAND_SYMBOL.width * scale) / 2
  const baseline = BRAND_SYMBOL.height * scale + 0.45 * BRAND_WORDMARK.cap + BRAND_WORDMARK.cap
  const height = baseline + BRAND_WORDMARK.descent
  write(
    `${docs}postpocket-stacked.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${Math.ceil(height)}" role="img" aria-label="PostPocket">` +
      brandSymbolPaths({ gold }, symbolX, 0, scale) +
      brandWordmarkPath(ink, 0, baseline) +
      '</svg>',
  )
}
write(
  `${docs}postpocket-wordmark.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BRAND_WORDMARK.width} ${BRAND_WORDMARK.cap + BRAND_WORDMARK.descent}" role="img" aria-label="PostPocket">` +
    brandWordmarkPath(ink, 0, BRAND_WORDMARK.cap) +
    '</svg>',
)

// Ikon aplikasi di latar kanvas Beranda, dan favicon dengan potongan kecil.
write(`${docs}postpocket-icon.svg`, brandIconSvg(512, { radius: 0.22 }))
write(
  fileURLToPath(new URL('../public/favicon.svg', import.meta.url)),
  brandIconSvg(32, { fill: 0.74, radius: 0.22, small: true }),
)
console.log(`lockup ${BRAND_LOCKUP.width} × ${BRAND_LOCKUP.height}`)
