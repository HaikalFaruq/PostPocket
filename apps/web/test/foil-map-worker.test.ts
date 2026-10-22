import { describe, expect, it } from 'vitest'
import { foilMap } from '../app/utils/foil-map'
import { foilMapOffThread } from '../app/utils/foil-map-worker'

describe('peta foil di luar thread utama', () => {
  it('tanpa Web Worker tetap menghasilkan peta yang sama, dihitung di thread utama', async () => {
    const width = 8
    const height = 6
    const data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < width * height; i++) {
      const value = (i % width) * 32
      data.set([value, 255 - value, 90, 255], i * 4)
    }
    const raster = { data, width, height }
    expect(typeof Worker).toBe('undefined')
    for (const mode of ['detail', 'shadow', 'color'] as const) {
      expect(await foilMapOffThread(raster, mode)).toEqual(foilMap(raster, mode))
    }
  })
})
