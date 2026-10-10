import { describe, expect, it } from 'vitest'
import {
  BOOTH_LAYOUTS,
  SHOT_HEIGHT,
  SHOT_WIDTH,
  boothDate,
  stripGeometry,
} from '../app/utils/booth'

describe('stripGeometry', () => {
  it('jumlah kotak sesuai jumlah jepretan tiap tata letak', () => {
    for (const layout of BOOTH_LAYOUTS) {
      expect(stripGeometry(layout.value).cells, layout.value).toHaveLength(layout.shots)
    }
  })

  it('semua kotak 4:3, tidak saling tumpang, dan muat di bingkai', () => {
    for (const { value } of BOOTH_LAYOUTS) {
      const geometry = stripGeometry(value)
      for (const cell of geometry.cells) {
        expect(cell.width / cell.height).toBeCloseTo(SHOT_WIDTH / SHOT_HEIGHT, 2)
        expect(cell.x + cell.width).toBeLessThanOrEqual(geometry.width)
        expect(cell.y + cell.height).toBeLessThan(geometry.footer)
      }
      const overlaps = geometry.cells.some((a, i) =>
        geometry.cells.some(
          (b, j) =>
            i !== j &&
            a.x < b.x + b.width &&
            b.x < a.x + a.width &&
            a.y < b.y + b.height &&
            b.y < a.y + a.height,
        ),
      )
      expect(overlaps, value).toBe(false)
    }
  })

  it('strip memanjang, grid dua kolom', () => {
    const strip = stripGeometry('strip')
    expect(strip.height).toBeGreaterThan(strip.width * 2.5)
    expect(new Set(stripGeometry('grid').cells.map((cell) => cell.x)).size).toBe(2)
  })
})

describe('boothDate', () => {
  it('format tanggal di bingkai', () => {
    expect(boothDate(new Date(2026, 9, 5))).toBe('05.10.2026')
  })
})
