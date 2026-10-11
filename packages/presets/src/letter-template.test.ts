import { describe, expect, it } from 'vitest'
import { byId, letter } from './index'
import {
  normalizeContent,
  type LetterContent,
  type LetterElement,
  type PhotoElement,
} from './letter-content'
import {
  applyTemplate,
  fitPhoto,
  freeSpot,
  templateElements,
  tidyStickers,
  templateForPhotos,
} from './letter-template'

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

describe('fitPhoto', () => {
  const slot = templateElements(template('photo-1'), 0.72)[0] as PhotoElement

  it('strip Booth yang tinggi tampil utuh dan tetap di dalam halaman', () => {
    const strip = fitPhoto(slot, 620 / 1846, 0.72, { grow: 1.4 })
    expect(strip.aspect).toBeCloseTo(620 / 1846, 3)
    expect(strip.width).toBeLessThan(slot.width)
    const box = bounds(strip, 0.72)
    expect(box.top).toBeGreaterThanOrEqual(0)
    // Lebih tinggi dari kotak template, tapi tidak sampai ke slot teks di bawahnya (y 0.8).
    expect(box.bottom - box.top).toBeGreaterThan(0.44)
    expect(box.bottom).toBeLessThan(0.7)
  })

  it('foto landscape selebar slot, foto tegak setinggi kotak template', () => {
    expect(fitPhoto(slot, 4 / 3, 0.72).width).toBeCloseTo(slot.width, 4)
    const tall = fitPhoto(slot, 3 / 4, 0.72)
    expect((tall.width / tall.aspect) * 0.72).toBeCloseTo(0.44, 3)
  })

  it('rasio foto di luar batas kontrak dipotong ke batasnya', () => {
    expect(fitPhoto(slot, 0.05, 0.72).aspect).toBe(0.2)
    expect(fitPhoto(slot, 9, 0.72).aspect).toBe(5)
  })
})

describe('templateForPhotos', () => {
  it('memilih template dengan slot foto paling sedikit yang masih cukup', () => {
    expect(templateForPhotos(letter.templates, 1)?.id).toBe('photo-1')
    expect(templateForPhotos(letter.templates, 2)?.id).toBe('photo-2')
    expect(templateForPhotos(letter.templates, 3)?.id).toBe('collage-4')
    expect(templateForPhotos(letter.templates, 4)?.id).toBe('collage-4')
    expect(templateForPhotos(letter.templates, 5)).toBeNull()
  })
})

describe('freeSpot', () => {
  const overlap = (a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) =>
    Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
    Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)

  it('halaman kosong: stiker di tengah', () => {
    expect(freeSpot({ version: 1, elements: [] }, 0.22, 0.22 * 0.75, 0.75)).toEqual({
      x: 0.5,
      y: 0.5,
    })
  })

  it('stiker baru tidak menimpa pesan di tengah halaman', () => {
    const [text] = templateElements(template('text'), 0.75)
    const message = { ...text!, text: 'Selamat ulang tahun! '.repeat(8) } as LetterElement
    const content: LetterContent = { version: 1, elements: [message] }
    for (const seed of [0, 0.5, 0.99]) {
      const spot = freeSpot(content, 0.22, 0.22 * 0.75, 0.75, () => seed)
      const half = (0.22 * 0.75) / 2
      const sticker = {
        left: spot.x - 0.11,
        right: spot.x + 0.11,
        top: spot.y - half,
        bottom: spot.y + half,
      }
      expect(overlap(sticker, textBounds(message, 0.75))).toBe(false)
    }
  })

  it('stiker kedua tidak menumpuk di atas stiker pertama', () => {
    const first = {
      kind: 'sticker',
      id: 's1',
      x: 0.5,
      y: 0.5,
      width: 0.22,
      rotation: 0,
      sticker: 'heart',
    }
    const content = normalizeContent({ elements: [first] })
    const spot = freeSpot(content, 0.22, 0.22 * 0.75, 0.75, () => 0)
    expect(spot).not.toEqual({ x: 0.5, y: 0.5 })
  })
})

/** Perkiraan kasar kotak teks untuk test: setiap baris setinggi 1,25 × ukuran huruf. */
function textBounds(element: LetterElement, ratio: number) {
  if (element.kind !== 'text') return bounds(element, ratio)
  const perLine = Math.floor(element.width / (element.size * 0.5))
  const lines = Math.ceil(Array.from(element.text).length / perLine)
  const height = lines * element.size * 1.25 * ratio
  return { ...bounds(element, ratio), top: element.y - height / 2, bottom: element.y + height / 2 }
}

describe('tidyStickers', () => {
  it('stiker yang menutupi pesan dipindah, stiker lain tetap', () => {
    const [text] = templateElements(template('text'), 0.75)
    const message = { ...text!, id: 't', text: 'Halo Rara, selamat ulang tahun!' }
    const onText = {
      kind: 'sticker',
      id: 's1',
      x: message.x,
      y: message.y,
      width: 0.2,
      rotation: 5,
      sticker: 'heart',
    }
    const corner = {
      kind: 'sticker',
      id: 's2',
      x: 0.88,
      y: 0.08,
      width: 0.15,
      rotation: 0,
      sticker: 'star',
    }
    const content = normalizeContent({ elements: [message, onText, corner] })
    const next = tidyStickers(content, 0.75, () => 0)
    expect(next.elements.map((e) => e.id)).toEqual(['t', 's1', 's2'])
    const moved = next.elements[1]!
    expect([moved.x, moved.y]).not.toEqual([message.x, message.y])
    expect(moved).toMatchObject({ rotation: 5, sticker: 'heart' })
    expect(next.elements[2]).toEqual(content.elements[2])
  })
})
