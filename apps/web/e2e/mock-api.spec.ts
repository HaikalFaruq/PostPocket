import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'
import { compileContract, contractDetails } from '../server/utils/contract'

// Mock API surat (server/routes/mock-api) harus berperilaku seperti docs/api/openapi.yaml,
// supaya UI yang dibangun di atasnya langsung cocok dengan backend. Setiap respons dicek dengan
// skema kontrak itu sendiri.

const schemas = compileContract(
  readFileSync(new URL('../../../docs/api/openapi.yaml', import.meta.url), 'utf8'),
)

/** Body respons, setelah dipastikan sesuai skema `name` di kontrak. */
async function contract(response: APIResponse, name: string) {
  const body = await response.json()
  const validate = schemas(name)
  const valid = validate(body)
  expect(contractDetails(validate.errors), name).toEqual([])
  expect(valid).toBe(true)
  return body
}

const design = {
  illustration: 'meadow',
  shape: 'portrait',
  foilMode: 'design',
  foilBorder: false,
  foilColor: 'gold',
  paper: 'cream',
  template: 'photo-1',
}
const photoElement = {
  kind: 'photo',
  id: 'p1',
  x: 0.5,
  y: 0.35,
  width: 0.74,
  rotation: -2,
  photo: 'f1',
  aspect: 1.25,
}
const og = { type: 'image/jpeg', width: 1200, height: 630, size: 4 }

async function create(request: APIRequestContext, body: Record<string, unknown>) {
  return request.post('/mock-api/letters', {
    data: {
      design,
      content: { version: 1, elements: [photoElement] },
      cover: null,
      photos: [{ key: 'f1', type: 'image/jpeg', width: 800, height: 600, size: 3 }],
      og,
      replyTo: null,
      ...body,
    },
  })
}

test.describe.configure({ mode: 'serial' })
test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'Tes API tanpa browser, cukup sekali')
})

test('body yang tidak sesuai skema ditolak 400 beserta lokasi field-nya', async ({ request }) => {
  const response = await create(request, {
    content: { version: 1, elements: [{ ...photoElement, color: 'red' }] },
  })
  expect(response.status()).toBe(400)
  const { error } = await contract(response, 'Error')
  expect(error.code).toBe('invalid_content')
  expect(error.details).toContainEqual({
    path: 'content.elements[0].color',
    message: 'must NOT have unevaluated properties',
  })
})

test('kunci foto yang tidak cocok ditolak dengan photo_mismatch', async ({ request }) => {
  const response = await create(request, { photos: [] })
  expect(response.status()).toBe(422)
  expect((await contract(response, 'Error')).error.code).toBe('photo_mismatch')
})

test('cover wajib untuk gambar depan foto user', async ({ request }) => {
  const response = await create(request, {
    design: { ...design, illustration: 'upload', foilMode: 'detail' },
  })
  expect((await contract(response, 'Error')).error.code).toBe('cover_mismatch')
})

test('publish menolak token salah dan berkas yang belum diunggah', async ({ request }) => {
  const created = await contract(await create(request, {}), 'CreateLetterResponse')
  const wrong = await request.post(`/mock-api/letters/${created.id}/publish`, {
    headers: { 'x-edit-token': 'salah' },
  })
  expect(wrong.status()).toBe(401)
  expect((await contract(wrong, 'Error')).error.code).toBe('unauthorized')

  const early = await request.post(`/mock-api/letters/${created.id}/publish`, {
    headers: { 'x-edit-token': created.editToken },
  })
  expect(early.status()).toBe(422)
  expect((await contract(early, 'Error')).error.code).toBe('upload_missing')
})

