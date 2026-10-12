import { describe, expect, it } from 'vitest'
import {
  easeOutBack,
  flingTarget,
  nearestAt,
  pad2,
  printWidth,
  lineSpring,
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

describe('nearestAt dan flingTarget', () => {
  it('foto terdekat ke tengah, tidak pernah di luar daftar', () => {
    expect(nearestAt(0, 200, 5)).toBe(0)
    expect(nearestAt(290, 200, 5)).toBe(1)
    expect(nearestAt(310, 200, 5)).toBe(2)
    expect(nearestAt(-400, 200, 5)).toBe(0)
    expect(nearestAt(5000, 200, 5)).toBe(4)
    expect(nearestAt(100, 200, 0)).toBe(0)
  })

  it('lemparan ke kiri meluncur ke foto berikutnya, lemparan pelan tetap di tempat', () => {
    expect(flingTarget(200, -2, 200, 5)).toBe(3)
    expect(flingTarget(200, 0.1, 200, 5)).toBe(1)
    expect(flingTarget(200, 3, 200, 5)).toBe(0)
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
