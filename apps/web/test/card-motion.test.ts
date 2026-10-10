import { describe, expect, it } from 'vitest'
import {
  clamp,
  frameStats,
  frontAngle,
  hoverTilt,
  isTap,
  restAngle,
  sheen,
  springStep,
} from '../app/utils/card-motion'

describe('isTap', () => {
  it('gerakan kecil dan cepat dianggap tap', () => {
    expect(isTap(2, 3, 120)).toBe(true)
  })

  it('geser jauh atau tekan lama bukan tap', () => {
    expect(isTap(30, 0, 120)).toBe(false)
    expect(isTap(1, 1, 600)).toBe(false)
  })
})

describe('restAngle', () => {
  it('berhenti di muka terdekat', () => {
    expect(restAngle(30)).toBe(0)
    expect(restAngle(100)).toBe(180)
    expect(restAngle(260)).toBe(180)
    expect(restAngle(-100)).toBe(-180)
  })

  it('lemparan cepat membalik kartu meski sudutnya masih kecil', () => {
    expect(restAngle(60, 1)).toBe(180)
    expect(restAngle(60, 0)).toBe(0)
  })
})

describe('frontAngle', () => {
  it('memilih kelipatan 360 terdekat', () => {
    expect(frontAngle(170)).toBe(0)
    expect(frontAngle(200)).toBe(360)
    expect(frontAngle(-200)).toBe(-360)
  })
})

describe('hoverTilt', () => {
  it('tengah tidak miring, tepi miring berlawanan', () => {
    expect(hoverTilt(0.5, 0.5)).toEqual({ rx: 0, ry: 0 })
    const topLeft = hoverTilt(0, 0)
    const bottomRight = hoverTilt(1, 1)
    expect(topLeft.rx).toBeGreaterThan(0)
    expect(topLeft.ry).toBeLessThan(0)
    expect(bottomRight.rx).toBe(-topLeft.rx)
    expect(bottomRight.ry).toBe(-topLeft.ry)
  })

  it('posisi di luar area dibatasi', () => {
    expect(hoverTilt(5, -5)).toEqual(hoverTilt(1, 0))
  })
})

describe('sheen', () => {
  it('diam saat kartu lurus dan bergeser saat diputar', () => {
    const rest = sheen(0, 0)
    expect(Math.abs(rest.metalX)).toBe(0)
    expect(Math.abs(rest.glareY)).toBe(0)
    const turned = sheen(0, 90)
    expect(turned.metalX).toBeCloseTo(-22)
    expect(turned.glareX).toBeCloseTo(48)
  })
})

describe('springStep', () => {
  it('mendekati target tanpa memantul jauh', () => {
    let value = 0
    let velocity = 0
    let peak = 0
    for (let i = 0; i < 120; i++) {
      ;[value, velocity] = springStep(value, velocity, 180, 1 / 60)
      peak = Math.max(peak, value)
    }
    expect(value).toBeCloseTo(180, 0)
    expect(peak).toBeLessThan(180 * 1.1)
  })
})

describe('clamp', () => {
  it('membatasi nilai', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })
})

describe('frameStats', () => {
  it('60 fps stabil tidak punya frame lambat', () => {
    const stats = frameStats(Array.from({ length: 240 }, () => 1000 / 60))
    expect(stats.fps).toBeCloseTo(60, 0)
    expect(stats.slowShare).toBe(0)
    expect(stats.frames).toBe(240)
  })

  it('menghitung porsi frame di atas 20 ms', () => {
    const deltas = [
      ...Array.from({ length: 90 }, () => 16.7),
      ...Array.from({ length: 10 }, () => 33.4),
    ]
    const stats = frameStats(deltas)
    expect(stats.slowShare).toBe(0.1)
    expect(stats.p95).toBe(33.4)
    expect(stats.fps).toBeLessThan(60)
  })

  it('aman untuk data kosong', () => {
    expect(frameStats([])).toEqual({ fps: 0, p95: 0, slowShare: 0, frames: 0 })
  })
})
