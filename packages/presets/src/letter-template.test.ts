import { describe, expect, it } from 'vitest'
import { byId, letter } from './index'
import { normalizeContent, type LetterContent, type LetterElement } from './letter-content'
import { applyTemplate, templateElements } from './letter-template'

const template = (id: string) => byId(letter.templates, id)!
// Ilustrasi (0.72), Portrait, Square, dan Landscape.
const ratios = [0.72, 0.75, 1, 1.3333]

/** Batas kotak elemen sebelum diputar, dalam pecahan lebar dan tinggi halaman. */
function bounds(element: LetterElement, ratio: number) {
  const height = element.kind === 'photo' ? (element.width / element.aspect) * ratio : 0
  return {
    left: element.x - element.width / 2,
    right: element.x + element.width / 2,
    top: element.y - height / 2,
    bottom: element.y + height / 2,
  }
}

describe('templateElements', () => {
  for (const item of letter.templates) {
    for (const ratio of ratios) {
      it(`${item.id} di halaman ${ratio}: jumlah slot sesuai dan semuanya muat`, () => {
        const elements = templateElements(item, ratio)
        const photos = elements.filter((e) => e.kind === 'photo')
        const texts = elements.filter((e) => e.kind === 'text')
        expect(photos).toHaveLength(item.photos)
        expect(texts).toHaveLength(1)
        for (const element of elements) {
          const box = bounds(element, ratio)
          expect(box.left, element.id).toBeGreaterThanOrEqual(0)
          expect(box.right, element.id).toBeLessThanOrEqual(1)
          expect(box.top, element.id).toBeGreaterThanOrEqual(0)
          expect(box.bottom, element.id).toBeLessThanOrEqual(1)
        }
        for (const photo of photos) expect(photo.kind === 'photo' && photo.photo).toBeNull()
      })
    }
  }

  it('foto mengisi kotaknya di halaman mana pun', () => {
    // Kotak photo-1 versi tall: 0.74 lebar × 0.44 tinggi halaman.
    for (const ratio of [0.72, 1]) {
      const [photo] = templateElements(template('photo-1'), ratio)
      expect(photo?.kind === 'photo' && photo.aspect).toBeCloseTo((0.74 / 0.44) * ratio, 3)
    }
  })

  it('halaman landscape memakai tata letak wide dengan huruf mengikuti sisi pendek', () => {
    const tall = templateElements(template('text'), 0.75)[0]
    const wide = templateElements(template('text'), 1.3333)[0]
    expect(tall?.kind === 'text' && tall.size).toBeCloseTo(0.075, 4)
    expect(wide?.kind === 'text' && wide.size).toBeCloseTo(0.07 / 1.3333, 3)
  })

  it('id baru tidak bentrok dengan yang sudah dipakai', () => {
    const taken = new Set(['t1', 'p1'])
    const ids = templateElements(template('photo-2'), 0.75, taken).map((e) => e.id)
    expect(ids).toEqual(['p2', 'p3', 't2'])
  })
})

describe('applyTemplate', () => {
  const content: LetterContent = normalizeContent({
    elements: [
      { kind: 'text', id: 'a', x: 0.2, y: 0.2, width: 0.5, rotation: 0, text: 'Halo', size: 0.05 },
      { kind: 'photo', id: 'b', x: 0.3, y: 0.6, width: 0.4, rotation: 5, photo: 'f1', aspect: 1 },
      { kind: 'photo', id: 'c', x: 0.7, y: 0.6, width: 0.4, rotation: 0, photo: 'f2', aspect: 1 },
      { kind: 'photo', id: 'd', x: 0.5, y: 0.9, width: 0.3, rotation: 0, photo: null, aspect: 1 },
      { kind: 'text', id: 'e', x: 0.5, y: 0.95, width: 0.5, rotation: 0, text: '  ', size: 0.05 },
      { kind: 'sticker', id: 's', x: 0.9, y: 0.1, width: 0.15, rotation: 10, sticker: 'heart' },
    ],
  })

  it('teks dan foto mengisi slot, sisanya tetap di tempat', () => {
    const next = applyTemplate(content, template('photo-1'), 0.75)
    const byIdIn = (id: string) => next.elements.find((e) => e.id === id)
    // Foto pertama dan teks pindah ke slot template.
    expect(byIdIn('b')).toMatchObject({ photo: 'f1', x: 0.5, y: 0.35, rotation: -2 })
    expect(byIdIn('a')).toMatchObject({ text: 'Halo', x: 0.5, y: 0.8, align: 'center' })
    // Foto kedua tidak kebagian slot, jadi tetap di tempat; stiker juga.
    expect(byIdIn('c')).toMatchObject({ photo: 'f2', x: 0.7, y: 0.6 })
    expect(byIdIn('s')).toMatchObject({ x: 0.9, y: 0.1, rotation: 10 })
    // Slot foto kosong dan teks kosong dari tata letak lama dibuang.
    expect(byIdIn('d')).toBeUndefined()
    expect(byIdIn('e')).toBeUndefined()
  })

  it('template dengan slot lebih banyak menambah slot foto kosong', () => {
    const next = applyTemplate(content, template('collage-4'), 0.75)
    const photos = next.elements.filter((e) => e.kind === 'photo')
    expect(photos.map((e) => e.kind === 'photo' && e.photo)).toEqual(['f1', 'f2', null, null])
    expect(new Set(next.elements.map((e) => e.id)).size).toBe(next.elements.length)
  })

  it('isi kosong mendapat slot template apa adanya', () => {
    const next = applyTemplate({ version: 1, elements: [] }, template('photo-2'), 0.75)
    expect(next.elements.map((e) => e.kind)).toEqual(['photo', 'photo', 'text'])
  })

  it('tidak pernah membuang teks atau foto berisi', () => {
    for (const item of letter.templates) {
      for (const ratio of ratios) {
        const next = applyTemplate(content, item, ratio)
        const texts = next.elements.filter((e) => e.kind === 'text' && e.text === 'Halo')
        const photos = next.elements.filter((e) => e.kind === 'photo' && e.photo !== null)
        expect(texts, `${item.id} ${ratio}`).toHaveLength(1)
        expect(photos, `${item.id} ${ratio}`).toHaveLength(2)
        expect(next.elements.some((e) => e.kind === 'sticker')).toBe(true)
      }
    }
  })
})
