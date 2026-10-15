import { describe, expect, it } from 'vitest'
import { byId, letter } from './index'
import {
  normalizeContent,
  type LetterContent,
  type LetterElement,
  type PhotoElement,
} from './letter-content'
import {
  PAGE_MARGIN,
  applyTemplate,
  elementBounds,
  fitPhoto,
  freeSpot,
  photoBox,
  reflowTemplate,
  slotOf,
  templateElements,
  textRooms,
  tidyStickers,
  templateForPhotos,
} from './letter-template'

const template = (id: string) => byId(letter.templates, id)!
// Ilustrasi (0.72), Tegak, Persegi, dan Mendatar.
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
    // Kotak photo-1 versi tall: 0.72 lebar × 0.42 tinggi halaman.
    for (const ratio of [0.72, 1]) {
      const [photo] = templateElements(template('photo-1'), ratio)
      expect(photo?.kind === 'photo' && photo.aspect).toBeCloseTo((0.72 / 0.42) * ratio, 3)
    }
  })

  for (const item of letter.templates) {
    for (const ratio of ratios) {
      it(`${item.id} di halaman ${ratio}: foto tidak bertumpuk, teks punya ruang sendiri`, () => {
        // Slot foto diisi: slot kosong tidak membatasi ruang teks, karena tidak ikut terkirim.
        const elements = templateElements(item, ratio).map((e) =>
          e.kind === 'photo' ? { ...e, photo: `f-${e.id}` } : e,
        )
        const photos = elements
          .filter((e) => e.kind === 'photo')
          .map((e) => elementBounds(e, ratio))
        // Setelah diputar, setiap foto tetap di halaman dengan jarak dari tepinya.
        for (const box of photos) {
          expect(box.left).toBeGreaterThanOrEqual(0.03)
          expect(box.right).toBeLessThanOrEqual(0.97)
          expect(box.top).toBeGreaterThanOrEqual(0.03)
          expect(box.bottom).toBeLessThanOrEqual(0.97)
        }
        // Dua foto mana pun terpisah celah minimal 2% halaman, ke samping atau ke bawah.
        for (let i = 0; i < photos.length; i++) {
          for (let j = i + 1; j < photos.length; j++) {
            const a = photos[i]!
            const b = photos[j]!
            const apart = Math.max(
              b.left - a.right,
              a.left - b.right,
              b.top - a.bottom,
              a.top - b.bottom,
            )
            expect(apart, `foto ${i} dan ${j}`).toBeGreaterThanOrEqual(0.02)
          }
        }
        // Ruang teksnya cukup untuk beberapa baris dan tidak menyentuh foto mana pun.
        const text = elements.find((e) => e.kind === 'text')!
        const room = textRooms({ version: 1, elements }, ratio)[text.id]!
        expect(room).toBeGreaterThanOrEqual(0.2)
        const band = {
          left: text.x - text.width / 2,
          right: text.x + text.width / 2,
          top: text.y - room / 2,
          bottom: text.y + room / 2,
        }
        expect(band.top).toBeGreaterThanOrEqual(PAGE_MARGIN - 1e-9)
        expect(band.bottom).toBeLessThanOrEqual(1 - PAGE_MARGIN + 1e-9)
        expect(band.left).toBeGreaterThanOrEqual(0.03)
        expect(band.right).toBeLessThanOrEqual(0.97)
        for (const box of photos) {
          const apart = Math.max(
            box.left - band.right,
            band.left - box.right,
            box.top - band.bottom,
            band.top - box.bottom,
          )
          expect(apart).toBeGreaterThan(0)
        }
      })
    }
  }

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
    expect(byIdIn('b')).toMatchObject({ photo: 'f1', x: 0.5, y: 0.31, rotation: -2 })
    expect(byIdIn('a')).toMatchObject({ text: 'Halo', x: 0.5, y: 0.765, align: 'center' })
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
    // Lebih tinggi dari kotak template, tapi tidak sampai ke slot teks di bawahnya (y 0.765).
    expect(box.bottom - box.top).toBeGreaterThan(0.42)
    expect(box.bottom).toBeLessThan(0.7)
  })

  it('foto landscape selebar slot, foto tegak setinggi kotak template', () => {
    expect(fitPhoto(slot, 4 / 3, 0.72).width).toBeCloseTo(slot.width, 4)
    const tall = fitPhoto(slot, 3 / 4, 0.72)
    expect((tall.width / tall.aspect) * 0.72).toBeCloseTo(0.42, 3)
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
      coversText: false,
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

  it('halaman penuh: lebih baik menutupi pinggir foto daripada tulisan', () => {
    // Kolase 4 foto terisi, dengan pesan di bawahnya.
    const elements = templateElements(template('collage-4'), 0.75).map((element) =>
      element.kind === 'photo'
        ? { ...element, photo: `f-${element.id}` }
        : { ...element, text: 'Terima kasih untuk kemarin, aku senang sekali.' },
    )
    const message = elements.find((element) => element.kind === 'text')!
    const content = normalizeContent({ elements })
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
      expect(spot.coversText).toBe(false)
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
  it('tulisan panjang dihitung setinggi ruangnya saja, jadi stiker tidak dipindah ke atasnya', () => {
    const elements = templateElements(template('photo-2'), 1).map((element) =>
      element.kind === 'photo'
        ? { ...element, photo: `f-${element.id}` }
        : { ...element, text: 'Terima kasih untuk semuanya. '.repeat(20) },
    )
    const text = elements.find((element) => element.kind === 'text')!
    const heart = {
      kind: 'sticker',
      id: 's',
      x: 0.2,
      y: 0.75,
      width: 0.22,
      rotation: 0,
      sticker: 'heart',
    }
    const content = normalizeContent({ elements: [...elements, heart] })
    const room = textRooms(content, 1)[text.id]!
    for (const seed of [0, 0.5, 0.99]) {
      const moved = tidyStickers(content, 1, () => seed).elements.find((e) => e.id === 's')!
      const half = 0.11
      const apart = Math.max(
        text.y - room / 2 - (moved.y + half),
        moved.y - half - (text.y + room / 2),
        text.x - text.width / 2 - (moved.x + half),
        moved.x - half - (text.x + text.width / 2),
      )
      expect(apart).toBeGreaterThanOrEqual(0)
    }
  })

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

describe('elementBounds', () => {
  it('kotak foto yang diputar lebih lebar dan lebih tinggi dari kotak aslinya', () => {
    const photo = normalizeContent({
      elements: [
        { kind: 'photo', id: 'p', x: 0.5, y: 0.5, width: 0.4, rotation: 0, photo: 'f', aspect: 1 },
      ],
    }).elements[0]!
    const flat = elementBounds(photo, 0.75)
    expect(flat.right - flat.left).toBeCloseTo(0.4)
    expect(flat.bottom - flat.top).toBeCloseTo(0.3)
    const turned = elementBounds({ ...photo, rotation: 45 }, 0.75)
    // Persegi yang diputar 45°: lebar dan tingginya kali √2.
    expect(turned.right - turned.left).toBeCloseTo(0.4 * Math.SQRT2)
    expect(turned.bottom - turned.top).toBeCloseTo(0.3 * Math.SQRT2)
  })

  it('tinggi teks dari hasil ukur kalau ada, kalau tidak satu baris', () => {
    const text = templateElements(template('text'), 0.75)[0]!
    expect(elementBounds(text, 0.75, 0.4).bottom - elementBounds(text, 0.75, 0.4).top).toBeCloseTo(
      0.4,
    )
    const line = elementBounds(text, 0.75)
    expect(line.bottom - line.top).toBeCloseTo(0.075 * 1.2 * 0.75)
  })
})

describe('textRooms', () => {
  const content = (elements: unknown[]) => normalizeContent({ elements })
  const text = (id: string, x: number, y: number, width = 0.8) => ({
    kind: 'text',
    id,
    x,
    y,
    width,
    rotation: 0,
    text: 'Halo',
    size: 0.06,
    align: 'center',
  })
  const photo = (id: string, x: number, y: number, width: number, aspect: number) => ({
    kind: 'photo',
    id,
    x,
    y,
    width,
    rotation: 0,
    photo: `f-${id}`,
    aspect,
  })

  it('halaman tanpa penghalang: sampai tepi halaman yang terdekat', () => {
    expect(textRooms(content([text('t', 0.5, 0.5)]), 0.75).t).toBeCloseTo(1 - 2 * PAGE_MARGIN)
    expect(textRooms(content([text('t', 0.5, 0.8)]), 0.75).t).toBeCloseTo(2 * (0.2 - PAGE_MARGIN))
  })

  it('berhenti sebelum foto di atasnya', () => {
    // Foto 0.6 × 0.6 lebar halaman di halaman 0.75: setinggi 0.45, dari 0.1 sampai 0.55.
    const rooms = textRooms(content([photo('p', 0.5, 0.325, 0.6, 1), text('t', 0.5, 0.72)]), 0.75)
    expect(rooms.t).toBeCloseTo(2 * (0.72 - 0.55 - 0.025))
  })

  it('foto di samping teks atau yang sengaja menimpa titik tengahnya tidak membatasi', () => {
    const beside = textRooms(
      content([photo('p', 0.2, 0.5, 0.3, 0.5), text('t', 0.75, 0.5, 0.4)]),
      1.3333,
    )
    expect(beside.t).toBeCloseTo(1 - 2 * PAGE_MARGIN)
    const caption = textRooms(
      content([photo('p', 0.5, 0.5, 0.8, 1), text('t', 0.5, 0.5, 0.6)]),
      0.75,
    )
    expect(caption.t).toBeCloseTo(1 - 2 * PAGE_MARGIN)
  })

  it('dua teks yang bertumpuk berbagi ruang di titik tengah di antaranya', () => {
    const rooms = textRooms(content([text('a', 0.5, 0.3), text('b', 0.5, 0.6)]), 0.75)
    expect(rooms.a).toBeCloseTo(2 * (0.15 - 0.0125))
    expect(rooms.b).toBeCloseTo(2 * (0.15 - 0.0125))
    // Ruang keduanya tidak saling bertemu.
    expect(0.3 + rooms.a! / 2).toBeLessThan(0.6 - rooms.b! / 2)
  })
})

describe('photoBox', () => {
  const photo1 = template('photo-1')
  const slot = templateElements(photo1, 0.72)[0] as PhotoElement

  it('mengganti foto berkali-kali tidak membuat bingkainya terus mengecil', () => {
    let frame: PhotoElement = { ...slot, photo: 'f1' }
    const areas: number[] = []
    for (const aspect of [3 / 4, 4 / 3, 3 / 4, 4 / 3, 1 / 3, 4 / 3]) {
      frame = fitPhoto(photoBox(frame, photo1, 0.72), aspect, 0.72)
      areas.push(frame.width * (frame.width / frame.aspect))
    }
    // Foto 4:3 berikutnya sama besar dengan yang pertama.
    expect(areas[3]).toBeCloseTo(areas[1]!, 4)
    expect(areas[5]).toBeCloseTo(areas[1]!, 4)
  })

  it('bingkai yang sudah dipindah memakai persegi seukuran sisi terpanjangnya', () => {
    const moved = { ...slot, photo: 'f1', x: 0.4, width: 0.4, aspect: 0.8 }
    expect(photoBox(moved, photo1, 0.72)).toMatchObject({ width: 0.5, aspect: 1 })
    // Slot kosong yang dipindah tetap memakai bingkainya sendiri.
    expect(photoBox({ ...moved, photo: null }, photo1, 0.72)).toMatchObject({
      width: 0.4,
      aspect: 0.8,
    })
  })

  it('slotOf hanya mengenali elemen yang belum dipindah', () => {
    expect(slotOf(slot, photo1, 0.72)?.kind).toBe('photo')
    expect(slotOf({ ...slot, x: 0.45 }, photo1, 0.72)).toBeUndefined()
  })
})

describe('reflowTemplate', () => {
  const photo1 = template('photo-1')
  const [photo, text] = templateElements(photo1, 0.75) as [PhotoElement, LetterElement]

  it('isi di slot pindah ke slot tata letak baru, dengan putaran, rata, dan ukuran huruf user', () => {
    if (text.kind !== 'text') throw new Error('bukan teks')
    const content = normalizeContent({
      elements: [
        { ...photo, photo: 'f1', width: 0.5, aspect: 0.75, rotation: 6 },
        { ...text, text: 'Halo', align: 'right', size: text.size * 1.15 },
        { kind: 'sticker', id: 's', x: 0.9, y: 0.1, width: 0.2, rotation: 0, sticker: 'heart' },
      ],
    })
    const next = reflowTemplate(content, photo1, 0.75, 1.3333)
    const [wide, wideText] = templateElements(photo1, 1.3333) as [PhotoElement, LetterElement]
    if (wideText.kind !== 'text') throw new Error('bukan teks')
    const [movedPhoto, movedText, sticker] = next.elements
    expect(movedPhoto).toMatchObject({ x: wide.x, y: wide.y, width: wide.width, rotation: 6 })
    expect(movedPhoto!.kind === 'photo' && movedPhoto!.aspect).toBeCloseTo(wide.aspect, 3)
    expect(movedText).toMatchObject({ x: wideText.x, y: wideText.y, align: 'right', text: 'Halo' })
    expect(movedText!.kind === 'text' && movedText!.size).toBeCloseTo(wideText.size * 1.15, 3)
    expect(sticker).toEqual(content.elements[2])
  })

  it('elemen yang sudah dipindah user tidak ikut disusun', () => {
    const content = normalizeContent({
      elements: [
        { ...photo, photo: 'f1', x: 0.2, y: 0.8 },
        { ...text, text: 'Halo' },
      ],
    })
    const next = reflowTemplate(content, photo1, 0.75, 1)
    expect(next.elements[0]).toMatchObject({ x: 0.2, y: 0.8 })
  })
})
