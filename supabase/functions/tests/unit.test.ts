// Unit test tanpa database. Jalankan dari supabase/functions: deno test tests/unit.test.ts

import { assert, assertEquals, assertNotEquals, assertThrows } from '@std/assert'
import { errorFields, routePattern } from '../_shared/errors.ts'
import { chunks } from '../_shared/files.ts'
import { ApiError } from '../_shared/http.ts'
import { imageInfo, stripMetadata } from '../_shared/image.ts'
import { ipPrefix, newSlug, sameHash, sha256 } from '../_shared/token.ts'
import { parseCreateRequest } from '../_shared/validate.ts'
import { content, design, jpeg, letterFixture, png, webp } from './fixtures.ts'

const hasText = (file: Uint8Array, text: string) =>
  new TextDecoder('latin1').decode(file).includes(text)

Deno.test('imageInfo membaca tipe dan dimensi dari isi berkas', () => {
  assertEquals(imageInfo(jpeg(800, 600)), { type: 'image/jpeg', width: 800, height: 600 })
  assertEquals(imageInfo(webp(2048, 1536)), { type: 'image/webp', width: 2048, height: 1536 })
  assertEquals(imageInfo(webp(640, 480, { exif: true })), {
    type: 'image/webp',
    width: 640,
    height: 480,
  })
  assertEquals(imageInfo(png(1200, 630)), { type: 'image/png', width: 1200, height: 630 })
  assertEquals(imageInfo(new TextEncoder().encode('GIF89a bukan foto')), null)
})

Deno.test('stripMetadata membuang EXIF JPEG tanpa menyentuh data gambar', () => {
  const original = jpeg(800, 600, { exif: true })
  const clean = stripMetadata(original, 'image/jpeg')
  assert(hasText(original, 'GPS'))
  assert(!hasText(clean, 'GPS'))
  assert(hasText(clean, 'JFIF'), 'APP0 JFIF tetap ada')
  assertEquals(imageInfo(clean), { type: 'image/jpeg', width: 800, height: 600 })
  assertEquals(clean.subarray(-34), original.subarray(-34), 'data scan sama persis')
})

Deno.test('stripMetadata mengembalikan berkas yang sama kalau tidak ada metadata', () => {
  const file = jpeg(10, 10)
  assert(stripMetadata(file, 'image/jpeg') === file)
  const photo = webp(10, 10)
  assert(stripMetadata(photo, 'image/webp') === photo)
})

Deno.test('stripMetadata membuang chunk EXIF WebP dan memperbaiki header RIFF', () => {
  const clean = stripMetadata(webp(640, 480, { exif: true }), 'image/webp')
  assert(!hasText(clean, 'EXIF'))
  const view = new DataView(clean.buffer)
  assertEquals(view.getUint32(4, true), clean.length - 8, 'ukuran RIFF')
  assertEquals(clean[20] & 0x08, 0, 'flag EXIF di VP8X mati')
  assertEquals(imageInfo(clean), { type: 'image/webp', width: 640, height: 480 })
})

Deno.test('stripMetadata membuang chunk teks PNG', () => {
  const clean = stripMetadata(png(1200, 630, { text: true }), 'image/png')
  assert(!hasText(clean, 'rahasia'))
  assertEquals(imageInfo(clean), { type: 'image/png', width: 1200, height: 630 })
})

function rejects(body: unknown): ApiError {
  return assertThrows(() => parseCreateRequest(body), ApiError) as ApiError
}

Deno.test('parseCreateRequest menerima body yang valid', () => {
  const { body } = letterFixture()
  assertEquals(parseCreateRequest(body).photos[0].key, 'p1')
})

Deno.test('parseCreateRequest: bentuk salah jadi 400 dengan details', () => {
  const { body } = letterFixture()
  const error = rejects({
    ...body,
    content: {
      version: 1,
      elements: [{ ...content.elements[1], size: 9 }, content.elements[0]],
    },
  })
  assertEquals([error.status, error.code], [400, 'invalid_content'])
  assertEquals(error.details?.[0].path, 'content.elements[0].size')

  const extra = rejects({
    ...body,
    cover: { type: 'image/jpeg', width: 1, height: 1, size: 1, x: 1 },
  })
  assertEquals([extra.status, extra.code], [400, 'invalid_request'])
  assertEquals(extra.details?.[0].path, 'cover.x')

  assertEquals(rejects({ ...body, design: { ...design, paper: 1 } }).code, 'invalid_design')
  assertEquals(rejects('bukan objek').code, 'invalid_request')
})

