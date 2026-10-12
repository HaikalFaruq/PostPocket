import { letter, pocket } from '@postpocket/presets'
import { describe, expect, it } from 'vitest'
import { hexToRgb, isDark, packetTones, relativeLuminance } from '../app/utils/color'
import { metalGradient } from '../app/utils/foil'

describe('warna', () => {
  it('membaca hex', () => {
    expect(hexToRgb('#1e2335')).toEqual([30, 35, 53])
    expect(() => hexToRgb('red')).toThrow()
  })

  it('luminans hitam 0 dan putih 1', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1)
  })

  it('bingkai gelap dapat teks terang, bingkai terang dapat teks gelap', () => {
    const dark = pocket.frameColors.filter((c) => isDark(c.color)).map((c) => c.id)
    expect(dark).toEqual(['forest', 'plum'])
    expect(isDark(letter.papers.find((p) => p.id === 'navy')!.color)).toBe(true)
  })
})

describe('packetTones', () => {
  it('bayangan lebih gelap dan kilau lebih terang, tapi tetap senada dengan warna kantong', () => {
    for (const { color } of pocket.packetColors) {
      const tones = packetTones(color)
      expect(relativeLuminance(tones.deep)).toBeLessThan(relativeLuminance(color))
      expect(relativeLuminance(tones.deeper)).toBeLessThan(relativeLuminance(tones.deep))
      expect(relativeLuminance(tones.light)).toBeGreaterThan(relativeLuminance(color))
      // Kanal paling kuat tetap kanal yang sama: biru tetap biru, pink tetap pink.
      const strongest = (hex: string) => hexToRgb(hex).indexOf(Math.max(...hexToRgb(hex)))
      expect(strongest(tones.deep)).toBe(strongest(color))
    }
  })

  it('biru pastel jadi biru pekat di bayangan, bukan abu-abu', () => {
    expect(packetTones('#7fb3f5')).toMatchObject({ deep: '#3f7eeb', light: '#bfe8ff' })
    expect(packetTones('#ffffff').deep).toBe('#ffffff')
    expect(packetTones('#000000').light).toBe('#000000')
  })
})

describe('metalGradient', () => {
  it('memakai warna preset foil', () => {
    const gold = letter.foilColors.find((f) => f.id === 'gold')!
    const gradient = metalGradient(gold)
    expect(gradient).toContain(gold.base)
    expect(gradient).toContain(gold.light)
  })

  it('foil holografik memakai spektrum', () => {
    const holo = letter.foilColors.find((f) => f.id === 'holo')!
    for (const color of holo.spectrum ?? []) expect(metalGradient(holo)).toContain(color)
  })
})
