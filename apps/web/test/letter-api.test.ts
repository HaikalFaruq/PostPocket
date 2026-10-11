import { defaultLetterDesign, normalizeContent } from '@postpocket/presets'
import { describe, expect, it, vi } from 'vitest'
import {
  LetterApiError,
  buildCreateRequest,
  createLetterApi,
  errorMessage,
  sendLetter,
  type CreateLetterResponse,
  type LetterApi,
  type UploadImage,
} from '../app/utils/letter-api'

const image = (size: number, type = 'image/jpeg'): UploadImage => ({
  blob: new Blob([new Uint8Array(size)], { type }),
  type,
  width: 800,
  height: 600,
  size,
})

const content = normalizeContent({
  elements: [
    { kind: 'photo', id: 'a', x: 0.5, y: 0.3, width: 0.5, rotation: 0, photo: 'f2', aspect: 1 },
    { kind: 'photo', id: 'b', x: 0.5, y: 0.6, width: 0.5, rotation: 0, photo: null, aspect: 1 },
    { kind: 'text', id: 't', x: 0.5, y: 0.8, width: 0.8, rotation: 0, text: 'Halo', size: 0.06 },
    { kind: 'text', id: 'u', x: 0.5, y: 0.9, width: 0.8, rotation: 0, text: ' ', size: 0.06 },
    { kind: 'photo', id: 'c', x: 0.2, y: 0.2, width: 0.3, rotation: 0, photo: 'f1', aspect: 1 },
  ],
})

const input = {
  design: defaultLetterDesign,
  content,
  cover: null,
  photos: { f1: image(10), f2: image(20), lama: image(30) },
  og: image(40),
}

describe('buildCreateRequest', () => {
  it('membuang slot kosong dan mengirim foto sesuai urutan di content', () => {
    const request = buildCreateRequest(input)
    expect(request.content.elements.map((e) => e.id)).toEqual(['a', 't', 'c'])
    expect(request.photos.map((photo) => [photo.key, photo.size])).toEqual([
      ['f2', 20],
      ['f1', 10],
    ])
    expect(request.cover).toBeNull()
    expect(request.og).toEqual({ type: 'image/jpeg', width: 800, height: 600, size: 40 })
    expect(request.replyTo).toBeNull()
  })

  it('menyertakan cover dan replyTo kalau ada', () => {
    const request = buildCreateRequest({ ...input, cover: image(50), replyTo: 'x7Kp2qLm9A' })
    expect(request.cover).toMatchObject({ type: 'image/jpeg', size: 50 })
    expect(request.replyTo).toBe('x7Kp2qLm9A')
  })

  it('menolak content yang merujuk foto yang tidak ada', () => {
    expect(() => buildCreateRequest({ ...input, photos: { f1: image(10) } })).toThrow(
      LetterApiError,
    )
  })
})

describe('errorMessage', () => {
  it('memberi pesan untuk user, bukan pesan server', () => {
    expect(errorMessage(new LetterApiError('network', 'x'))).toContain('Koneksi')
    expect(errorMessage(new LetterApiError('rate_limited', 'x', 429, 125))).toContain('3 menit')
    expect(errorMessage(new LetterApiError('upload_invalid', 'x'))).toContain('Foto gagal')
    expect(errorMessage(new LetterApiError('invalid_content', 'detail teknis'))).not.toContain(
      'detail teknis',
    )
    expect(errorMessage(new Error('lain'))).toContain('gagal dikirim')
  })
})

