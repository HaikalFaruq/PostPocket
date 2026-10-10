import { defaultLetterDesign } from '@postpocket/presets'
import { describe, expect, it } from 'vitest'
import { MESSAGE_LIMIT, PHOTO_FRONT, emptyDraft, normalizeDraft } from '../app/utils/letter-draft'

const photo = { blob: new Blob(['x'], { type: 'image/jpeg' }), width: 400, height: 300 }

describe('normalizeDraft', () => {
  it('data kosong atau rusak jadi draf bawaan', () => {
    expect(normalizeDraft(undefined)).toEqual(emptyDraft())
    expect(normalizeDraft('rusak')).toEqual(emptyDraft())
    expect(normalizeDraft({ design: 5 }).design).toEqual(defaultLetterDesign)
  })

  it('mempertahankan pilihan yang masih ada di preset', () => {
    const draft = normalizeDraft({
      design: { ...defaultLetterDesign, paper: 'navy', foilColor: 'holo', shape: 'square' },
      message: 'Halo',
      updatedAt: 5,
    })
    expect(draft.design.paper).toBe('navy')
    expect(draft.design.foilColor).toBe('holo')
    expect(draft.design.shape).toBe('square')
    expect(draft.message).toBe('Halo')
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
    const bytes = new TextEncoder().encode('jpeg').buffer as ArrayBuffer
    const draft = normalizeDraft({
      design: { ...defaultLetterDesign, illustration: PHOTO_FRONT },
      photo: { bytes, type: 'image/jpeg', width: 800, height: 600 },
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
    expect(draft.photo?.blob).toBe(photo.blob)
    expect(draft.design.illustration).toBe('night')
    expect(draft.design.foilMode).toBe(defaultLetterDesign.foilMode)
  })

  it('foto yang hilang mengembalikan gambar depan ke ilustrasi', () => {
    const draft = normalizeDraft({ design: { ...defaultLetterDesign, illustration: PHOTO_FRONT } })
    expect(draft.photo).toBeNull()
    expect(draft.design.illustration).toBe(defaultLetterDesign.illustration)
  })

  it('isi surat dipotong sesuai batas', () => {
    expect(normalizeDraft({ message: 'a'.repeat(MESSAGE_LIMIT + 50) }).message).toHaveLength(
      MESSAGE_LIMIT,
    )
  })
})
