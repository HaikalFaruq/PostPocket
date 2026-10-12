import { describe, expect, it } from 'vitest'
import { shelfMetrics, shelfPositions, shelfVisible } from '../app/utils/cd-shelf'

const desktop = shelfMetrics(640)
const phone = shelfMetrics(358)

describe('shelfMetrics', () => {
  it('case di HP lebih kecil daripada di layar lebar', () => {
    expect(phone.face).toBeLessThan(desktop.face)
    expect(phone.step).toBeLessThan(desktop.step)
  })
})

describe('shelfPositions', () => {
  it('case terpilih ada di tengah rak', () => {
    const left = shelfPositions(5, 2, false, desktop)
    expect(left[2]).toBe(-(desktop.spine + desktop.face) / 2)
  })

  it('tetangga berjarak satu langkah, dengan ruang tambahan di sebelah case terbuka', () => {
    const left = shelfPositions(5, 2, false, desktop)
    expect(left[1]! - left[0]!).toBe(desktop.step)
    expect(left[4]! - left[3]!).toBe(desktop.step)
    expect(left[3]! - (left[2]! + desktop.spine + desktop.face)).toBe(desktop.breathe)
    expect(left[2]! - left[1]!).toBe(desktop.step + desktop.breathe)
  })

  it('piringan yang keluar menggeser tetangga kanan dan menjaga case serta piringan di tengah', () => {
    const closed = shelfPositions(3, 1, false, desktop)
    const open = shelfPositions(3, 1, true, desktop)
    const groupWidth = desktop.spine + desktop.face + desktop.discOut
    expect(open[1]).toBe(-groupWidth / 2)
    expect(open[2]! - closed[2]!).toBe(desktop.discOut / 2)
    expect(open[0]! - closed[0]!).toBe(-desktop.discOut / 2)
  })

  it('CD pertama dan terakhir juga bisa jadi yang di tengah', () => {
    expect(shelfPositions(4, 0, false, phone)[0]).toBe(-(phone.spine + phone.face) / 2)
    expect(shelfPositions(4, 3, true, phone)[3]).toBe(
      -(phone.spine + phone.face + phone.discOut) / 2,
    )
  })
})

describe('shelfVisible', () => {
  it('CD di luar lebar rak disembunyikan', () => {
    expect(shelfVisible(-100, 40, 358)).toBe(true)
    expect(shelfVisible(-260, 40, 358)).toBe(false)
    expect(shelfVisible(200, 40, 358)).toBe(false)
  })
})
