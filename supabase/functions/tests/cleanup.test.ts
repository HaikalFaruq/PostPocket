// Test integrasi job pembersihan terhadap stack Supabase lokal. Butuh secret key untuk memundurkan
// waktu di database dan memanggil fungsi cleanup, jadi hanya untuk stack lokal:
//
//   API_URL=http://127.0.0.1:54321 PUBLISHABLE_KEY=… SECRET_KEY=… deno test -A tests/cleanup.test.ts
//
// Tanpa SECRET_KEY test ini dilewati.

import { assert, assertEquals } from '@std/assert'
import { createClient } from '@supabase/supabase-js'
import { jpeg, letterFixture } from './fixtures.ts'

const API = Deno.env.get('API_URL') ?? ''
const KEY = Deno.env.get('PUBLISHABLE_KEY') ?? ''
const SECRET = Deno.env.get('SECRET_KEY') ?? ''
const ignore = !API || !SECRET

const admin = () => createClient(API, SECRET, { auth: { persistSession: false } })
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const HOUR = 3600_000
const DAY = 24 * HOUR

async function call(method: string, path: string, token?: string) {
  const headers: Record<string, string> = { apikey: KEY, 'x-forwarded-for': '10.9.9.9' }
  if (token) headers['x-edit-token'] = token
  const response = await fetch(`${API}/functions/v1${path}`, { method, headers })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

async function upload(target: { signedUrl: string }, file: Uint8Array<ArrayBuffer>) {
  const response = await fetch(target.signedUrl, {
    method: 'PUT',
    headers: { 'content-type': 'image/jpeg', 'x-upsert': 'false', 'cache-control': 'max-age=3600' },
    body: file,
  })
  await response.body?.cancel()
  assert(response.ok, `upload gagal: ${response.status}`)
}

/** Buat draf (dengan atau tanpa cover foto), unggah semua berkas, dan terbitkan kalau diminta. */
async function letter(options: { cover?: boolean; publish?: boolean } = {}) {
  const { body, files } = letterFixture()
  const cover = jpeg(600, 800)
  const request = options.cover
    ? {
      ...body,
      design: { ...body.design, illustration: 'upload' },
      cover: { type: 'image/jpeg', width: 600, height: 800, size: cover.length },
    }
    : body
  const response = await fetch(`${API}/functions/v1/letters`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      'content-type': 'application/json',
      // IP acak supaya rate limit 10 per jam tidak habis di antara test.
      'x-forwarded-for': `10.8.${Math.floor(Math.random() * 250)}.${
        Math.floor(Math.random() * 250)
      }`,
    },
    body: JSON.stringify(request),
  })
  const created = await response.json()
  assertEquals(response.status, 201, JSON.stringify(created))
  await upload(created.uploads.photos.p1, files.photo)
  await upload(created.uploads.og, files.og)
  if (options.cover) await upload(created.uploads.cover, cover)
  let slug = ''
  if (options.publish !== false) {
    const published = await call('POST', `/letters/${created.id}/publish`, created.editToken)
    assertEquals(published.status, 200, JSON.stringify(published.body))
    slug = published.body.slug
  }
  return { id: created.id as string, token: created.editToken as string, slug }
}

async function cleanup(authorization = `Bearer ${SECRET}`) {
  const response = await fetch(`${API}/functions/v1/cleanup`, {
    method: 'POST',
    headers: { authorization },
  })
  return { status: response.status, body: await response.json() }
}

const assetKinds = async (id: string) =>
  ((await admin().from('letter_assets').select('kind').eq('letter_id', id)).data ?? [])
    .map((row) => row.kind).sort()

const letterRow = async (id: string) =>
  (await admin().from('letters').select('*').eq('id', id).maybeSingle()).data

async function fileExists(url: string) {
  const response = await fetch(url)
  await response.body?.cancel()
  return response.ok
}

