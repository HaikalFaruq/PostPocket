// Aturan preview link surat di WhatsApp (gerbang Sprint 2). Halaman dan gambar OG harus
// terbuka tanpa login, meta OG harus ada di HTML dari server (crawler WhatsApp tidak menjalankan
// JavaScript), dan gambarnya JPEG atau PNG 1200×630 maksimal 300.000 byte.
// Dipakai scripts/check-preview.mjs, unit test, dan E2E.

/** User agent crawler WhatsApp, supaya halamannya diambil seperti oleh WhatsApp. */
export const WHATSAPP_AGENT = 'WhatsApp/2.24.20.78 A'

/** Batas ukuran gambar OG, sama dengan kontrak API. */
export const OG_MAX_BYTES = 300_000

/** Server lokal boleh memakai http; situs asli wajib https. */
export function isLocalUrl(url) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
}

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }

function decode(value) {
  return value.replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (match, code) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? match
    const hex = code[1] === 'x' || code[1] === 'X'
    return String.fromCodePoint(Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10))
  })
}

/** Isi semua tag meta (`property` atau `name`) dari HTML. Kunci huruf kecil, yang pertama menang. */
export function readMeta(html) {
  const meta = {}
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag)
    if (!key || !content || key in meta) continue
    meta[key] = decode(content[1] ?? content[2] ?? '')
  }
  return meta
}

/** Lebar dan tinggi gambar dari header PNG (IHDR) atau JPEG (penanda SOF), atau `null`. */
export function imageSize(bytes) {
  const at = (i) => bytes[i] ?? 0
  const u16 = (i) => (at(i) << 8) | at(i + 1)
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return { width: u16(16) * 65536 + u16(18), height: u16(20) * 65536 + u16(22) }
  }
  if (at(0) !== 0xff || at(1) !== 0xd8) return null
  let i = 2
  while (i + 9 < bytes.length) {
    if (at(i) !== 0xff) {
      i++
      continue
    }
    const marker = at(i + 1)
    // Penanda tanpa panjang: isi (FF), SOI, TEM, dan RST0 sampai RST7.
    if (
      marker === 0xff ||
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      i += marker === 0xff ? 1 : 2
      continue
    }
    // SOF0 sampai SOF15, kecuali DHT (C4), JPG (C8), dan DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: u16(i + 5), width: u16(i + 7) }
    }
    i += 2 + u16(i + 2)
  }
  return null
}

const number = (value) => value.toLocaleString('id-ID')

/**
 * Cek satu link surat. `page` dan `image` adalah hasil mengambil halaman dan gambar OG-nya:
 * `status`, `headers` (nama huruf kecil), lalu `html` atau `bytes`. `image` boleh `null` kalau
 * tidak ada URL gambar. `allowHttp` hanya untuk server lokal.
 *
 * Tiap cek berjenis `preview` (syarat preview WhatsApp) atau `privasi` (surat tidak boleh
 * diindeks mesin pencari, tapi tidak memengaruhi preview).
 */
export function previewChecks({ page, image, allowHttp = false }) {
  const checks = []
  const add = (ok, label, detail, kind = 'preview') => checks.push({ ok, label, detail, kind })

  add(page.status === 200, 'Halaman terbuka tanpa login', `status ${page.status}`)
  const meta = readMeta(page.html)
  const robots = [
    page.headers['x-robots-tag'] && `header ${page.headers['x-robots-tag']}`,
    meta.robots && `meta ${meta.robots}`,
  ].filter(Boolean)
  add(
    robots.some((value) => /noindex/i.test(value)),
    'Tidak diindeks mesin pencari',
    robots.join(' · ') || 'tidak ada noindex',
    'privasi',
  )
  const missing = ['og:title', 'og:description', 'og:image'].filter((key) => !meta[key])
  add(
    missing.length === 0,
    'Meta OG ada di HTML dari server',
    missing.length ? `tidak ada ${missing.join(', ')}` : 'og:title, og:description, og:image',
  )
  const url = meta['og:image'] ?? ''
  add(
    /^https:\/\//.test(url) || (allowHttp && /^http:\/\//.test(url)),
    allowHttp ? 'URL gambar OG absolut' : 'URL gambar OG absolut dan https',
    url || 'kosong',
  )
  if (!image) return checks

  add(image.status === 200, 'Gambar OG terbuka tanpa login', `status ${image.status}`)
  const type = (image.headers['content-type'] ?? '').split(';')[0].trim()
  add(
    ['image/jpeg', 'image/png'].includes(type),
    'Gambar OG berupa JPEG atau PNG',
    type || 'kosong',
  )
  add(
    image.bytes.length > 0 && image.bytes.length <= OG_MAX_BYTES,
    `Ukuran gambar OG maksimal ${number(OG_MAX_BYTES)} byte`,
    `${number(image.bytes.length)} byte`,
  )
  const size = imageSize(image.bytes)
  const actual = size ? `${size.width}×${size.height}` : null
  add(actual === '1200×630', 'Gambar OG berukuran 1200×630', actual ?? 'tidak terbaca')
  const declared = `${meta['og:image:width'] ?? '?'}×${meta['og:image:height'] ?? '?'}`
  add(
    !actual || declared === actual,
    'og:image:width dan og:image:height sesuai gambarnya',
    declared,
  )
  return checks
}
