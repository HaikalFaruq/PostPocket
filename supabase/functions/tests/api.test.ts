// Test integrasi lima endpoint terhadap stack Supabase yang sedang jalan.
// Jalankan dari supabase/functions setelah `supabase start`:
//
//   API_URL=http://127.0.0.1:54321 PUBLISHABLE_KEY=sb_publishable_… deno test -A tests/api.test.ts
//
// Tanpa API_URL test ini dilewati.

import { assert, assertEquals, assertMatch } from '@std/assert'
import { imageInfo } from '../_shared/image.ts'
import { jpeg, letterFixture } from './fixtures.ts'

const API = Deno.env.get('API_URL')
const KEY = Deno.env.get('PUBLISHABLE_KEY') ?? ''
const ORIGIN = 'https://postpocket.vercel.app'
const ignore = !API
// Terhadap proyek Supabase asli (bukan stack lokal):
// - CORS dicek, karena Kong di stack lokal menimpanya dengan `*` dan menjawab preflight sendiri;
// - rate limit tidak dicek, karena IP di sana IP asli kita dan akan terkunci sejam.
const remote = !!API && !/127\.0\.0\.1|localhost/.test(API)

/** IP palsu per test, supaya rate limit antar test tidak saling mengganggu. */
const ip = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.1`

async function call(
  method: string,
  path: string,
  options: { body?: unknown; token?: string; ip?: string; apikey?: string | null } = {},
) {
  const headers: Record<string, string> = { origin: ORIGIN, 'x-forwarded-for': options.ip ?? ip() }
  if (options.apikey !== null) headers.apikey = options.apikey ?? KEY
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.token) headers['x-edit-token'] = options.token
  const response = await fetch(`${API}/functions/v1${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const text = await response.text()
  return { response, body: text ? JSON.parse(text) : null }
}

async function upload(
  target: { signedUrl: string },
  file: Uint8Array<ArrayBuffer>,
  type = 'image/jpeg',
) {
  // Sama seperti klien frontend: PUT ke signedUrl tanpa apikey.
  const response = await fetch(target.signedUrl, {
    method: 'PUT',
    headers: { 'content-type': type, 'x-upsert': 'false' },
    body: file,
  })
  await response.body?.cancel()
  assert(response.ok, `upload gagal: ${response.status}`)
}

/** Buat draf, unggah semua berkas, lalu terbitkan. */
async function sendLetter() {
  const { body, files } = letterFixture()
  const created = await call('POST', '/letters', { body })
  assertEquals(created.response.status, 201, JSON.stringify(created.body))
  await upload(created.body.uploads.photos.p1, files.photo)
  await upload(created.body.uploads.og, files.og)
  const published = await call('POST', `/letters/${created.body.id}/publish`, {
    token: created.body.editToken,
  })
  return { created: created.body, published, files }
}

Deno.test({
  name: 'alur penuh: buat, unggah, terbitkan, baca, buka, hapus',
  ignore,
  async fn() {
    const { created, published, files } = await sendLetter()
    assertMatch(created.id, /^[0-9a-f-]{36}$/)
    assert(Date.parse(created.draftExpiresAt) > Date.now() + 23 * 3600_000)
    assertEquals(created.uploads.cover, null)
    assert(created.uploads.photos.p1.path.startsWith(`${created.id}/`))

    assertEquals(published.response.status, 200, JSON.stringify(published.body))
    if (remote) {
      assertEquals(published.response.headers.get('access-control-allow-origin'), ORIGIN)
    }
    const { slug } = published.body
    assertMatch(slug, /^[A-Za-z0-9]{10}$/)
    assertEquals(published.body.url, `${ORIGIN}/l/${slug}`)

    // Publish ulang: 409 dengan slug yang sama.
    const again = await call('POST', `/letters/${created.id}/publish`, {
      token: created.editToken,
    })
    assertEquals([again.response.status, again.body.slug], [409, slug])

    // Halaman penerima.
    const letter = await call('GET', `/l/${slug}`)
    assertEquals(letter.response.status, 200)
    assertEquals(letter.body.content.elements.length, 2)
    assertEquals(letter.body.openedAt, null)
    assertEquals(letter.body.cover, null)
    assertEquals(letter.body.og.width, 1200)

    // Foto bisa diambil publik, EXIF-nya sudah dibuang, dan ukurannya mengecil.
    const photo = await fetch(letter.body.photos.p1.url)
    const photoBytes = new Uint8Array(await photo.arrayBuffer())
    assertEquals(photo.headers.get('content-type'), 'image/jpeg')
    assertEquals(imageInfo(photoBytes), { type: 'image/jpeg', width: 800, height: 600 })
    assert(!new TextDecoder('latin1').decode(photoBytes).includes('GPS'))
    assert(photoBytes.length < files.photo.length)

    // Dibuka: idempoten.
    const opened = await call('POST', `/l/${slug}/open`)
    assertEquals(opened.response.status, 200)
    const openedAt = Date.parse(opened.body.openedAt)
    assertEquals(Date.parse(opened.body.photosExpireAt) - openedAt, 7 * 24 * 3600_000)
    const reopened = await call('POST', `/l/${slug}/open`)
    assertEquals(reopened.body.openedAt, opened.body.openedAt)

    // Balasan ke surat ini.
    const reply = letterFixture()
    const replied = await call('POST', '/letters', { body: { ...reply.body, replyTo: slug } })
    assertEquals(replied.response.status, 201)
    const unreply = await call('DELETE', `/letters/${replied.body.id}`, {
      token: replied.body.editToken,
    })
    assertEquals(unreply.response.status, 204)

    // Hapus: link mati, berkas hilang.
    const wrong = await call('DELETE', `/letters/${created.id}`, { token: 'salah' })
    assertEquals([wrong.response.status, wrong.body.error.code], [401, 'unauthorized'])
    const removed = await call('DELETE', `/letters/${created.id}`, { token: created.editToken })
    assertEquals(removed.response.status, 204)
    const gone = await call('GET', `/l/${slug}`)
    assertEquals([gone.response.status, gone.body.error.code], [404, 'not_found'])
    const file = await fetch(letter.body.photos.p1.url)
    await file.body?.cancel()
    assert(!file.ok, 'berkas sudah dihapus dari Storage')
  },
})