describe('createLetterApi', () => {
  function respond(status: number, body?: unknown, headers: Record<string, string> = {}) {
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers })
  }

  it('mengirim apikey, JSON, dan X-Edit-Token sesuai kontrak', async () => {
    const fetch = vi.fn(async () => respond(200, { slug: 'x', url: 'u' }))
    const api = createLetterApi({ base: 'https://api.test/functions/v1/', apiKey: 'kunci', fetch })
    await api.publish('id 1', 'token')
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/functions/v1/letters/id%201/publish')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ apikey: 'kunci', 'x-edit-token': 'token' })
  })

  it('error server jadi LetterApiError dengan kode dan Retry-After', async () => {
    const fetch = vi.fn(async () =>
      respond(429, { error: { code: 'rate_limited', message: 'pelan' } }, { 'retry-after': '90' }),
    )
    const api = createLetterApi({ base: 'https://api.test', apiKey: 'k', fetch })
    const error = await api.create(buildCreateRequest(input)).catch((e) => e)
    expect(error).toBeInstanceOf(LetterApiError)
    expect(error).toMatchObject({ code: 'rate_limited', status: 429, retryAfter: 90 })
  })

  it('409 saat publish dianggap berhasil, 204 saat hapus tanpa body', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(respond(409, { slug: 'x7Kp2qLm9A', url: 'u' }))
      .mockResolvedValueOnce(respond(204))
    const api = createLetterApi({ base: 'https://api.test', apiKey: 'k', fetch })
    await expect(api.publish('id', 't')).resolves.toMatchObject({ slug: 'x7Kp2qLm9A' })
    await expect(api.remove('id', 't')).resolves.toBeUndefined()
  })

  it('409 di endpoint selain publish tetap error', async () => {
    const conflict = () => respond(409, { error: { code: 'invalid_request', message: 'bentrok' } })
    const fetch = vi.fn(async () => conflict())
    const api = createLetterApi({ base: 'https://api.test', apiKey: 'k', fetch })
    for (const request of [
      () => api.create(buildCreateRequest(input)),
      () => api.get('x7Kp2qLm9A'),
      () => api.open('x7Kp2qLm9A'),
      () => api.remove('id', 't'),
    ]) {
      await expect(request()).rejects.toMatchObject({ code: 'invalid_request', status: 409 })
    }
  })

  it('jaringan putus jadi kode network', async () => {
    const fetch = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))
    const api = createLetterApi({ base: 'https://api.test', apiKey: 'k', fetch })
    await expect(api.get('x')).rejects.toMatchObject({ code: 'network' })
  })

  it('unggah memakai PUT ke signedUrl dengan tipe berkas', async () => {
    const fetch = vi.fn(async () => respond(200, {}))
    const api = createLetterApi({ base: 'https://api.test', apiKey: 'k', fetch })
    const file = new Blob(['x'], { type: 'image/jpeg' })
    await api.upload({ path: 'a/b.jpg', token: 't', signedUrl: 'https://s.test/up?token=t' }, file)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://s.test/up?token=t')
    expect(init).toMatchObject({ method: 'PUT', body: file })
    expect(init.headers).toMatchObject({ 'content-type': 'image/jpeg' })
  })
})

describe('sendLetter', () => {
  const target = (path: string) => ({ path, token: 't', signedUrl: `https://s.test/${path}` })

  function fakeApi(uploads: Partial<CreateLetterResponse['uploads']> = {}) {
    const uploaded: string[] = []
    const api: LetterApi = {
      create: vi.fn(async () => ({
        id: 'id',
        editToken: 'token',
        draftExpiresAt: '',
        uploads: {
          cover: target('cover'),
          photos: { f1: target('f1'), f2: target('f2') },
          og: target('og'),
          ...uploads,
        },
      })),
      upload: vi.fn(async (item) => {
        uploaded.push(item.path)
      }),
      publish: vi.fn(async () => ({
        slug: 'x7Kp2qLm9A',
        url: 'u',
        publishedAt: '',
        expiresAt: '',
      })),
      get: vi.fn(),
      open: vi.fn(),
      remove: vi.fn(),
    }
    return { api, uploaded }
  }

  it('unggah cover, foto yang dipakai, dan OG, lalu terbitkan', async () => {
    const { api, uploaded } = fakeApi()
    const progress: number[] = []
    const sent = await sendLetter(api, { ...input, cover: image(5) }, (done) => progress.push(done))
    expect(uploaded.sort()).toEqual(['cover', 'f1', 'f2', 'og'])
    expect(progress).toEqual([1, 2, 3, 4])
    expect(api.publish).toHaveBeenCalledWith('id', 'token')
    expect(sent).toMatchObject({ id: 'id', editToken: 'token', slug: 'x7Kp2qLm9A' })
  })

  it('berhenti kalau server tidak memberi tujuan upload', async () => {
    const { api } = fakeApi({ photos: { f1: target('f1') } })
    await expect(sendLetter(api, input)).rejects.toMatchObject({ code: 'upload_missing' })
    expect(api.publish).not.toHaveBeenCalled()
  })
})