test('upload, publish dua kali, buka, dan hapus', async ({ request }) => {
  const created = await contract(await create(request, {}), 'CreateLetterResponse')
  const headers = { 'x-edit-token': created.editToken }
  for (const [target, bytes] of [
    [created.uploads.photos.f1, 'abc'],
    [created.uploads.og, 'abcd'],
  ] as const) {
    const upload = await request.put(target.signedUrl, {
      headers: { 'content-type': 'image/jpeg' },
      data: Buffer.from(bytes),
    })
    expect(upload.ok()).toBe(true)
  }
  const first = await request.post(`/mock-api/letters/${created.id}/publish`, { headers })
  expect(first.status()).toBe(200)
  const { slug } = await contract(first, 'PublishLetterResponse')
  const again = await request.post(`/mock-api/letters/${created.id}/publish`, { headers })
  expect(again.status()).toBe(409)
  expect((await contract(again, 'PublishLetterResponse')).slug).toBe(slug)

  const letter = await contract(await request.get(`/mock-api/l/${slug}`), 'Letter')
  expect(letter.openedAt).toBeNull()
  expect(Object.keys(letter.photos)).toEqual(['f1'])
  expect((await request.get(letter.photos.f1.url)).ok()).toBe(true)

  const opened = await contract(
    await request.post(`/mock-api/l/${slug}/open`),
    'OpenLetterResponse',
  )
  expect(opened.openedAt).toBeTruthy()

  const removed = await request.delete(`/mock-api/letters/${created.id}`, { headers })
  expect(removed.status()).toBe(204)
  const gone = await request.get(`/mock-api/l/${slug}`)
  expect(gone.status()).toBe(404)
  expect((await contract(gone, 'Error')).error.code).toBe('not_found')
})

test('og wajib untuk surat biasa dan harus kosong untuk surat titipan', async ({ request }) => {
  const missing = await create(request, { og: null })
  expect(missing.status()).toBe(422)
  expect((await contract(missing, 'Error')).error.code).toBe('og_mismatch')
})