Deno.test({
  name: 'publish menolak berkas yang belum diunggah atau tidak sesuai metadata',
  ignore,
  async fn() {
    const { body, files } = letterFixture()
    const created = await call('POST', '/letters', { body })
    const publish = () =>
      call('POST', `/letters/${created.body.id}/publish`, { token: created.body.editToken })

    await upload(created.body.uploads.og, files.og)
    const missing = await publish()
    assertEquals([missing.response.status, missing.body.error.code], [422, 'upload_missing'])

    // Ukuran sama, dimensi beda.
    const other = jpeg(801, 600, { exif: true, pad: 200 })
    assertEquals(other.length, files.photo.length)
    await upload(created.body.uploads.photos.p1, other)
    const invalid = await publish()
    assertEquals([invalid.response.status, invalid.body.error.code], [422, 'upload_invalid'])

    const removed = await call('DELETE', `/letters/${created.body.id}`, {
      token: created.body.editToken,
    })
    assertEquals(removed.response.status, 204)
  },
})

Deno.test({
  name: 'POST /letters: body salah jadi 400, replyTo tidak ada jadi 422',
  ignore,
  async fn() {
    const { body } = letterFixture()
    const bad = await call('POST', '/letters', { body: { ...body, og: { ...body.og, width: 1 } } })
    assertEquals([bad.response.status, bad.body.error.code], [400, 'invalid_request'])
    assertEquals(bad.body.error.details[0].path, 'og.width')

    const reply = await call('POST', '/letters', { body: { ...body, replyTo: 'AAAAAAAAAA' } })
    assertEquals([reply.response.status, reply.body.error.code], [422, 'reply_not_found'])
  },
})

Deno.test({
  name: 'POST /letters: rate limit 10 per jam per IP',
  ignore: ignore || remote,
  async fn() {
    const { body } = letterFixture()
    const same = ip()
    for (let i = 0; i < 10; i++) {
      const ok = await call('POST', '/letters', { body, ip: same })
      assertEquals(ok.response.status, 201, `surat ke-${i + 1}`)
    }
    const limited = await call('POST', '/letters', { body, ip: same })
    assertEquals([limited.response.status, limited.body.error.code], [429, 'rate_limited'])
    const retry = Number(limited.response.headers.get('retry-after'))
    assert(retry > 3500 && retry <= 3600, `Retry-After ${retry}`)
  },
})

Deno.test({
  name: 'apikey dan path yang tidak dikenal',
  ignore,
  async fn() {
    const noKey = await call('GET', '/l/AAAAAAAAAA', { apikey: null })
    assertEquals([noKey.response.status, noKey.body.error.code], [401, 'unauthorized'])
    const wrongKey = await call('GET', '/l/AAAAAAAAAA', { apikey: 'sb_publishable_palsu' })
    assertEquals(wrongKey.response.status, 401)

    for (
      const [method, path] of [['GET', '/l/pendek'], ['POST', '/l/AAAAAAAAAA/open'], [
        'DELETE',
        '/letters/bukan-uuid',
      ], ['GET', '/letters']]
    ) {
      const result = await call(method, path, { token: 'x' })
      assertEquals([result.response.status, result.body.error.code], [404, 'not_found'], path)
    }
  },
})

Deno.test({
  name: 'CORS: origin frontend dan preview diizinkan, origin lain tidak',
  ignore: !remote,
  async fn() {
    const preflight = await fetch(`${API}/functions/v1/letters`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://postpocket-git-fitur-haikalfaruqs-projects.vercel.app',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'apikey, content-type, x-edit-token',
      },
    })
    await preflight.body?.cancel()
    assertEquals(preflight.status, 204)
    assertEquals(
      preflight.headers.get('access-control-allow-origin'),
      'https://postpocket-git-fitur-haikalfaruqs-projects.vercel.app',
    )
    assert(preflight.headers.get('access-control-allow-headers')!.includes('x-edit-token'))

    const evil = await fetch(`${API}/functions/v1/l/AAAAAAAAAA`, {
      headers: { apikey: KEY, origin: 'https://jahat.example' },
    })
    await evil.body?.cancel()
    assertEquals(evil.headers.get('access-control-allow-origin'), null)

    // Retry-After dari 429 harus bisa dibaca klien lintas origin.
    const allowed = await call('GET', '/l/AAAAAAAAAA')
    assertEquals(allowed.response.headers.get('access-control-allow-origin'), ORIGIN)
    assertEquals(allowed.response.headers.get('access-control-expose-headers'), 'retry-after')
  },
})
