import { describe, expect, it } from 'vitest'
import { imageSize, isLocalUrl, previewChecks, readMeta } from '../scripts/link-preview.mjs'

const hex = (value: string) => Uint8Array.from(value.match(/../g)!, (byte) => parseInt(byte, 16))
const u16 = (value: number) => value.toString(16).padStart(4, '0')

/** Header JPEG kecil: SOI, APP0 kosong, lalu SOF0 berisi tinggi dan lebar. */
function jpeg(width: number, height: number, padding = 0): Uint8Array {
  const header = hex(`ffd8ffe000040000ffc0001108${u16(height)}${u16(width)}03`)
  return new Uint8Array([...header, ...new Array(padding).fill(0)])
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return bytes
}

const html = `<!DOCTYPE html><html><head>
<meta name="robots" content="noindex, nofollow">
<meta property="og:title" content="Ada surat untukmu">
<meta property="og:description" content="Ketuk kartunya &amp; buka">
<meta property="og:image" content="https://x.supabase.co/storage/v1/object/public/letter-assets/a/b.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
</head></html>`

const page = { status: 200, headers: { 'x-robots-tag': 'noindex' }, html }
const image = {
  status: 200,
  headers: { 'content-type': 'image/jpeg' },
  bytes: jpeg(1200, 630, 1000),
}

describe('preview WhatsApp', () => {
  it('membaca meta OG dari HTML server', () => {
    expect(readMeta(html)).toMatchObject({
      'og:title': 'Ada surat untukmu',
      'og:description': 'Ketuk kartunya & buka',
      'og:image:width': '1200',
      robots: 'noindex, nofollow',
    })
  })

  it('membaca ukuran JPEG dan PNG dari header-nya', () => {
    expect(imageSize(jpeg(1200, 630))).toEqual({ width: 1200, height: 630 })
    expect(imageSize(png(1200, 630))).toEqual({ width: 1200, height: 630 })
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull()
  })

  it('link surat yang benar lolos semua cek', () => {
    expect(previewChecks({ page, image }).filter((check) => !check.ok)).toEqual([])
  })

  it('menyebut apa yang bikin preview gagal', () => {
    const broken = previewChecks({
      page: {
        status: 200,
        headers: {},
        html: '<meta property="og:title" content="x"><meta property="og:image" content="/og.jpg">',
      },
      image: {
        status: 200,
        headers: { 'content-type': 'image/webp' },
        bytes: jpeg(800, 600, 300_000),
      },
    })
    expect(broken.filter((check) => !check.ok).map((check) => check.label)).toEqual([
      'Tidak diindeks mesin pencari',
      'Meta OG ada di HTML dari server',
      'URL gambar OG absolut dan https',
      'Gambar OG berupa JPEG atau PNG',
      'Ukuran gambar OG maksimal 300.000 byte',
      'Gambar OG berukuran 1200×630',
      'og:image:width dan og:image:height sesuai gambarnya',
    ])
    // noindex soal privasi surat, bukan syarat preview.
    expect(broken.filter((check) => check.kind === 'privasi').map((check) => check.label)).toEqual([
      'Tidak diindeks mesin pencari',
    ])
  })

  it('http hanya diterima untuk server lokal', () => {
    expect(isLocalUrl('http://127.0.0.1:4320/l/abc')).toBe(true)
    expect(isLocalUrl('http://localhost/l/abc')).toBe(true)
    expect(isLocalUrl('http://postpocket.vercel.app/l/abc')).toBe(false)
    expect(isLocalUrl('https://127.0.0.1.example.com/l/abc')).toBe(false)
    const local = { ...page, html: html.replace('https://x.supabase.co', 'http://127.0.0.1:4320') }
    expect(previewChecks({ page: local, image }).some((check) => !check.ok)).toBe(true)
    expect(previewChecks({ page: local, image, allowHttp: true }).every((check) => check.ok)).toBe(
      true,
    )
  })
})
