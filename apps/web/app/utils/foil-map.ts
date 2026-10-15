// Peta foil dari gambar (PRD Letter, langkah 2): Detail, Bayangan, dan Satu warna.
// Fungsi murni: masukan piksel RGBA, keluaran alpha 0–255 per piksel yang dipakai sebagai mask.
// Ambang dihitung dari histogram, jadi hasilnya konsisten untuk foto terang maupun gelap.

export interface Raster {
  data: Uint8ClampedArray
  width: number
  height: number
}

export type FoilMapMode = 'detail' | 'shadow' | 'color'

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Luminans per piksel (0–255). Piksel transparan dianggap kertas putih. */
export function lumaMap(img: Raster): Float32Array {
  const { data, width, height } = img
  const out = new Float32Array(width * height)
  for (let i = 0; i < out.length; i++) {
    const o = i * 4
    const a = data[o + 3]! / 255
    const l = 0.2126 * data[o]! + 0.7152 * data[o + 1]! + 0.0722 * data[o + 2]!
    out[i] = l * a + 255 * (1 - a)
  }
  return out
}

/**
 * Nilai ambang supaya kira-kira `share` bagian piksel terpilih: yang terkecil
 * (`fromTop = false`) atau yang terbesar (`fromTop = true`).
 */
export function thresholdForShare(values: Float32Array, share: number, fromTop: boolean): number {
  let max = 0
  for (const v of values) if (v > max) max = v
  if (max === 0) return 0
  const bins = 256
  const histogram = new Uint32Array(bins)
  for (const v of values) histogram[Math.min(bins - 1, Math.floor((v / max) * (bins - 1)))]!++
  const target = values.length * share
  let count = 0
  for (let i = 0; i < bins; i++) {
    const bin = fromTop ? bins - 1 - i : i
    count += histogram[bin]!
    if (count >= target) return (bin / (bins - 1)) * max
  }
  return fromTop ? 0 : max
}

/**
 * Bayangan: bagian tergelap gambar (sekitar `share` dari bagian yang bergambar) jadi foil, dengan
 * tepi halus. Ambangnya hanya dihitung dari piksel yang bergambar, dan latar transparan tidak
 * pernah jadi foil: di ilustrasi yang lowong, 22% piksel tergelap seluruh kanvas bisa jatuh di
 * kertas kosong, dan seluruh kartu jadi foil.
 */
export function shadowMask(img: Raster, { share = 0.22, soft = 14 } = {}): Uint8ClampedArray {
  const { data } = img
  const luma = lumaMap(img)
  const drawn = luma.filter((_, i) => data[i * 4 + 3]! >= 128)
  const t = thresholdForShare(drawn.length ? drawn : luma, share, false)
  const out = new Uint8ClampedArray(luma.length)
  for (let i = 0; i < luma.length; i++) {
    if (data[i * 4 + 3]! < 128) continue
    out[i] = smoothstep(t + soft, t, luma[i]!) * 255
  }
  return out
}

/** Detail: tepi dan garis gambar (Sobel) jadi foil, ditebalkan 1 piksel supaya terlihat. */
export function edgeMask(img: Raster, { share = 0.07 } = {}): Uint8ClampedArray {
  const { width, height } = img
  const luma = lumaMap(img)
  const magnitude = new Float32Array(luma.length)
  const at = (x: number, y: number) =>
    luma[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]!
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // prettier-ignore
      const gx =
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) -
        at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)
      // prettier-ignore
      const gy =
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) -
        at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)
      magnitude[y * width + x] = Math.hypot(gx, gy)
    }
  }
  const t = Math.max(1, thresholdForShare(magnitude, share, true))
  const soft = new Uint8ClampedArray(magnitude.length)
  for (let i = 0; i < magnitude.length; i++) soft[i] = smoothstep(t * 0.6, t, magnitude[i]!) * 255
  const out = new Uint8ClampedArray(soft.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let peak = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(width - 1, Math.max(0, x + dx))
          const yy = Math.min(height - 1, Math.max(0, y + dy))
          peak = Math.max(peak, soft[yy * width + xx]!)
        }
      }
      out[y * width + x] = peak
    }
  }
  return out
}

function hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, max === 0 ? 0 : d / max, max / 255]
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** Rona warna paling dominan (derajat), atau `null` kalau gambarnya praktis tanpa warna. */
export function dominantHue(img: Raster): number | null {
  const bins = new Float32Array(36)
  const { data } = img
  let total = 0
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3]! < 128) continue
    const [h, s, v] = hsv(data[o]!, data[o + 1]!, data[o + 2]!)
    if (s < 0.25 || v < 0.15) continue
    const weight = s * v
    bins[Math.floor(h / 10) % 36]! += weight
    total += weight
  }
  if (total === 0) return null
  let best = 0
  for (let i = 1; i < bins.length; i++) if (bins[i]! > bins[best]!) best = i
  return best * 10 + 5
}

/** Satu warna: piksel dengan rona dominan jadi foil. Gambar tanpa warna memakai Bayangan. */
export function colorMask(img: Raster, { tolerance = 22 } = {}): Uint8ClampedArray {
  const hue = dominantHue(img)
  if (hue === null) return shadowMask(img)
  const { data } = img
  const out = new Uint8ClampedArray(img.width * img.height)
  for (let i = 0; i < out.length; i++) {
    const o = i * 4
    if (data[o + 3]! < 128) continue
    const [h, s, v] = hsv(data[o]!, data[o + 1]!, data[o + 2]!)
    if (s < 0.2 || v < 0.12) continue
    out[i] = smoothstep(tolerance + 10, tolerance - 6, hueDistance(h, hue)) * 255
  }
  return out
}

export function foilMap(img: Raster, mode: FoilMapMode): Uint8ClampedArray {
  if (mode === 'detail') return edgeMask(img)
  if (mode === 'shadow') return shadowMask(img)
  return colorMask(img)
}
