import { describe, expect, it } from 'vitest'
import {
  byId,
  defaultLetterDesign,
  illustrationArt,
  isAllowed,
  offeredIllustrations,
  kotak,
  letter,
  pocket,
  surprise,
  tv,
  type LetterDesign,
  type Option,
} from './index'

const hex = /^#[0-9a-f]{6}$/

/** PRNG kecil supaya hasil acak bisa diulang. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lists: Record<string, readonly Option[]> = {
  'letter.illustrations': letter.illustrations,
  'letter.shapes': letter.shapes,
  'letter.foilModes': letter.foilModes,
  'letter.foilColors': letter.foilColors,
  'letter.papers': letter.papers,
  'letter.templates': letter.templates,
  'letter.stickers': letter.stickers,
  'pocket.packetColors': pocket.packetColors,
  'pocket.frames': pocket.frames,
  'pocket.frameColors': pocket.frameColors,
  'tv.filters': tv.filters,
  'tv.clayColors': tv.clayColors,
  'kotak.folders': kotak.folders,
}

describe('data preset', () => {
  it.each(Object.entries(lists))('%s: id unik, berlabel, dan tidak kosong', (_, list) => {
    expect(list.length).toBeGreaterThan(0)
    const ids = list.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of list) {
      expect(item.id).toMatch(/^[a-z0-9-]+$/)
      expect(item.label.length).toBeGreaterThan(0)
    }
  })

  it('jumlah pilihan sesuai PRD', () => {
    expect(letter.illustrations).toHaveLength(5)
    expect(letter.foilColors).toHaveLength(6)
    expect(letter.papers).toHaveLength(6)
    expect(letter.shapes).toHaveLength(4)
    expect(letter.foilModes).toHaveLength(4)
    expect(letter.templates).toHaveLength(4)
    expect(pocket.packetColors).toHaveLength(6)
    expect(pocket.frames).toHaveLength(3)
    expect(pocket.frameColors).toHaveLength(6)
    expect(tv.filters.map((filter) => filter.label)).toEqual([
      'Normal',
      'Kodak',
      'Noir',
      'Glitch',
      'VHS',
      'Cyan',
      'Velvia',
    ])
    expect(tv.clayColors).toHaveLength(8)
  })

  it('semua warna berbentuk hex 6 digit', () => {
    const colors = [
      ...letter.foilColors.flatMap((foil) => [foil.base, foil.shade, foil.light]),
      ...letter.papers.flatMap((paper) => [paper.color, paper.textColor]),
      ...pocket.packetColors.map((packet) => packet.color),
      ...pocket.frameColors.map((frame) => frame.color),
      ...tv.clayColors.map((clay) => clay.color),
      ...kotak.folders.flatMap((folder) => folder.colors),
    ]
    for (const color of colors) expect(color).toMatch(hex)
  })

  it('resep seni folder kaca lengkap dan dalam rentangnya', () => {
    for (const folder of kotak.folders) {
      expect(['marble', 'streak']).toContain(folder.style)
      expect(folder.colors.length).toBeGreaterThanOrEqual(2)
      expect(folder.scale).toBeGreaterThan(0)
      expect(folder.warp).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(folder.angle)).toBe(true)
      for (const value of [folder.gloss, folder.veins]) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('setiap ilustrasi punya komposisi untuk setiap bentuk kartu yang rasionya tetap', () => {
    const fixed = letter.shapes.filter((shape) => shape.ratio)
    for (const item of letter.illustrations) {
      expect(Object.keys(item.variants).sort()).toEqual(fixed.map((shape) => shape.id).sort())
      for (const [shape, art] of Object.entries(item.variants)) {
        expect(art.art).toBe(`/illustrations/${item.id}-${shape}.svg`)
        expect(art.foil).toBe(`/illustrations/${item.id}-${shape}-foil.svg`)
      }
    }
  })

  it('aturan surprise hanya menyebut kertas dan foil yang ada', () => {
    for (const rule of letter.surpriseRules) {
      expect(byId(letter.papers, rule.paper)).toBeDefined()
      for (const foil of rule.excludeFoil) expect(byId(letter.foilColors, foil)).toBeDefined()
    }
  })

  it('desain bawaan memakai id yang ada dan lolos aturan', () => {
    expect(byId(letter.illustrations, defaultLetterDesign.illustration)?.hidden).toBeFalsy()
    expect(byId(letter.papers, defaultLetterDesign.paper)).toBeDefined()
    expect(isAllowed(defaultLetterDesign)).toBe(true)
  })
})

describe('isAllowed', () => {
  it('menolak kertas navy dengan foil perak (contoh di PRD)', () => {
    expect(isAllowed({ paper: 'navy', foilColor: 'silver' })).toBe(false)
    expect(isAllowed({ paper: 'navy', foilColor: 'gold' })).toBe(true)
  })
})

describe('surprise', () => {
  it('selalu menghasilkan kombinasi yang lolos aturan dan berbeda dari sebelumnya', () => {
    const random = seeded(42)
    let design: LetterDesign = defaultLetterDesign
    for (let i = 0; i < 500; i++) {
      const next = surprise(design, random)
      expect(isAllowed(next)).toBe(true)
      expect(next.foilColor !== design.foilColor || next.paper !== design.paper).toBe(true)
      expect(byId(letter.illustrations, next.illustration)).toBeDefined()
      expect(byId(letter.templates, next.template)).toBeDefined()
      design = next
    }
  })

  it('tidak mengganti foto user dan tidak memakai mode "Sesuai desain" untuk foto', () => {
    const random = seeded(7)
    const photo: LetterDesign = {
      ...defaultLetterDesign,
      illustration: 'upload',
      foilMode: 'detail',
    }
    for (let i = 0; i < 200; i++) {
      const next = surprise(photo, random, { keepIllustration: true })
      expect(next.illustration).toBe('upload')
      expect(next.foilMode).not.toBe('design')
    }
  })

  it('dengan minPhotos, hanya memilih template yang slot fotonya cukup', () => {
    const random = seeded(11)
    for (let i = 0; i < 200; i++) {
      const next = surprise(defaultLetterDesign, random, { minPhotos: 2 })
      expect(byId(letter.templates, next.template)!.photos).toBeGreaterThanOrEqual(2)
    }
  })

  it('tidak memilih ilustrasi yang belum ditawarkan', () => {
    const random = seeded(3)
    const offered = new Set(offeredIllustrations().map((item) => item.id))
    for (let i = 0; i < 300; i++) {
      expect(offered.has(surprise(defaultLetterDesign, random).illustration)).toBe(true)
    }
  })

  it('tidak mengubah foil border', () => {
    const next = surprise({ ...defaultLetterDesign, foilBorder: true }, seeded(1))
    expect(next.foilBorder).toBe(true)
  })
})

describe('illustrationArt', () => {
  const sprig = byId(letter.illustrations, 'sprig')!

  it('memakai komposisi bentuk kartunya', () => {
    expect(illustrationArt(sprig, 'landscape')).toEqual({
      art: '/illustrations/sprig-landscape.svg',
      foil: '/illustrations/sprig-landscape-foil.svg',
    })
  })

  it('bentuk Asli dan bentuk yang tidak dikenal memakai gambar aslinya', () => {
    const original = { art: '/illustrations/sprig.svg', foil: '/illustrations/sprig-foil.svg' }
    expect(illustrationArt(sprig, 'original')).toEqual(original)
    expect(illustrationArt(sprig, 'hilang')).toEqual(original)
  })
})
