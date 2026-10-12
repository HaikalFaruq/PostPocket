import { describe, expect, it } from 'vitest'
import {
  easeOutBack,
  lineSpring,
  offsetFor,
  offsetRange,
  pad2,
  printWidth,
  releaseIndex,
  stringY,
  swingStep,
} from '../app/utils/photo-line'

describe('stringY', () => {
  it('tali paling rendah di tengah dan setinggi ujungnya di tepi', () => {
    expect(stringY(0, 400, 30, 40)).toBe(30)
    expect(stringY(400, 400, 30, 40)).toBe(30)
    expect(stringY(200, 400, 30, 40)).toBe(70)
    expect(stringY(100, 400, 30, 40)).toBeLessThan(70)
  })

  it('foto di luar layar tetap menempel di ketinggian ujung tali', () => {
    expect(stringY(-50, 400, 30, 40)).toBe(30)
    expect(stringY(480, 400, 30, 40)).toBe(30)
  })
})

describe('lineSpring', () => {
  it('tali sampai ke foto tujuan dan berhenti di sana', () => {
    let x = 0
    let v = 0
    for (let i = 0; i < 240; i++) [x, v] = lineSpring(x, v, 300, 1 / 60)
    expect(x).toBeCloseTo(300, 0)
    expect(Math.abs(v)).toBeLessThan(1)
  })
})

describe('swingStep', () => {
  it('foto yang ditarik ke kanan berayun lalu tenang kembali', () => {
    let angle = 0
    let spin = 0
    ;[angle, spin] = swingStep(angle, spin, 1200, 1 / 60, 1)
    expect(angle).toBeGreaterThan(0)
    for (let i = 0; i < 600; i++) [angle, spin] = swingStep(angle, spin, 0, 1 / 60, 1)
    expect(Math.abs(angle)).toBeLessThan(0.001)
  })

  it('tanpa ayunan (gain 0) foto diam, dan sudutnya tidak pernah lebih dari batas', () => {
    expect(swingStep(0, 0, 5000, 1 / 60, 0)).toEqual([0, 0])
    expect(swingStep(0.59, 80, 0, 1 / 60, 1)[0]).toBe(0.6)
  })
})

describe('offsetRange dan offsetFor', () => {
  it('di HP foto yang dilihat selalu di tengah tali', () => {
    const range = offsetRange(4, 180, 390, 164)
    expect(range).toEqual([0, 540])
    expect(offsetFor(0, 180, range)).toBe(0)
    expect(offsetFor(3, 180, range)).toBe(540)
  })

  it('kalau semua foto muat, kelompoknya di tengah dan tali tidak bergeser', () => {
    const range = offsetRange(3, 237, 1440, 220)
    expect(range).toEqual([237, 237])
    expect(offsetFor(0, 237, range)).toBe(237)
    expect(offsetFor(2, 237, range)).toBe(237)
  })

  it('di layar lebar dengan banyak foto, ujung tali tidak pernah kosong separuh', () => {
    const range = offsetRange(9, 237, 1440, 220)
    // Foto pertama menempel di tepi kiri, foto terakhir di tepi kanan.
    expect(1440 / 2 - offsetFor(0, 237, range)).toBe(220 / 2 + 16)
    expect(1440 / 2 + 8 * 237 - offsetFor(8, 237, range)).toBe(1440 - 220 / 2 - 16)
    expect(offsetFor(4, 237, range)).toBe(4 * 237)
  })
})

describe('releaseIndex', () => {
  it('seretan sejauh satu foto pindah satu foto, lemparan meluncur lebih jauh', () => {
    expect(releaseIndex(1, 200, 390, 0, 200, 5)).toBe(2)
    expect(releaseIndex(1, 200, 250, 0, 200, 5)).toBe(1)
    expect(releaseIndex(1, 200, 210, -3, 200, 5)).toBe(4)
    expect(releaseIndex(1, 200, 190, 5, 200, 5)).toBe(0)
  })

  it('bekerja sama saat tali tidak bergeser karena semua foto muat', () => {
    expect(releaseIndex(0, 237, 237 + 260, 0, 237, 3)).toBe(1)
  })
})

describe('printWidth', () => {
  it('foto mengecil di HP dan tidak melebihi batas di layar lebar', () => {
    expect(printWidth(390, 420, 220)).toBe(164)
    expect(printWidth(1440, 900, 220)).toBe(220)
    expect(printWidth(200, 200, 220)).toBe(120)
  })
})

it('pad2 dan easeOutBack', () => {
  expect(pad2(3)).toBe('03')
  expect(pad2(12)).toBe('12')
  expect(easeOutBack(0)).toBeCloseTo(0)
  expect(easeOutBack(1)).toBeCloseTo(1)
  expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map(easeOutBack))).toBeGreaterThan(1)
})
