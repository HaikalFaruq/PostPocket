import { byId, defaultLetterDesign, letter } from '@postpocket/presets'
import { describe, expect, it } from 'vitest'
import {
  MESSAGE_LIMIT,
  PHOTO_FRONT,
  cardRatio,
  emptyDraft,
  normalizeDraft,
  startingContent,
} from '../app/utils/letter-draft'

const photo = { blob: new Blob(['x'], { type: 'image/jpeg' }), width: 400, height: 300 }
const stored = (text: string) => ({
  bytes: new TextEncoder().encode(text).buffer as ArrayBuffer,
  type: 'image/jpeg',
  width: 800,
  height: 600,
})
const textOf = (draft: ReturnType<typeof normalizeDraft>) =>
  draft.content.elements.find((e) => e.kind === 'text')

describe('normalizeDraft', () => {
  it('data kosong atau rusak jadi draf bawaan', () => {
    expect(normalizeDraft(undefined)).toEqual(emptyDraft())
    expect(normalizeDraft('rusak')).toEqual(emptyDraft())
    expect(normalizeDraft({ design: 5 }).design).toEqual(defaultLetterDesign)
  })

  it('draf bawaan sudah berisi slot template', () => {
    const draft = emptyDraft()
    expect(draft.version).toBe(2)
    expect(draft.content.elements.map((e) => e.kind)).toEqual(['text'])
  })

  it('mempertahankan pilihan yang masih ada di preset', () => {
    const draft = normalizeDraft({
      design: { ...defaultLetterDesign, paper: 'navy', foilColor: 'holo', shape: 'square' },
      updatedAt: 5,
    })
    expect(draft.design.paper).toBe('navy')
    expect(draft.design.foilColor).toBe('holo')
    expect(draft.design.shape).toBe('square')
    expect(draft.updatedAt).toBe(5)
  })

  it('id preset yang sudah dihapus diganti bawaan', () => {
    const draft = normalizeDraft({ design: { paper: 'kertas-lama', foilColor: 'emas-lama' } })
    expect(draft.design.paper).toBe(defaultLetterDesign.paper)
    expect(draft.design.foilColor).toBe(defaultLetterDesign.foilColor)
  })

  it('foto sebagai gambar depan tidak memakai mode Sesuai desain', () => {
    const draft = normalizeDraft({
      design: { ...defaultLetterDesign, illustration: PHOTO_FRONT, foilMode: 'design' },
      photo,
    })
    expect(draft.photo).toEqual(photo)
    expect(draft.photo?.blob).toBe(photo.blob)
    expect(draft.design.illustration).toBe(PHOTO_FRONT)
    expect(draft.design.foilMode).toBe('detail')
  })

  it('foto tersimpan sebagai byte mentah dipulihkan jadi Blob', async () => {
    const draft = normalizeDraft({
      design: { ...defaultLetterDesign, illustration: PHOTO_FRONT },
      photo: stored('jpeg'),
    })
    expect(draft.design.illustration).toBe(PHOTO_FRONT)
    expect(draft.photo?.width).toBe(800)
    expect(draft.photo?.blob.type).toBe('image/jpeg')
    expect(await draft.photo?.blob.text()).toBe('jpeg')
  })

  it('foto dengan ukuran tidak masuk akal diabaikan', () => {
    const draft = normalizeDraft({ photo: { blob: photo.blob, width: 0, height: 10 } })
    expect(draft.photo).toBeNull()
  })

  it('foto tetap disimpan walau gambar depannya ilustrasi', () => {
    const draft = normalizeDraft({
      design: { ...defaultLetterDesign, illustration: 'night' },
      photo,
    })
    expect(draft.photo).toEqual(photo)
    expect(draft.design.illustration).toBe('night')
    expect(draft.design.foilMode).toBe(defaultLetterDesign.foilMode)
  })

  it('foto yang hilang mengembalikan gambar depan ke ilustrasi', () => {
    const draft = normalizeDraft({ design: { ...defaultLetterDesign, illustration: PHOTO_FRONT } })
    expect(draft.photo).toBeNull()
    expect(draft.design.illustration).toBe(defaultLetterDesign.illustration)
  })

  it('draf versi 1 memindah isi surat ke blok teks template', () => {
    const draft = normalizeDraft({
      version: 1,
      design: { ...defaultLetterDesign, template: 'photo-1' },
      message: 'Halo dari draf lama',
    })
    expect(draft.version).toBe(2)
    expect(draft.content.elements.map((e) => e.kind)).toEqual(['photo', 'text'])
    expect(textOf(draft)).toMatchObject({ text: 'Halo dari draf lama' })
  })

  it('isi surat dari draf versi 1 dipotong sesuai batas', () => {
    const draft = normalizeDraft({ message: 'a'.repeat(MESSAGE_LIMIT + 50) })
    expect(textOf(draft)?.kind === 'text' && textOf(draft)?.text).toHaveLength(MESSAGE_LIMIT)
  })

  it('foto isi surat dipulihkan, yang hilang jadi slot kosong, yang tak dipakai dibuang', async () => {
    const content = {
      version: 1,
      elements: [
        { kind: 'photo', id: 'a', x: 0.5, y: 0.3, width: 0.5, rotation: 0, photo: 'f1', aspect: 1 },
        { kind: 'photo', id: 'b', x: 0.5, y: 0.7, width: 0.5, rotation: 0, photo: 'f2', aspect: 1 },
      ],
    }
    const draft = normalizeDraft({ content, photos: { f1: stored('satu'), lama: stored('x') } })
    expect(Object.keys(draft.photos)).toEqual(['f1'])
    expect(await draft.photos.f1?.blob.text()).toBe('satu')
    expect(draft.content.elements.map((e) => e.kind === 'photo' && e.photo)).toEqual(['f1', null])
  })
})

describe('replyTo', () => {
  it('hanya menerima slug surat yang sah', () => {
    expect(normalizeDraft({ replyTo: 'x7Kp2qLm9A' }).replyTo).toBe('x7Kp2qLm9A')
    expect(normalizeDraft({ replyTo: '../rahasia' }).replyTo).toBeNull()
    expect(normalizeDraft({}).replyTo).toBeNull()
    expect(emptyDraft().replyTo).toBeNull()
  })
})

describe('cardRatio', () => {
  it('memakai rasio bentuk, atau gambar depan untuk bentuk Asli', () => {
    const night = byId(letter.illustrations, 'night')!
    expect(cardRatio({ ...defaultLetterDesign, shape: 'square' }, photo)).toBe(1)
    expect(
      cardRatio({ ...defaultLetterDesign, shape: 'original', illustration: 'night' }, null),
    ).toBe(night.ratio)
    const fromPhoto = { ...defaultLetterDesign, shape: 'original', illustration: PHOTO_FRONT }
    expect(cardRatio(fromPhoto, photo)).toBeCloseTo(400 / 300)
  })
})

describe('startingContent', () => {
  it('mengisi blok teks pertama template', () => {
    const content = startingContent({ ...defaultLetterDesign, template: 'collage-4' }, null, 'Hai')
    expect(content.elements.filter((e) => e.kind === 'photo')).toHaveLength(4)
    expect(content.elements.find((e) => e.kind === 'text')).toMatchObject({ text: 'Hai' })
  })
})
