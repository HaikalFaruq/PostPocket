import { describe, expect, it } from 'vitest'
import {
  ejectKeyframes,
  followPointer,
  inside,
  insertKeyframes,
  slotScale,
} from '../app/utils/cd-flight'

const disc = { left: 500, top: 700, width: 180, height: 180 }
const slot = { left: 300, top: 420, width: 200, height: 12 }

/** Ambil angka translate, rotateX, dan scale dari satu transform keyframe. */
function parts(frame: Keyframe) {
  const value = String(frame.transform)
  const [, x, y] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(value)!
  return {
    x: Number(x),
    y: Number(y),
    tilt: Number(/rotateX\((-?[\d.]+)deg\)/.exec(value)![1]),
    scale: Number(/scale\(([\d.]+)\)/.exec(value)![1]),
  }
}

describe('insertKeyframes', () => {
  const frames = insertKeyframes(disc, slot)

  it('mulai dari posisi piringan, tanpa miring', () => {
    expect(parts(frames[0]!)).toEqual({ x: 0, y: 0, tilt: 0, scale: 1 })
    expect(frames[0]!.opacity).toBe(1)
  })

  it('berakhir tertelan di tengah slot: hampir tegak lurus, selebar mulut slot, lalu hilang', () => {
    const last = parts(frames.at(-1)!)
    // Tengah slot (400, 426) dikurangi tengah piringan (590, 790).
    expect(last.x).toBe(-190)
    expect(last.y).toBeGreaterThan(-364)
    expect(last.tilt).toBeGreaterThanOrEqual(85)
    expect(last.scale).toBeLessThanOrEqual(slotScale(disc, slot))
    expect(frames.at(-1)!.opacity).toBe(0)
  })

  it('diangkat dulu sebelum terbang, dan miringnya terus bertambah', () => {
    expect(parts(frames[1]!).y).toBeLessThan(0)
    const tilts = frames.map((frame) => parts(frame).tilt)
    expect([...tilts].sort((a, b) => a - b)).toEqual(tilts)
  })

  it('offset keyframe urut dari 0 sampai 1', () => {
    const offsets = frames.map((frame) => frame.offset)
    expect(offsets[0]).toBe(0)
    expect(offsets.at(-1)).toBe(1)
    expect([...offsets].sort()).toEqual(offsets)
  })
})

describe('ejectKeyframes', () => {
  it('kebalikan dari memasukkan: muncul dari slot lalu kembali tegak di rak', () => {
    const frames = ejectKeyframes(slot, disc)
    expect(frames[0]!.opacity).toBe(0)
    expect(parts(frames[0]!).tilt).toBeGreaterThanOrEqual(85)
    expect(parts(frames.at(-1)!)).toEqual({ x: 0, y: 0, tilt: 0, scale: 1 })
    const offsets = frames.map((frame) => frame.offset)
    expect(offsets[0]).toBe(0)
    expect(offsets.at(-1)).toBe(1)
  })
})

describe('slotScale', () => {
  it('piringan besar diperkecil supaya muat di slot, yang kecil tidak diperbesar', () => {
    expect(slotScale(disc, slot)).toBeCloseTo(1)
    expect(slotScale({ ...disc, width: 360, height: 360 }, slot)).toBeCloseTo(0.5)
  })
})

describe('followPointer dan inside', () => {
  it('piringan mengikuti jari dari titik pegangnya', () => {
    expect(followPointer(disc, { x: 30, y: 40 }, { x: 200, y: 300 })).toMatchObject({
      left: 170,
      top: 260,
    })
  })

  it('mengenali piringan yang dilepas di atas TV', () => {
    const tv = { left: 100, top: 100, width: 500, height: 400 }
    expect(inside({ x: 120, y: 480 }, tv)).toBe(true)
    expect(inside({ x: 90, y: 480 }, tv)).toBe(false)
    expect(inside({ x: 90, y: 480 }, tv, 16)).toBe(true)
  })
})
