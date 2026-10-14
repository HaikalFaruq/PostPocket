import { describe, expect, it } from 'vitest'
import {
  PEEPS,
  calmSpots,
  crowdSize,
  nextPeep,
  peepHeight,
  peepWidth,
  walkSpeed,
} from '../app/utils/crowd'

describe('kerumunan Beranda', () => {
  it('tinggi orang mengikuti pita, tapi tidak lebih kecil dari 96 atau lebih besar dari 176 px', () => {
    expect(peepHeight(180)).toBe(126)
    expect(peepHeight(100)).toBe(96)
    expect(peepHeight(400)).toBe(176)
    expect(peepWidth(243)).toBeCloseTo(180)
  })

  it('kerumunannya renggang: 4 orang di HP sempit, paling banyak 14 di layar lebar', () => {
    expect(crowdSize(320, peepWidth(126))).toBe(4)
    expect(crowdSize(412, peepWidth(126))).toBe(5)
    expect(crowdSize(1440, peepWidth(154))).toBe(14)
    expect(crowdSize(3000, peepWidth(176))).toBe(14)
  })

  it('jalannya pelan, 22 sampai 38 px per detik', () => {
    expect(walkSpeed(0)).toBe(22)
    expect(walkSpeed(1)).toBe(38)
    expect(walkSpeed(2)).toBe(38)
  })

  it('orang berikutnya tidak sama dengan yang sedang tampil', () => {
    const all = PEEPS.cols * PEEPS.rows
    const shown = Array.from({ length: all - 1 }, (_, i) => i)
    // Tinggal satu yang belum tampil: itulah yang dipilih, berapa pun acakannya.
    expect(nextPeep(shown, 0)).toBe(all - 1)
    expect(nextPeep(shown, 0.99)).toBe(all - 1)
    for (const r of [0, 0.3, 0.6, 0.999]) expect([3, 5]).not.toContain(nextPeep([3, 5], r))
  })

  it('saat diam, orang-orangnya berjajar rata tanpa bertumpuk dan tidak keluar dari pita', () => {
    for (const width of [320, 375, 1024, 1440]) {
      const peep = peepWidth(peepHeight(200))
      const spots = calmSpots(crowdSize(width, peep), width, peep)
      expect(new Set(spots.map((x) => Math.round(x))).size).toBe(spots.length)
      for (const x of spots) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(width - peep)
      }
      for (let i = 1; i < spots.length; i++) expect(spots[i]!).toBeGreaterThan(spots[i - 1]!)
    }
  })
})
