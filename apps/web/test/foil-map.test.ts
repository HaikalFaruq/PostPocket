import { describe, expect, it } from 'vitest'
import {
  colorMask,
  dominantHue,
  edgeMask,
  lumaMap,
  shadowMask,
  thresholdForShare,
  type Raster,
} from '../app/utils/foil-map'

type Rgba = [number, number, number, number]

/** Gambar uji: `paint(x, y)` mengembalikan warna RGBA tiap piksel. */
function raster(width: number, height: number, paint: (x: number, y: number) => Rgba): Raster {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4)
  }
  return { data, width, height }
}

const black: Rgba = [0, 0, 0, 255]
const white: Rgba = [255, 255, 255, 255]
const at = (mask: Uint8ClampedArray, img: Raster, x: number, y: number) => mask[y * img.width + x]!

describe('lumaMap', () => {
  it('piksel transparan dianggap kertas putih', () => {
    const img = raster(2, 1, (x) => (x === 0 ? [0, 0, 0, 0] : black))
    expect([...lumaMap(img)]).toEqual([255, 0])
  })
})

describe('thresholdForShare', () => {
  it('memilih kira-kira bagian yang diminta', () => {
    const values = Float32Array.from({ length: 100 }, (_, i) => i)
    expect(thresholdForShare(values, 0.2, false)).toBeGreaterThanOrEqual(18)
    expect(thresholdForShare(values, 0.2, false)).toBeLessThanOrEqual(21)
    expect(thresholdForShare(values, 0.1, true)).toBeGreaterThanOrEqual(88)
  })
})

describe('shadowMask', () => {
  it('bagian gelap jadi foil, bagian terang tidak', () => {
    const img = raster(10, 4, (x) => (x < 3 ? black : white))
    const mask = shadowMask(img)
    expect(at(mask, img, 0, 0)).toBe(255)
    expect(at(mask, img, 9, 0)).toBe(0)
  })

  it('latar transparan ilustrasi tidak jadi foil', () => {
    const img = raster(10, 4, (x) => (x < 3 ? black : [0, 0, 0, 0]))
    const mask = shadowMask(img)
    expect(at(mask, img, 1, 1)).toBe(255)
    expect(at(mask, img, 8, 1)).toBe(0)
  })

  it('ilustrasi yang lowong: hanya bagian tergelap gambarnya yang jadi foil', () => {
    // 10% kanvas bergambar: setengah hijau tua, setengah hijau muda, sisanya kertas transparan.
    const img = raster(20, 10, (x, y) =>
      y > 0 ? [0, 0, 0, 0] : x < 10 ? [40, 80, 50, 255] : [180, 210, 180, 255],
    )
    const mask = shadowMask(img)
    expect(at(mask, img, 2, 0)).toBeGreaterThan(200)
    expect(at(mask, img, 15, 0)).toBe(0)
    expect(at(mask, img, 5, 5)).toBe(0)
  })
})

describe('edgeMask', () => {
  it('garis batas gelap-terang jadi foil, bidang rata tidak', () => {
    const img = raster(20, 10, (x) => (x < 10 ? black : white))
    const mask = edgeMask(img)
    expect(at(mask, img, 9, 5)).toBe(255)
    expect(at(mask, img, 10, 5)).toBe(255)
    expect(at(mask, img, 2, 5)).toBe(0)
    expect(at(mask, img, 17, 5)).toBe(0)
  })
})

describe('colorMask', () => {
  it('warna dominan jadi foil, abu-abu tidak', () => {
    const img = raster(12, 6, (x) => (x < 8 ? [220, 40, 30, 255] : [128, 128, 128, 255]))
    expect(dominantHue(img)).toBeLessThan(20)
    const mask = colorMask(img)
    expect(at(mask, img, 2, 2)).toBe(255)
    expect(at(mask, img, 10, 2)).toBe(0)
  })

  it('warna lain di luar rona dominan tidak ikut', () => {
    const img = raster(12, 6, (x) => (x < 8 ? [220, 40, 30, 255] : [30, 90, 220, 255]))
    const mask = colorMask(img)
    expect(at(mask, img, 2, 2)).toBe(255)
    expect(at(mask, img, 10, 2)).toBe(0)
  })

  it('gambar hitam-putih jatuh ke Bayangan', () => {
    const img = raster(10, 4, (x) => (x < 3 ? black : white))
    expect(dominantHue(img)).toBeNull()
    expect([...colorMask(img)]).toEqual([...shadowMask(img)])
  })
})
