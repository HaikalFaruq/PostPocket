import { defaultLetterDesign, normalizeContent } from '@postpocket/presets'
import { describe, expect, it } from 'vitest'
import type { Letter } from '../app/utils/letter-api'
import { letterFront, shownFromApi, shownFromBox } from '../app/utils/letter-view'

const letter: Letter = {
  slug: 'x7Kp2qLm9A',
  design: { ...defaultLetterDesign, illustration: 'upload' },
  content: normalizeContent({ elements: [] }),
  cover: { url: 'https://contoh.test/c.jpg', width: 600, height: 800 },
  photos: { f1: { url: 'https://contoh.test/1.jpg', width: 800, height: 600 } },
  og: null,
  replyTo: null,
  publishedAt: '2026-10-14T03:00:00.000Z',
  expiresAt: '2026-11-13T03:00:00.000Z',
  openedAt: null,
  photosExpireAt: null,
  photosDeletedAt: null,
}

describe('shownFromApi', () => {
  it('memakai URL foto dari server tanpa nama pengirim', () => {
    expect(shownFromApi(letter)).toEqual({
      id: letter.slug,
      from: null,
      design: letter.design,
      content: letter.content,
      cover: letter.cover,
      photoUrls: { f1: 'https://contoh.test/1.jpg' },
      photoPlaceholder: undefined,
    })
  })

  it('slot foto diberi keterangan setelah fotonya dihapus', () => {
    const shown = shownFromApi({
      ...letter,
      cover: null,
      photos: {},
      photosDeletedAt: '2026-10-21T03:00:00.000Z',
    })
    expect(shown.photoPlaceholder).toBe('Foto sudah dihapus')
    expect(shown.photoUrls).toEqual({})
  })
})

describe('shownFromBox', () => {
  const titipan = {
    id: '00000000-0000-4000-8000-000000000001',
    from: 'Budi',
    design: letter.design,
    content: letter.content,
    cover: letter.cover,
    photos: letter.photos,
    publishedAt: letter.publishedAt,
  }

  it('membawa nama pengirim, dan placeholder setelah foto kotak dihapus', () => {
    expect(shownFromBox(titipan, false)).toMatchObject({
      id: titipan.id,
      from: 'Budi',
      photoUrls: { f1: 'https://contoh.test/1.jpg' },
      photoPlaceholder: undefined,
    })
    expect(shownFromBox({ ...titipan, photos: {} }, true).photoPlaceholder).toBe(
      'Foto sudah dihapus',
    )
  })
})

describe('letterFront', () => {
  it('ilustrasi dari preset, atau foto depan dari user', () => {
    expect(letterFront(defaultLetterDesign, null)).toMatch(/^\/illustrations\//)
    expect(letterFront({ ...defaultLetterDesign, illustration: 'upload' }, 'blob:x')).toBe('blob:x')
    expect(letterFront({ ...defaultLetterDesign, illustration: 'upload' }, null)).toBeNull()
  })
})