Deno.test('parseCreateRequest: isi yang ditolak jadi 422', () => {
  const { body } = letterFixture()
  const cases: [unknown, string][] = [
    [{ ...body, design: { ...design, paper: 'emas' } }, 'invalid_design'],
    [
      { ...body, design: { ...design, illustration: 'upload', foilMode: 'design' } },
      'invalid_design',
    ],
    [{
      ...body,
      content: {
        version: 1,
        elements: [content.elements[0], { ...content.elements[1], id: 'e1' }],
      },
    }, 'invalid_content'],
    [{
      ...body,
      content: {
        version: 1,
        elements: [content.elements[0], { ...content.elements[1], text: '   ' }],
      },
    }, 'invalid_content'],
    [{
      ...body,
      content: {
        version: 1,
        elements: [content.elements[0], { ...content.elements[1], text: 'a\u0000b' }],
      },
    }, 'invalid_content'],
    [{
      ...body,
      content: {
        version: 1,
        elements: [
          content.elements[0],
          { kind: 'sticker', id: 's1', x: 0, y: 0, width: 0.1, rotation: 0, sticker: 'nggak-ada' },
        ],
      },
    }, 'invalid_content'],
    [{ ...body, photos: [] }, 'photo_mismatch'],
    [{ ...body, photos: [{ ...body.photos[0], key: 'p2' }] }, 'photo_mismatch'],
    [{ ...body, design: { ...design, illustration: 'upload' } }, 'cover_mismatch'],
    [{ ...body, cover: { type: 'image/jpeg', width: 10, height: 10, size: 10 } }, 'cover_mismatch'],
  ]
  for (const [input, code] of cases) {
    const error = rejects(input)
    assertEquals([error.status, error.code], [422, code], JSON.stringify(input))
  }
})

Deno.test('parseCreateRequest: batas jumlah elemen sama dengan contentLimits', () => {
  const { body } = letterFixture()
  const text = (i: number) => ({ ...content.elements[1], id: `t${i}` })
  const error = rejects({
    ...body,
    content: { version: 1, elements: [content.elements[0], ...[1, 2, 3, 4, 5].map(text)] },
  })
  assertEquals([error.status, error.code], [422, 'invalid_content'])
})

Deno.test('newSlug 10 karakter base62', () => {
  for (let i = 0; i < 50; i++) assert(/^[A-Za-z0-9]{10}$/.test(newSlug()))
  assertNotEquals(newSlug(), newSlug())
})

Deno.test('sameHash cocok dengan literal bytea dari database', async () => {
  const hash = await sha256('token')
  const stored = '\\x' + Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')
  assert(sameHash(hash, stored))
  assert(!sameHash(await sha256('lain'), stored))
})

Deno.test('ipPrefix memotong IPv6 ke /64 dan membiarkan IPv4', () => {
  assertEquals(ipPrefix('36.68.1.2'), '36.68.1.2')
  assertEquals(ipPrefix('2001:db8:abcd:12:1:2:3:4'), '2001:db8:abcd:12::/64')
  assertEquals(ipPrefix('2001:db8::1'), '2001:db8:0:0::/64')
  assertEquals(ipPrefix('2001:DB8:0:0:ffff::1'), '2001:db8:0:0::/64')
})

Deno.test('chunks memotong daftar untuk filter .in() yang panjang', () => {
  assertEquals(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assertEquals(chunks([], 200), [])
  assertEquals(chunks(Array.from({ length: 450 }, (_, i) => i), 200).map((part) => part.length), [
    200,
    200,
    50,
  ])
})

Deno.test('routePattern membuang id dan slug dari path', () => {
  assertEquals(routePattern('/letters'), '/letters')
  assertEquals(routePattern('/letters/0f8c6a52-1c1e-4d1b-9a1e-1f2b3c4d5e6f'), '/letters/:id')
  assertEquals(routePattern('/letters/0f8c6a52/publish'), '/letters/:id/publish')
  assertEquals(routePattern('/l/abcdefghij'), '/l/:slug')
  assertEquals(routePattern('/l/AbCdE12345/open'), '/l/:slug/open')
  assertEquals(routePattern('/cleanup'), '/cleanup')
  assertEquals(routePattern('/l'), '/:other')
  assertEquals(routePattern('/l/abcdefghij/bukan'), '/:other')
  assertEquals(routePattern('/letters/a/publish/lagi'), '/:other')
})

Deno.test('errorFields hanya menyimpan nama dan kode yang cocok pola, tanpa pesan', () => {
  assertEquals(
    errorFields({ message: 'canceling statement', code: '57014', details: null, hint: null }),
    { error_name: null, error_code: '57014' },
  )
  assertEquals(
    errorFields(
      new TypeError(
        'error sending request for url (https://x.supabase.co/rest/v1/letters?slug=eq.AbCdE12345)',
      ),
    ),
    { error_name: 'TypeError', error_code: null },
  )
  assertEquals(
    errorFields({ name: 'StorageApiError', statusCode: '400', message: 'Object not found' }),
    { error_name: 'StorageApiError', error_code: '400' },
  )
  // Nilai input yang kebawa di kode atau nama ditolak pola.
  assertEquals(
    errorFields({ name: 'invalid input syntax for type uuid: "x"', code: 'id=eq.0f8c6a52-1c1e' }),
    { error_name: null, error_code: null },
  )
  assertEquals(errorFields('teks biasa'), { error_name: null, error_code: null })
  assertEquals(errorFields(null), { error_name: null, error_code: null })
})
