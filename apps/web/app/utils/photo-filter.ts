// Jalur cadangan filter foto untuk browser tanpa `ctx.filter` (Safari).
// String CSS filter dari preset diterjemahkan ke langkah piksel sesuai spesifikasi Filter Effects:
// grayscale, sepia, saturate, hue-rotate memakai matriks warna 3×3; brightness dan contrast
// memakai fungsi linear; blur memakai Gaussian. Tiap langkah di-clamp ke 0–1 seperti di browser.

export type FilterStep =
  | { kind: 'matrix'; m: readonly number[] }
  | { kind: 'linear'; slope: number; intercept: number }
  | { kind: 'blur'; radius: number }

function amount(raw: string, fallback = 1): number {
  const value = raw.trim()
  if (value === '') return fallback
  return value.endsWith('%') ? Number.parseFloat(value) / 100 : Number.parseFloat(value)
}

function angle(raw: string): number {
  const value = raw.trim()
  const n = Number.parseFloat(value)
  if (value.endsWith('turn')) return n * 2 * Math.PI
  if (value.endsWith('grad')) return (n * Math.PI) / 200
  if (value.endsWith('rad')) return n
  return (n * Math.PI) / 180
}

function grayscale(a: number): number[] {
  const k = 1 - Math.min(1, Math.max(0, a))
  // prettier-ignore
  return [
    0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k,
    0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k,
    0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k,
  ]
}

function sepia(a: number): number[] {
  const k = 1 - Math.min(1, Math.max(0, a))
  // prettier-ignore
  return [
    0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k,
    0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k,
    0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k,
  ]
}

function saturate(s: number): number[] {
  // prettier-ignore
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ]
}

function hueRotate(theta: number): number[] {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  // prettier-ignore
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ]
}

/** Terjemahkan nilai CSS `filter` (misalnya "sepia(0.25) contrast(1.1)") jadi langkah piksel. */
export function parseCssFilter(css: string): FilterStep[] {
  const steps: FilterStep[] = []
  for (const [, name, arg = ''] of css.matchAll(/([a-z-]+)\(([^)]*)\)/g)) {
    switch (name) {
      case 'grayscale':
        steps.push({ kind: 'matrix', m: grayscale(amount(arg)) })
        break
      case 'sepia':
        steps.push({ kind: 'matrix', m: sepia(amount(arg)) })
        break
      case 'saturate':
        steps.push({ kind: 'matrix', m: saturate(amount(arg)) })
        break
      case 'hue-rotate':
        steps.push({ kind: 'matrix', m: hueRotate(angle(arg || '0deg')) })
        break
      case 'brightness':
        steps.push({ kind: 'linear', slope: amount(arg), intercept: 0 })
        break
      case 'contrast': {
        const c = amount(arg)
        steps.push({ kind: 'linear', slope: c, intercept: 0.5 - 0.5 * c })
        break
      }
      case 'blur':
        steps.push({ kind: 'blur', radius: Number.parseFloat(arg) || 0 })
        break
      default:
        throw new Error(`Filter CSS belum didukung jalur cadangan: ${name}`)
    }
  }
  return steps
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Gaussian blur terpisah (horizontal lalu vertikal) dengan simpangan baku `radius`, tepi di-clamp. */
function blur(data: Uint8ClampedArray, width: number, height: number, radius: number) {
  if (radius <= 0) return
  const reach = Math.ceil(radius * 3)
  const kernel: number[] = []
  let total = 0
  for (let i = -reach; i <= reach; i++) {
    const w = Math.exp(-(i * i) / (2 * radius * radius))
    kernel.push(w)
    total += w
  }
  for (let i = 0; i < kernel.length; i++) kernel[i]! /= total
  const temp = new Float32Array(data.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0
        for (let k = -reach; k <= reach; k++) {
          const xx = Math.min(width - 1, Math.max(0, x + k))
          sum += data[(y * width + xx) * 4 + ch]! * kernel[k + reach]!
        }
        temp[(y * width + x) * 4 + ch] = sum
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0
        for (let k = -reach; k <= reach; k++) {
          const yy = Math.min(height - 1, Math.max(0, y + k))
          sum += temp[(yy * width + x) * 4 + ch]! * kernel[k + reach]!
        }
        data[(y * width + x) * 4 + ch] = sum
      }
    }
  }
}

/**
 * Terapkan langkah filter ke piksel RGBA (di tempat). Alpha tidak diubah.
 * Blur dijalankan setelah semua langkah warna; di preset TV blur memang selalu terakhir.
 */
export function applyFilterSteps(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  steps: readonly FilterStep[],
): void {
  const colorSteps = steps.filter((step) => step.kind !== 'blur')
  if (colorSteps.length) {
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i]! / 255
      let g = data[i + 1]! / 255
      let b = data[i + 2]! / 255
      for (const step of steps) {
        if (step.kind === 'matrix') {
          const m = step.m
          const nr = m[0]! * r + m[1]! * g + m[2]! * b
          const ng = m[3]! * r + m[4]! * g + m[5]! * b
          const nb = m[6]! * r + m[7]! * g + m[8]! * b
          r = clamp01(nr)
          g = clamp01(ng)
          b = clamp01(nb)
        } else if (step.kind === 'linear') {
          r = clamp01(r * step.slope + step.intercept)
          g = clamp01(g * step.slope + step.intercept)
          b = clamp01(b * step.slope + step.intercept)
        }
      }
      data[i] = r * 255
      data[i + 1] = g * 255
      data[i + 2] = b * 255
    }
  }
  for (const step of steps) {
    if (step.kind === 'blur') blur(data, width, height, step.radius)
  }
}

let canvasFilter: boolean | undefined

/** Apakah `ctx.filter` benar-benar mengubah piksel (Safari belum mendukung). */
export function canvasFilterSupported(): boolean {
  if (canvasFilter !== undefined) return canvasFilter
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || !('filter' in ctx)) return (canvasFilter = false)
  ctx.filter = 'grayscale(1)'
  ctx.fillStyle = 'rgb(255, 0, 0)'
  ctx.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0] = ctx.getImageData(0, 0, 1, 1).data
  return (canvasFilter = Math.abs(r - g) < 10)
}

/**
 * Gambar `source` ke kanvas dengan filter CSS yang sama seperti di layar. Memakai `ctx.filter`
 * bila didukung, kalau tidak memakai jalur cadangan di atas.
 */
export function drawFiltered(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  css: string,
  options: { mirror?: boolean } = {},
): void {
  const native = css === 'none' || canvasFilterSupported()
  ctx.save()
  if (options.mirror) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  }
  if (native) ctx.filter = css
  ctx.drawImage(source, 0, 0, width, height)
  ctx.restore()
  if (native) return
  const image = ctx.getImageData(0, 0, width, height)
  applyFilterSteps(image.data, width, height, parseCssFilter(css))
  ctx.putImageData(image, 0, 0)
}
