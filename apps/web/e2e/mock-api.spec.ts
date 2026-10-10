import { expect, test, type APIRequestContext } from '@playwright/test'

// Mock API surat (server/routes/mock-api) harus berperilaku seperti docs/api/openapi.yaml,
// supaya UI yang dibangun di atasnya langsung cocok dengan backend.

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

test('kunci foto yang tidak cocok ditolak dengan photo_mismatch', async ({ request }) => {
  const response = await create(request, { photos: [] })
  expect(response.status()).toBe(422)
  expect((await response.json()).error.code).toBe('photo_mismatch')
})

test('cover wajib untuk gambar depan foto user', async ({ request }) => {
  const response = await create(request, {
    design: { ...design, illustration: 'upload', foilMode: 'detail' },
  })
  expect((await response.json()).error.code).toBe('cover_mismatch')
})

test('publish menolak token salah dan berkas yang belum diunggah', async ({ request }) => {
  const created = await (await create(request, {})).json()
  const wrong = await request.post(`/mock-api/letters/${created.id}/publish`, {
    headers: { 'x-edit-token': 'salah' },
  })
  expect(wrong.status()).toBe(401)
  expect((await wrong.json()).error.code).toBe('unauthorized')

  const early = await request.post(`/mock-api/letters/${created.id}/publish`, {
    headers: { 'x-edit-token': created.editToken },
  })
  expect(early.status()).toBe(422)
  expect((await early.json()).error.code).toBe('upload_missing')
})

test('upload, publish dua kali, buka, dan hapus', async ({ request }) => {
  const created = await (await create(request, {})).json()
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
  const { slug } = await first.json()
  const again = await request.post(`/mock-api/letters/${created.id}/publish`, { headers })
  expect(again.status()).toBe(409)
  expect((await again.json()).slug).toBe(slug)

  const letter = await (await request.get(`/mock-api/l/${slug}`)).json()
  expect(letter.openedAt).toBeNull()
  expect(Object.keys(letter.photos)).toEqual(['f1'])
  expect((await request.get(letter.photos.f1.url)).ok()).toBe(true)

  const opened = await (await request.post(`/mock-api/l/${slug}/open`)).json()
  expect(opened.openedAt).toBeTruthy()

  const removed = await request.delete(`/mock-api/letters/${created.id}`, { headers })
  expect(removed.status()).toBe(204)
  const gone = await request.get(`/mock-api/l/${slug}`)
  expect(gone.status()).toBe(404)
  expect((await gone.json()).error.code).toBe('not_found')
})
