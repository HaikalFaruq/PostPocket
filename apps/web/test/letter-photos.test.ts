import { describe, expect, it, vi } from 'vitest'
import {
  PhotoFetchError,
  exportMethod,
  fetchPhoto,
  photoFileName,
} from '../app/utils/letter-photos'

const photo = { url: 'https://contoh.test/a.jpg', width: 800, height: 600 }
const respond = (status: number, body = 'abc') =>
  vi.fn(
    async () =>
      new Response(status === 204 ? null : body, {
        status,
        headers: { 'content-type': 'image/jpeg' },
      }),
  )

describe('fetchPhoto', () => {
  it('mengembalikan foto beserta ukurannya', async () => {
    const run = respond(200)
    const result = await fetchPhoto(photo, run)
    expect(result?.width).toBe(800)
    expect(result?.height).toBe(600)
    expect(await result?.blob.text()).toBe('abc')
    expect(run).toHaveBeenCalledWith(photo.url, { mode: 'cors', credentials: 'omit' })
  })

  it.each([404, 410, 400])('foto yang sudah dihapus (HTTP %i) jadi null', async (status) => {
    expect(await fetchPhoto(photo, respond(status))).toBeNull()
  })

  it('error server dan koneksi putus dilempar', async () => {
    await expect(fetchPhoto(photo, respond(503))).rejects.toBeInstanceOf(PhotoFetchError)
    await expect(
      fetchPhoto(photo, async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(PhotoFetchError)
  })
})

describe('photoFileName', () => {
  it('nama berkas aman dan berurutan', () => {
    expect(photoFileName('surat x7Kp2qLm9A', 0, 'image/jpeg')).toBe(
      'postpocket-surat-x7kp2qlm9a-1.jpg',
    )
    expect(photoFileName('Ultah Ráni 🎂', 2, 'image/webp')).toBe('postpocket-ultah-rani-3.webp')
    expect(photoFileName('!!!', 0, 'image/png')).toBe('postpocket-surat-1.png')
  })
})

describe('exportMethod', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/141.0'

  it('iPhone dan iPad memakai lembar Bagikan supaya foto masuk app Foto', () => {
    expect(exportMethod({ userAgent: iphone, maxTouchPoints: 5, canShareFiles: true })).toBe(
      'share',
    )
    expect(exportMethod({ userAgent: ipad, maxTouchPoints: 5, canShareFiles: true })).toBe('share')
  })

  it('selain itu, atau kalau berkas tidak bisa dibagikan, diunduh biasa', () => {
    expect(exportMethod({ userAgent: iphone, maxTouchPoints: 5, canShareFiles: false })).toBe(
      'download',
    )
    expect(exportMethod({ userAgent: android, maxTouchPoints: 5, canShareFiles: true })).toBe(
      'download',
    )
    expect(exportMethod({ userAgent: ipad, maxTouchPoints: 0, canShareFiles: true })).toBe(
      'download',
    )
  })
})