test('kotak bareng: buat, titip, buka, dan hapus sesuai kontrak 0.3.0', async ({ request }) => {
  const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const invalid = await request.post('/mock-api/boxes', {
    data: { title: 'Ultah', to: 'Rani', design: 'par-avion', opensAt: '2020-01-01T00:00:00Z' },
  })
  expect(invalid.status()).toBe(422)
  expect((await contract(invalid, 'Error')).error.code).toBe('invalid_box')
  const shapeless = await request.post('/mock-api/boxes', { data: { title: '', to: 'Rani' } })
  expect(shapeless.status()).toBe(400)
  expect((await contract(shapeless, 'Error')).error.code).toBe('invalid_request')

  const createdResponse = await request.post('/mock-api/boxes', {
    data: { title: '  Ultah ke-20 Rani  ', to: 'Rani', design: 'emas', opensAt: soon },
  })
  expect(createdResponse.status()).toBe(201)
  const box = await contract(createdResponse, 'CreateBoxResponse')
  expect(box).toMatchObject({ title: 'Ultah ke-20 Rani', scheduled: true, usage: { letters: 0 } })
  const headers = { 'x-edit-token': box.editToken }
  expect((await request.get(`/mock-api/boxes/${box.id}`)).status()).toBe(401)
  await contract(await request.get(`/mock-api/boxes/${box.id}`, { headers }), 'OrganizerBox')
  const invite = await contract(
    await request.get(`/mock-api/boxes/invite/${box.invite}`),
    'BoxInvite',
  )
  expect(invite).toMatchObject({ closed: false, to: 'Rani' })

  // Surat titipan: tanpa OG, link-nya link titip, dan tidak bisa dibuka lewat /l/.
  const titip = { invite: box.invite, from: 'Budi' }
  const withOg = await create(request, { box: titip })
  expect((await contract(withOg, 'Error')).error.code).toBe('og_mismatch')
  const asReply = await create(request, { box: titip, og: null, replyTo: 'x7Kp2qLm9A' })
  expect((await contract(asReply, 'Error')).error.code).toBe('invalid_box')
  const created = await contract(
    await create(request, { box: titip, og: null }),
    'CreateLetterResponse',
  )
  expect(created.uploads.og).toBeNull()
  await request.put(created.uploads.photos.f1.signedUrl, {
    headers: { 'content-type': 'image/jpeg' },
    data: Buffer.from('abc'),
  })
  const published = await contract(
    await request.post(`/mock-api/letters/${created.id}/publish`, {
      headers: { 'x-edit-token': created.editToken },
    }),
    'PublishLetterResponse',
  )
  expect(published.url).toBe(box.inviteUrl)
  expect(published.box).toMatchObject({ title: 'Ultah ke-20 Rani', to: 'Rani', scheduled: true })
  expect((await request.get(`/mock-api/l/${published.slug}`)).status()).toBe(404)

  // Sebelum dibuka: isinya belum dikirim dan belum bisa ditandai dibuka.
  const sealed = await contract(await request.get(`/mock-api/k/${box.slug}`), 'Box')
  expect(sealed).toMatchObject({ openable: false, letterCount: 1, letters: [] })
  const early = await request.post(`/mock-api/k/${box.slug}/open`)
  expect(early.status()).toBe(409)
  expect((await contract(early, 'Error')).error.code).toBe('box_not_open')

  // Jadwal di masa lalu dan jadwal bersamaan dengan Buka sekarang ditolak.
  const past = await request.patch(`/mock-api/boxes/${box.id}`, {
    headers,
    data: { opensAt: '2020-01-01T00:00:00.000Z' },
  })
  expect((await contract(past, 'Error')).error.code).toBe('invalid_box')
  const both = await request.patch(`/mock-api/boxes/${box.id}`, {
    headers,
    data: { openNow: true, opensAt: soon },
  })
  expect((await contract(both, 'Error')).error.code).toBe('invalid_box')
  // Draf titipan yang belum terbit tidak menghitung batas, dan ikut terhapus bersama kotaknya.
  const draft = await contract(
    await create(request, { box: { invite: box.invite, from: 'Sari' }, og: null }),
    'CreateLetterResponse',
  )

  // Buka sekarang (jam server), lalu penerima membacanya.
  const openNow = await contract(
    await request.patch(`/mock-api/boxes/${box.id}`, { headers, data: { openNow: true } }),
    'OrganizerBox',
  )
  expect(openNow).toMatchObject({ openable: true, scheduled: true })
  expect(openNow.usage).toEqual({ letters: 1, photos: 1 })
  const recipient = await contract(await request.get(`/mock-api/k/${box.slug}`), 'Box')
  expect(recipient.openable).toBe(true)
  expect(recipient.letters.map((item: { from: string }) => item.from)).toEqual(['Budi'])
  await contract(await request.post(`/mock-api/k/${box.slug}/open`), 'OpenLetterResponse')
  const closed = await request.patch(`/mock-api/boxes/${box.id}`, {
    headers,
    data: { title: 'Ganti' },
  })
  expect(closed.status()).toBe(409)
  expect((await contract(closed, 'Error')).error.code).toBe('box_closed')
  const late = await create(request, { box: titip, og: null })
  expect((await contract(late, 'Error')).error.code).toBe('box_closed')

  // Foto kotak dihapus job: placeholder, seperti surat biasa.
  await request.post(`/mock-api/_test/k/${box.slug}/hapus-foto`)
  const cleaned = await contract(await request.get(`/mock-api/k/${box.slug}`), 'Box')
  expect(cleaned.photosDeletedAt).toBeTruthy()
  expect(cleaned.letters[0].photos).toEqual({})
  const organizer = await contract(
    await request.get(`/mock-api/boxes/${box.id}`, { headers }),
    'OrganizerBox',
  )
  expect(organizer.photosDeletedAt).toBe(cleaned.photosDeletedAt)

  // Slug surat titipan tidak bisa dibalas, sama seperti tidak bisa dibuka lewat /l/.
  const reply = await create(request, { replyTo: published.slug })
  expect((await contract(reply, 'Error')).error.code).toBe('reply_not_found')

  // Pembuat menghapus titipan, lalu kotaknya.
  const entry = await request.delete(`/mock-api/boxes/${box.id}/letters/${created.id}`, {
    headers,
  })
  expect(entry.status()).toBe(204)
  expect((await request.delete(`/mock-api/boxes/${box.id}`, { headers })).status()).toBe(204)
  const gone = await request.get(`/mock-api/k/${box.slug}`)
  expect(gone.status()).toBe(404)
  expect((await contract(gone, 'Error')).error.code).toBe('box_not_found')
  const orphan = await request.post(`/mock-api/letters/${draft.id}/publish`, {
    headers: { 'x-edit-token': draft.editToken },
  })
  expect(orphan.status()).toBe(404)
})
