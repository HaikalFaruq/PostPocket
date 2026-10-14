import { describe, expect, it } from 'vitest'
import type { HairlineFigure } from '../app/utils/hairline/figure'
import booth from '../app/utils/hairline/booth'
import pocket from '../app/utils/hairline/pocket'
import surat from '../app/utils/hairline/surat'

const figures: HairlineFigure[] = [surat, pocket, booth]

describe('figur Hairline di Beranda', () => {
  it.each(figures.map((figure) => [figure.name, figure] as const))(
    '%s mengikuti bentuk figur hairline-create',
    (_, figure) => {
      expect(figure.label.length).toBeGreaterThan(20)
      expect(figure.rest).toBe('rest')
      // Satu angka di intensitas 0, 0,5, dan 1, bergerak ke satu arah.
      expect(figure.range).toHaveLength(3)
      expect(figure.range[0]!).toBeLessThan(figure.range[1]!)
      expect(figure.range[1]!).toBeLessThan(figure.range[2]!)
      // Tur: tiga sampai enam titik di viewBox 400 × 320, lalu pergi supaya kembali diam.
      const tour = figure.tour ?? []
      expect(tour.length).toBeGreaterThanOrEqual(3)
      expect(tour.length).toBeLessThanOrEqual(6)
      expect(tour.at(-1)).toBeNull()
      for (const stop of tour.slice(0, -1)) {
        const [x, y] = stop!
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(400)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(320)
      }
    },
  )

  it('tiga figur, tiga nama berbeda, urut seperti di Beranda', () => {
    expect(figures.map((figure) => figure.name)).toEqual(['surat', 'pocket', 'booth'])
  })
})
