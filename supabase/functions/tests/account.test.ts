// Test integrasi DELETE /account (kontrak 0.4.0) terhadap stack Supabase lokal. Butuh secret key
// untuk membuat user tes dan memeriksa Storage, jadi hanya untuk stack lokal:
//
//   API_URL=http://127.0.0.1:54321 PUBLISHABLE_KEY=… SECRET_KEY=… deno test -A tests/account.test.ts
//
// Tanpa SECRET_KEY test ini dilewati.

import { assert, assertEquals } from '@std/assert'
import { createClient } from '@supabase/supabase-js'
import { jpeg } from './fixtures.ts'

const API = Deno.env.get('API_URL') ?? ''
const KEY = Deno.env.get('PUBLISHABLE_KEY') ?? ''
const SECRET = Deno.env.get('SECRET_KEY') ?? ''
const ignore = !API || !SECRET

const admin = () => createClient(API, SECRET, { auth: { persistSession: false } })

async function remove(headers: Record<string, string>) {
  const response = await fetch(`${API}/functions/v1/account`, { method: 'DELETE', headers })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

/** User Pocket yang login, dengan `count` momen beserta berkasnya, satu pocket, dan satu album. */
async function pocketUser(count: number) {
  const email = `uji-akun-${crypto.randomUUID()}@example.com`
  const password = crypto.randomUUID()
  const created = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  assert(!created.error, created.error?.message)
  const client = createClient(API, KEY, { auth: { persistSession: false } })
  const session = await client.auth.signInWithPassword({ email, password })
  assert(!session.error, session.error?.message)
  const id = created.data.user!.id
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const moment = crypto.randomUUID()
    const file = jpeg(40, 30)
    const row = await client.from('moments').insert({
      id: moment,
      day: '2026-10-15',
      taken_at: new Date().toISOString(),
      source: 'upload',
      width: 40,
      height: 30,
      mime: 'image/jpeg',
      size: file.length,
    })
    assert(!row.error, row.error?.message)
    const uploaded = await client.storage.from('moments').upload(`${id}/${moment}.jpg`, file, {
      contentType: 'image/jpeg',
    })
    assert(!uploaded.error, uploaded.error?.message)
    ids.push(moment)
  }
  const pocket = await client.from('pockets').insert({
    day: '2026-10-15',
    packet: 'kraft',
    sticker: 'bintang',
    frame: 'polos',
    frame_color: '#ffffff',
    moment_ids: ids,
    saved_at: new Date().toISOString(),
  })
  assert(!pocket.error, pocket.error?.message)
  const album = await client.from('albums').insert({
    id: crypto.randomUUID(),
    title: 'Uji',
    emoji: '📀',
    color: '#336699',
    moment_ids: ids,
  })
  assert(!album.error, album.error?.message)
  return { id, client, token: session.data.session!.access_token }
}

const files = async (id: string) =>
  ((await admin().storage.from('moments').list(id, { limit: 1000 })).data ?? []).length
const rows = async (table: string, column: string, id: string) =>
  (await admin().from(table).select('*', { count: 'exact', head: true }).eq(column, id)).count

Deno.test({
  name: 'account: hapus akun menghapus berkas, baris, dan akunnya, akun lain tidak tersentuh',
  ignore,
  async fn() {
    const leaving = await pocketUser(3)
    const staying = await pocketUser(1)
    assertEquals(await files(leaving.id), 3)

    const result = await remove({ apikey: KEY, authorization: `Bearer ${leaving.token}` })
    assertEquals(result.status, 204, JSON.stringify(result.body))

    assertEquals(await files(leaving.id), 0)
    for (const table of ['moments', 'pockets', 'albums']) {
      assertEquals(await rows(table, 'owner_id', leaving.id), 0, table)
    }
    assertEquals(await rows('profiles', 'id', leaving.id), 0)
    assertEquals((await admin().auth.admin.getUserById(leaving.id)).data.user, null)

    // Mengulang dengan token yang sama: akunnya sudah tidak ada.
    const again = await remove({ apikey: KEY, authorization: `Bearer ${leaving.token}` })
    assertEquals(again.status, 401)
    assertEquals(again.body.error.code, 'unauthorized')

    assertEquals(await files(staying.id), 1)
    assertEquals(await rows('moments', 'owner_id', staying.id), 1)
    assert((await admin().auth.admin.getUserById(staying.id)).data.user)
    await admin().storage.from('moments').remove(
      (await admin().storage.from('moments').list(staying.id)).data!.map((file) =>
        `${staying.id}/${file.name}`
      ),
    )
    await admin().auth.admin.deleteUser(staying.id)
  },
})

Deno.test({
  name: 'account: tanpa sesi yang sah 401, tanpa publishable key 401',
  ignore,
  async fn() {
    const user = await pocketUser(0)
    const cases: Record<string, string>[] = [
      { apikey: KEY },
      { apikey: KEY, authorization: `Bearer ${KEY}` },
      { apikey: KEY, authorization: 'Bearer bukan.token.sah' },
      { apikey: KEY, authorization: user.token },
      { authorization: `Bearer ${user.token}` },
    ]
    for (const headers of cases) {
      const result = await remove(headers)
      assertEquals(result.status, 401, JSON.stringify(Object.keys(headers)))
      assertEquals(result.body.error.code, 'unauthorized')
    }
    assert((await admin().auth.admin.getUserById(user.id)).data.user, 'akun tetap ada')

    const other = await fetch(`${API}/functions/v1/account`, {
      method: 'POST',
      headers: { apikey: KEY, authorization: `Bearer ${user.token}` },
    })
    await other.body?.cancel()
    assertEquals(other.status, 404)
    assert((await admin().auth.admin.getUserById(user.id)).data.user, 'akun tetap ada')
    await admin().auth.admin.deleteUser(user.id)
  },
})