Deno.test({
  name: 'cleanup: tanpa secret key atau token ditolak',
  ignore,
  async fn() {
    assertEquals((await cleanup('')).status, 401)
    assertEquals((await cleanup(`Bearer ${KEY}`)).status, 401)
    const wrongToken = await fetch(`${API}/functions/v1/cleanup`, {
      method: 'POST',
      headers: { 'x-cleanup-token': 'salah' },
    })
    await wrongToken.body?.cancel()
    assertEquals(wrongToken.status, 401)
  },
})

Deno.test({
  name: 'cleanup: foto dihapus 7 hari setelah dibuka, OG ilustrasi tetap',
  ignore,
  async fn() {
    const sent = await letter()
    await call('POST', `/l/${sent.slug}/open`)
    const before = await call('GET', `/l/${sent.slug}`)
    const photoUrl = before.body.photos.p1.url
    assertEquals(before.body.photosDeletedAt, null)

    const expiredAt = ago(HOUR)
    await admin().from('letters').update({ photos_expire_at: expiredAt }).eq('id', sent.id)

    // Sebelum job jalan: foto sudah tidak dikembalikan, berkasnya masih ada.
    const hidden = await call('GET', `/l/${sent.slug}`)
    assertEquals(hidden.body.photos, {})
    assertEquals(Date.parse(hidden.body.photosDeletedAt), Date.parse(expiredAt))
    assert(hidden.body.og !== null, 'gambar OG ilustrasi tidak ikut dihapus')
    assert(await fileExists(photoUrl))

    const result = await cleanup()
    assertEquals(result.status, 200, JSON.stringify(result.body))
    assert(result.body.photos >= 1)
    assertEquals(await assetKinds(sent.id), ['og'])
    assert((await letterRow(sent.id))?.photos_deleted_at)
    assert(!(await fileExists(photoUrl)), 'berkas foto sudah dihapus dari Storage')

    const after = await call('GET', `/l/${sent.slug}`)
    assertEquals([after.status, after.body.photos, after.body.cover], [200, {}, null])
    assert(after.body.photosDeletedAt)
    assert(await fileExists(after.body.og.url))

    assertEquals((await call('DELETE', `/letters/${sent.id}`, sent.token)).status, 204)
  },
})

Deno.test({
  name: 'cleanup: gambar depan foto user ikut menghapus cover dan OG',
  ignore,
  async fn() {
    const sent = await letter({ cover: true })
    await call('POST', `/l/${sent.slug}/open`)
    const before = await call('GET', `/l/${sent.slug}`)
    assert(before.body.cover && before.body.og)
    await admin().from('letters').update({ photos_expire_at: ago(HOUR) }).eq('id', sent.id)

    const hidden = await call('GET', `/l/${sent.slug}`)
    assertEquals([hidden.body.photos, hidden.body.cover, hidden.body.og], [{}, null, null])

    assertEquals((await cleanup()).status, 200)
    assertEquals(await assetKinds(sent.id), [])
    assert(!(await fileExists(before.body.cover.url)))
    assert(!(await fileExists(before.body.og.url)))

    assertEquals((await call('DELETE', `/letters/${sent.id}`, sent.token)).status, 204)
  },
})

Deno.test({
  name: 'cleanup: surat lewat 30 hari dan draf lewat 24 jam dihapus beserta berkasnya',
  ignore,
  async fn() {
    const old = await letter()
    const before = await call('GET', `/l/${old.slug}`)
    await admin().from('letters').update({ published_at: ago(31 * DAY), expires_at: ago(DAY) })
      .eq('id', old.id)
    assertEquals((await call('GET', `/l/${old.slug}`)).status, 404)

    const draft = await letter({ publish: false })
    await admin().from('letters').update({ draft_expires_at: ago(HOUR) }).eq('id', draft.id)
    // Draf yang baru saja kedaluwarsa diberi waktu, siapa tahu sedang di-publish.
    const fresh = await letter({ publish: false })
    await admin().from('letters').update({ draft_expires_at: ago(60_000) }).eq('id', fresh.id)

    const result = await cleanup()
    assertEquals(result.status, 200, JSON.stringify(result.body))
    assert(result.body.letters >= 1 && result.body.drafts >= 1)
    assertEquals(await letterRow(old.id), null)
    assertEquals(await assetKinds(old.id), [])
    assert(!(await fileExists(before.body.photos.p1.url)))
    assert(!(await fileExists(before.body.og.url)))
    assertEquals(await letterRow(draft.id), null)
    assertEquals(await assetKinds(draft.id), [])
    assert(await letterRow(fresh.id), 'draf dalam masa tenggang tetap ada')

    assertEquals((await call('DELETE', `/letters/${fresh.id}`, fresh.token)).status, 204)
  },
})

