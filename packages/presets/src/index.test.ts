import { describe, expect, it } from 'vitest'
import {
  byId,
  defaultLetterDesign,
  isAllowed,
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
    ]
    for (const color of colors) expect(color).toMatch(hex)
  })

  it('aturan surprise hanya menyebut kertas dan foil yang ada', () => {
    for (const rule of letter.surpriseRules) {
      expect(byId(letter.papers, rule.paper)).toBeDefined()
      for (const foil of rule.excludeFoil) expect(byId(letter.foilColors, foil)).toBeDefined()
    }
  })

  it('desain bawaan memakai id yang ada dan lolos aturan', () => {
    expect(byId(letter.illustrations, defaultLetterDesign.illustration)).toBeDefined()
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

  it('tidak mengubah foil border', () => {
    const next = surprise({ ...defaultLetterDesign, foilBorder: true }, seeded(1))
    expect(next.foilBorder).toBe(true)
  })
})
