import { describe, expect, it } from 'vitest'
import {
  PACKET_W,
  TEAR_MAX,
  TEAR_MIN,
  TEAR_Y,
  autoTear,
  beginTear,
  extendTear,
  jag,
  liftAt,
  raggedLine,
  regionPath,
  tearBoundary,
  tearProgress,
  tearTip,
  tornPath,
} from '../app/utils/packet-tear'

describe('sobekan mengikuti jari', () => {
  it('mulai dari tepi kiri untuk tarikan ke kanan, dari tepi kanan untuk tarikan ke kiri', () => {
    expect(tearTip(beginTear(1)).x).toBe(0)
    expect(tearTip(beginTear(-1)).x).toBe(PACKET_W)
    expect(tearProgress(beginTear(1))).toBe(0)
  })

  it('memanjang ke posisi jari, tingginya ikut jari tapi tetap di dekat garis putus-putus', () => {
    let tear = beginTear(1)
    tear = extendTear(tear, 80, 200)
    expect(tearTip(tear)).toEqual({ x: 80, y: TEAR_MAX })
    expect(tearProgress(tear)).toBeCloseTo(0.4)
    tear = extendTear(tear, 140, -30)
    expect(tearTip(tear).y).toBe(TEAR_MIN)
    // Titik-titik di antaranya diisi, jadi lompatan jauh tetap jadi garis yang halus.
    expect(tear.points.length).toBeGreaterThan(20)
  })

  it('tidak pernah mundur: jari yang kembali tidak menyambung sobekan', () => {
    const tear = extendTear(beginTear(1), 120, TEAR_Y)
    expect(extendTear(tear, 60, TEAR_Y)).toBe(tear)
    const left = extendTear(beginTear(-1), 50, TEAR_Y)
    expect(tearProgress(left)).toBeCloseTo(0.75)
    expect(extendTear(left, 120, TEAR_Y)).toBe(left)
  })

  it('jari di luar kantong berhenti di tepi seberang', () => {
    expect(tearProgress(extendTear(beginTear(1), 999, TEAR_Y))).toBe(1)
    expect(tearProgress(extendTear(beginTear(-1), -40, TEAR_Y))).toBe(1)
  })
})

describe('animasi ketuk', () => {
  it('sobekan otomatis bergerak sampai tuntas di sekitar garis putus-putus', () => {
    expect(tearProgress(autoTear(1, 0))).toBe(0)
    expect(tearProgress(autoTear(1, 0.5))).toBeCloseTo(0.5, 1)
    const done = autoTear(-1, 1)
    expect(tearProgress(done)).toBe(1)
    for (const p of done.points) expect(Math.abs(p.y - TEAR_Y)).toBeLessThan(4)
  })
})

describe('bentuk sobekan', () => {
  it('gerigi tetap sama untuk posisi yang sama', () => {
    expect(jag(42)).toBe(jag(42))
    for (const x of [0, 13.5, 99, 180]) expect(Math.abs(jag(x))).toBeLessThanOrEqual(1)
    const line = raggedLine([
      { x: 0, y: 30 },
      { x: 50, y: 40 },
    ])
    expect(line.length).toBe(21)
    expect(line.some((p) => p.y !== 30 + (p.x / 50) * 10)).toBe(true)
  })

  it('batas selalu dari tepi kiri ke tepi kanan, apa pun arah sobekannya', () => {
    for (const dir of [1, -1] as const) {
      const boundary = tearBoundary(extendTear(beginTear(dir), 100, TEAR_Y))
      expect(boundary[0]!.x).toBeLessThan(0)
      expect(boundary[boundary.length - 1]!.x).toBeGreaterThan(PACKET_W)
    }
  })

  it('path atas dan bawah tertutup, celah paling lebar di tepi awal', () => {
    const tear = extendTear(beginTear(1), 120, TEAR_Y)
    const boundary = tearBoundary(tear)
    expect(regionPath(boundary, 'above')).toMatch(/^M-6 -40 L.* Z$/)
    expect(regionPath(boundary, 'below')).toMatch(/ 330 Z$/)
    const lift = liftAt(tear, 6)
    expect(lift(0)).toBe(6)
    expect(lift(120)).toBe(0)
    expect(lift(160)).toBe(0)
    expect(lift(30)).toBeGreaterThan(lift(90))
    expect(tornPath(beginTear(1))).toBe('')
    expect(tornPath(tear)).toMatch(/^M0 /)
  })
})