Deno.test({
  name: 'cleanup: berkas momen yang dihapus dan berkas user yang dihapus ikut dibersihkan',
  ignore,
  async fn() {
    // Dua user Pocket yang login, masing-masing satu momen dengan berkasnya.
    const users = []
    for (const name of ['aktif', 'pergi']) {
      const email = `uji-${name}-${crypto.randomUUID()}@example.com`
      const password = crypto.randomUUID()
      const created = await admin().auth.admin.createUser({ email, password, email_confirm: true })
      assert(!created.error, created.error?.message)
      const client = createClient(API, KEY, { auth: { persistSession: false } })
      const session = await client.auth.signInWithPassword({ email, password })
      assert(!session.error, session.error?.message)
      const owner = created.data.user!.id
      const id = crypto.randomUUID()
      const file = jpeg(400, 300)
      const row = await client.from('moments').insert({
        id,
        day: '2026-10-14',
        taken_at: new Date().toISOString(),
        source: 'upload',
        width: 400,
        height: 300,
        mime: 'image/jpeg',
        size: file.length,
      })
      assert(!row.error, row.error?.message)
      const path = `${owner}/${id}.jpg`
      const uploaded = await client.storage.from('moments').upload(path, file, {
        contentType: 'image/jpeg',
      })
      assert(!uploaded.error, uploaded.error?.message)
      users.push({ client, owner, id, path })
    }
    const [active, gone] = users as [typeof users[0], typeof users[0]]
    const exists = async (path: string) =>
      !(await admin().storage.from('moments').download(path)).error

    // Momen kedua milik user aktif dihapus dari browser (deleted_at), user kedua menghapus akun.
    const second = crypto.randomUUID()
    const file = jpeg(400, 300)
    assert(
      !(await active.client.from('moments').insert({
        id: second,
        day: '2026-10-14',
        taken_at: new Date().toISOString(),
        source: 'booth',
        width: 400,
        height: 300,
        mime: 'image/jpeg',
        size: file.length,
      })).error,
    )
    const secondPath = `${active.owner}/${second}.jpg`
    assert(
      !(await active.client.storage.from('moments').upload(secondPath, file, {
        contentType: 'image/jpeg',
      })).error,
    )
    assert(
      !(await active.client.from('moments').update({ deleted_at: new Date().toISOString() })
        .eq('id', second)).error,
    )
    assert(!(await admin().auth.admin.deleteUser(gone.owner)).error)

    const result = await cleanup()
    assertEquals(result.status, 200, JSON.stringify(result.body))
    assert(result.body.momentFiles >= 2, JSON.stringify(result.body))
    assert(await exists(active.path), 'berkas momen aktif tetap ada')
    assert(!(await exists(secondPath)), 'berkas momen yang dihapus sudah hilang')
    assert(!(await exists(gone.path)), 'berkas user yang dihapus sudah hilang')
    // Baris berstatus hapus tetap ada sampai 30 hari, supaya sampai ke perangkat lain.
    const kept = await admin().from('moments').select('deleted_at').eq('id', second).single()
    assert(kept.data?.deleted_at)

    await admin().storage.from('moments').remove([active.path])
    await admin().auth.admin.deleteUser(active.owner)
  },
})
