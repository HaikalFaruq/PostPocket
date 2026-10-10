import { describe, expect, it } from 'vitest'
import {
  contentLimits,
  contentPhotoKeys,
  normalizeContent,
  publishableContent,
  type LetterContent,
  type LetterElement,
} from './letter-content'

/** Contoh yang sama dengan docs/frontend.md bagian "Data surat untuk API". */
const sample: LetterContent = {
  version: 1,
  elements: [
    {
      kind: 'photo',
      id: 'e1',
      x: 0.5,
      y: 0.32,
      width: 0.7,
      rotation: -3,
      photo: 'p1',
      aspect: 1.33,
    },
    {
      kind: 'text',
      id: 'e2',
      x: 0.5,
      y: 0.72,
      width: 0.8,
      rotation: 0,
      text: 'Selamat ulang tahun!',
      size: 0.07,
      align: 'center',
    },
    { kind: 'sticker', id: 'e3', x: 0.84, y: 0.12, width: 0.18, rotation: 12, sticker: 'heart' },
  ],
}

const base = { x: 0.5, y: 0.5, width: 0.5, rotation: 0 }
const text = (id: string, extra: object = {}) => ({
  kind: 'text',
  id,
  ...base,
  text: 'hai',
  size: 0.06,
  align: 'center',
  ...extra,
})
const photo = (id: string, key: unknown, extra: object = {}) => ({
  kind: 'photo',
  id,
  ...base,
  photo: key,
  aspect: 1,
  ...extra,
})
const sticker = (id: string, extra: object = {}) => ({
  kind: 'sticker',
  id,
  ...base,
  sticker: 'heart',
  ...extra,
})

const only = (raw: unknown): LetterElement | undefined =>
  normalizeContent({ elements: [raw] }).elements[0]
const ids = (content: LetterContent) => content.elements.map((element) => element.id)

describe('normalizeContent', () => {
  it('data kosong atau rusak jadi isi kosong', () => {
    for (const raw of [undefined, null, 'rusak', 5, [], {}, { elements: 'x' }]) {
      expect(normalizeContent(raw)).toEqual({ version: 1, elements: [] })
    }
  })

  it('isi yang sah tidak berubah, juga setelah lewat JSON', () => {
    expect(normalizeContent(sample)).toEqual(sample)
    expect(normalizeContent(JSON.parse(JSON.stringify(sample)))).toEqual(sample)
  })

  it('angka dijepit ke rentangnya dan dibulatkan ke 4 desimal', () => {
    expect(only(text('a', { x: 2, y: -1, width: 9, size: 0 }))).toMatchObject({
      x: 1,
      y: 0,
      width: contentLimits.width.max,
      size: contentLimits.size.min,
    })
    expect(only(photo('b', 'p1', { x: 0.123456789, width: 0.001, aspect: 100 }))).toMatchObject({
      x: 0.1235,
      width: contentLimits.width.min,
      aspect: contentLimits.aspect.max,
    })
  })

  it('nilai yang bukan angka diganti bawaan', () => {
    const element = only(
      text('a', { x: 'tengah', y: Number.NaN, width: Infinity, rotation: null, size: undefined }),
    )
    expect(element).toMatchObject({ x: 0.5, y: 0.5, width: 0.5, rotation: 0, size: 0.06 })
  })

  it('putaran dinormalkan ke -180 sampai 180', () => {
    const turns = [0, 90, 180, 190, -190, 360, 725, -0.004]
    expect(turns.map((rotation) => only(sticker('s', { rotation }))?.rotation)).toEqual([
      0, 90, -180, -170, 170, 0, 5, 0,
    ])
  })

  it('elemen rusak, jenis asing, dan id ganda dibuang', () => {
    const content = normalizeContent({
      elements: [
        text('a'),
        text('a', { text: 'kembar' }),
        { kind: 'video', id: 'v' },
        text('pakai spasi'),
        text('b', { text: 5 }),
        sticker('c', { sticker: '' }),
        photo('d', '../rahasia'),
        'bukan objek',
        null,
        sticker('ok'),
      ],
    })
    expect(ids(content)).toEqual(['a', 'ok'])
  })

  it('batas per jenis ditegakkan, elemen yang lebih dulu dipertahankan', () => {
    const many = (make: (id: string) => object, prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => make(`${prefix}${i}`))
    const content = normalizeContent({
      elements: [
        ...many(text, 't', 6),
        ...many((id) => photo(id, `k${id}`), 'p', 6),
        ...many(sticker, 's', 20),
      ],
    })
    const count = (kind: string) => content.elements.filter((e) => e.kind === kind).length
    expect(count('text')).toBe(contentLimits.text)
    expect(count('photo')).toBe(contentLimits.photo)
    expect(count('sticker')).toBe(contentLimits.sticker)
    expect(ids(content).slice(0, 2)).toEqual(['t0', 't1'])
  })

  it('satu foto hanya dipakai sekali, slot kosong boleh lebih dari satu', () => {
    const content = normalizeContent({
      elements: [photo('a', 'p1'), photo('b', 'p1'), photo('c', null), photo('d', undefined)],
    })
    expect(content.elements.map((e) => (e.kind === 'photo' ? [e.id, e.photo] : []))).toEqual([
      ['a', 'p1'],
      ['c', null],
      ['d', null],
    ])
  })

  it('align selain left dan right jadi center', () => {
    expect(only(text('a', { align: 'left' }))).toMatchObject({ align: 'left' })
    expect(only(text('b', { align: 'justify' }))).toMatchObject({ align: 'center' })
  })

  it('teks aman untuk jsonb Postgres', () => {
    expect(only(text('a', { text: 'a\u0000b\r\nc\rd\uD800e' }))).toMatchObject({
      text: 'ab\nc\nd�e',
    })
  })

  it('teks dipotong per code point tanpa membelah emoji', () => {
    const element = only(text('a', { text: '💌'.repeat(contentLimits.textLength + 10) }))
    const value = element?.kind === 'text' ? element.text : ''
    expect(Array.from(value)).toHaveLength(contentLimits.textLength)
    expect(value).toBe('💌'.repeat(contentLimits.textLength))
  })
})

describe('publishableContent', () => {
  it('membuang slot foto kosong dan blok teks kosong', () => {
    const content = normalizeContent({
      elements: [
        photo('a', null),
        text('b', { text: ' \n ' }),
        photo('c', 'p1'),
        text('d'),
        sticker('e'),
      ],
    })
    expect(ids(publishableContent(content))).toEqual(['c', 'd', 'e'])
  })
})

describe('contentPhotoKeys', () => {
  it('kunci foto sesuai urutan, tanpa slot kosong', () => {
    const content = normalizeContent({
      elements: [photo('a', 'p2'), text('b'), photo('c', null), photo('d', 'p1')],
    })
    expect(contentPhotoKeys(content)).toEqual(['p2', 'p1'])
  })
})
