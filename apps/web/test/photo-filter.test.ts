import { tv } from '@postpocket/presets'
import { describe, expect, it } from 'vitest'
import { applyFilterSteps, parseCssFilter } from '../app/utils/photo-filter'

function pixels(...rgb: [number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(rgb.flatMap(([r, g, b]) => [r, g, b, 255]))
}

function run(css: string, ...rgb: [number, number, number][]): number[] {
  const data = pixels(...rgb)
  applyFilterSteps(data, rgb.length, 1, parseCssFilter(css))
  return [...data]
}

describe('parseCssFilter', () => {
  it('semua filter preset TV bisa diterjemahkan', () => {
    for (const filter of tv.filters) expect(() => parseCssFilter(filter.css)).not.toThrow()
    expect(parseCssFilter('none')).toEqual([])
  })

  it('membaca persen, derajat, dan turn', () => {
    expect(parseCssFilter('brightness(50%)')).toEqual([
      { kind: 'linear', slope: 0.5, intercept: 0 },
    ])
    const half = parseCssFilter('hue-rotate(0.5turn)')[0]
    const deg = parseCssFilter('hue-rotate(180deg)')[0]
    expect(half).toEqual(deg)
  })

  it('menolak filter yang belum didukung', () => {
    expect(() => parseCssFilter('drop-shadow(0 0 2px red)')).toThrow(/drop-shadow/)
  })
})

describe('applyFilterSteps', () => {
  it('grayscale(1) membuat ketiga kanal sama', () => {
    const [r, g, b] = run('grayscale(1)', [200, 60, 40])
    expect(Math.abs(r! - g!)).toBeLessThanOrEqual(1)
    expect(Math.abs(g! - b!)).toBeLessThanOrEqual(1)
  })

  it('saturate(1), hue-rotate(0), brightness(1), contrast(1) tidak mengubah warna', () => {
    const before = [...pixels([200, 60, 40], [12, 140, 230])]
    expect(
      run('saturate(1) hue-rotate(0deg) brightness(1) contrast(1)', [200, 60, 40], [12, 140, 230]),
    ).toEqual(before)
  })

  it('brightness dan contrast mengikuti rumus linear spesifikasi', () => {
    expect(run('brightness(0.5)', [200, 100, 50]).slice(0, 3)).toEqual([100, 50, 25])
    // contrast(2): 2x - 0.5, lalu di-clamp
    expect(run('contrast(2)', [192, 128, 64]).slice(0, 3)).toEqual([255, 128, 0])
  })

  it('tiap langkah di-clamp seperti di browser', () => {
    // brightness(2) membuat 200 → 255 (clamp) sebelum brightness(0.5) → 128, bukan 200.
    expect(run('brightness(2) brightness(0.5)', [200, 200, 200]).slice(0, 3)).toEqual([
      128, 128, 128,
    ])
  })

  it('blur meratakan tepi tajam tanpa mengubah warna rata', () => {
    const flat = run('blur(1px)', [100, 100, 100], [100, 100, 100], [100, 100, 100])
    expect(flat.filter((_, i) => i % 4 !== 3)).toEqual(Array(9).fill(100))
    const edge = run('blur(1px)', [0, 0, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255])
    expect(edge[4]).toBeGreaterThan(0)
    expect(edge[8]).toBeLessThan(255)
  })

  it('alpha tidak berubah', () => {
    const data = new Uint8ClampedArray([200, 60, 40, 128])
    applyFilterSteps(data, 1, 1, parseCssFilter('sepia(1) contrast(1.4)'))
    expect(data[3]).toBe(128)
  })
})
