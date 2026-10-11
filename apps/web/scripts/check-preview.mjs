// Cek apakah link surat akan tampil sebagai preview di WhatsApp (gerbang Sprint 2): halamannya
// diambil seperti crawler WhatsApp, lalu meta OG dan gambar OG-nya diperiksa
// (aturannya di scripts/link-preview.mjs).
//
//   pnpm --filter @postpocket/web check:preview https://postpocket.vercel.app/l/<slug>

import { WHATSAPP_AGENT, isLocalUrl, previewChecks, readMeta } from './link-preview.mjs'

const url = process.argv[2]
if (!url) {
  console.error('Pakai: pnpm --filter @postpocket/web check:preview <link surat>')
  process.exit(2)
}

/** Ambil satu URL seperti crawler WhatsApp. Gagal tersambung jadi status 0. */
async function grab(target) {
  const started = performance.now()
  try {
    const response = await fetch(target, { headers: { 'user-agent': WHATSAPP_AGENT } })
    const bytes = new Uint8Array(await response.arrayBuffer())
    const headers = Object.fromEntries(response.headers)
    return { status: response.status, headers, bytes, ms: Math.round(performance.now() - started) }
  } catch {
    return { status: 0, headers: {}, bytes: new Uint8Array(), ms: 0 }
  }
}

const page = await grab(url)
const html = new TextDecoder().decode(page.bytes)
const imageUrl = readMeta(html)['og:image']
const image = imageUrl ? await grab(new URL(imageUrl, url)) : null
const checks = previewChecks({ page: { ...page, html }, image, allowHttp: isLocalUrl(url) })

console.log(`Cek preview WhatsApp: ${url}`)
console.log(`Halaman ${page.ms} ms${image ? `, gambar OG ${image.ms} ms` : ''}\n`)
for (const check of checks) console.log(`${check.ok ? '✓' : '✗'} ${check.label}: ${check.detail}`)
const failed = checks.filter((check) => !check.ok)
const preview = failed.filter((check) => check.kind === 'preview').length
console.log(
  preview
    ? `\n${preview} syarat preview gagal, jadi preview di WhatsApp bisa tidak muncul.`
    : failed.length
      ? '\nPreview aman, tapi halaman ini bisa diindeks mesin pencari. Halaman surat wajib noindex.'
      : '\nSemua lolos. Terakhir, kirim linknya lewat WhatsApp ke HP lain dan lihat preview-nya.',
)
process.exit(failed.length ? 1 : 0)
