import type { FolderArt } from '@postpocket/presets'
import { hexToRgb } from './color'

// Seni panel belakang folder kaca (Kotak surat), diadaptasi dari komponen "Glassmorphism Folder
// Cards" karya Kedhareswer Naidu di 21st.dev (MIT, lihat docs/assets.md): bidang noise yang dilipat dua kali, lalu diwarnai sebagai permukaan
// cairan. Dikerjakan bertahap per baris supaya tidak ada tugas panjang yang membuat animasi
// tersendat di HP; utils/folder-paint.ts yang membagi kerjanya ke beberapa frame.

export type ArtRecipe = Pick<
  FolderArt,
  'style' | 'colors' | 'scale' | 'warp' | 'angle' | 'gloss' | 'veins'
>

/** PRNG kecil yang bisa diulang (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Angka stabil dari teks, supaya seni sebuah folder selalu sama untuk id yang sama. */
export function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Noise gradien bersemai, dijumlah beberapa oktaf dengan rotasi di tiap oktaf. */
function makeFbm(seed: number): (x: number, y: number, octaves: number) => number {
  const random = rng(seed)
  const perm = new Uint8Array(512)
  const grad = new Float32Array(512)
  const order = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  for (let i = 0; i < 512; i++) perm[i] = order[i & 255]!
  for (let i = 0; i < 256; i++) {
    const a = random() * Math.PI * 2
    grad[i * 2] = Math.cos(a)
    grad[i * 2 + 1] = Math.sin(a)
  }
  const noise = (x: number, y: number): number => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const X = xi & 255
    const Y = yi & 255
    const h00 = perm[X + perm[Y]!]! * 2
    const h10 = perm[X + 1 + perm[Y]!]! * 2
    const h01 = perm[X + perm[Y + 1]!]! * 2
    const h11 = perm[X + 1 + perm[Y + 1]!]! * 2
    const d00 = grad[h00]! * xf + grad[h00 + 1]! * yf
    const d10 = grad[h10]! * (xf - 1) + grad[h10 + 1]! * yf
    const d01 = grad[h01]! * xf + grad[h01 + 1]! * (yf - 1)
    const d11 = grad[h11]! * (xf - 1) + grad[h11 + 1]! * (yf - 1)
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
    return d00 + u * (d10 - d00) + v * (d01 - d00 + u * (d11 - d01 - d10 + d00))
  }
  return (x, y, octaves) => {
    let sum = 0
    let amp = 0.5
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise(x, y)
      const nx = 1.6 * x + 1.2 * y + 7.1
      y = -1.2 * x + 1.6 * y + 3.3
      x = nx
      amp *= 0.5
    }
    return sum
  }
}

export interface ArtJob {
  width: number
  height: number
  /** RGBA, siap untuk `new ImageData(pixels, width, height)`. */
  pixels: Uint8ClampedArray<ArrayBuffer>
  /** Kerjakan satu potong lagi. `true` begitu gambarnya selesai. */
  step: () => boolean
}

/**
 * Gambar seni sebagai pekerjaan bertahap. Bidangnya dilipat dua kali (lipatan pertama menjadi
 * masukan lipatan kedua), lalu dinormalkan dengan persentilnya sendiri supaya setiap semai
 * memakai seluruh palet. Bidang itu diperlakukan sebagai tinggi permukaan cairan: kemiringannya
 * memberi arah cahaya, kilau, dan guratan halus seperti tinta yang disisir. `streak` memampatkan
 * koordinat ke satu arah dulu, jadi lipatan yang sama terlihat seperti foto bukaan lama.
 *
 * Tahapnya: bidang di grid setengah resolusi (per baris grid), perbesar dengan Catmull-Rom (per
 * baris piksel), lalu pewarnaan (per baris piksel). Tiap `step()` paling lama sekitar 1 ms di HP.
 */
export function createArtJob(
  width: number,
  height: number,
  recipe: ArtRecipe,
  seed: number,
): ArtJob {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const colors = recipe.colors.length >= 2 ? recipe.colors : ['#111111', '#eeeeee']
  const stops = colors.map((color, i) => ({ t: i / (colors.length - 1), c: hexToRgb(color) }))
  const { scale, warp, gloss, veins } = recipe
  const streak = recipe.style === 'streak'
  const fbm = makeFbm(seed * 977 + 13)
  const random = rng(seed + 1)
  const ox = random() * 50
  const oy = random() * 50
  const angle = recipe.angle + (random() - 0.5) * 0.5
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  const m = Math.min(w, h)
  // Grid setengah resolusi dengan satu sel cadangan di tiap sisi, diperbesar dengan Catmull-Rom
  // yang menjaga kemiringan tetap mulus untuk pencahayaan: seperempat kerja noise, tanpa beda.
  const gw = Math.ceil(w / 2) + 3
  const gh = Math.ceil(h / 2) + 3
  const G = new Float32Array(gw * gh)
  const GQ = new Float32Array(gw * gh)
  const T = new Float32Array(w * gh)
  const F = new Float32Array(w * h)
  const Q = new Float32Array(w * h)
  const pixels = new Uint8ClampedArray(new ArrayBuffer(w * h * 4))
  const cr = (a: number, b: number, c: number, d: number) => (-a + 9 * b + 9 * c - d) / 16

  let phase: 'field' | 'columns' | 'rows' | 'color' | 'done' = 'field'
  let row = 0
  let lo = 0
  let k = 1
  let slope = 0

  const field = (gy: number) => {
    for (let gx = 0; gx < gw; gx++) {
      const u = ((gx - 1) * 2 - w / 2) / m
      const v = ((gy - 1) * 2 - h / 2) / m
      let px = (u * ca - v * sa) * scale
      let py = (u * sa + v * ca) * scale
      if (streak) {
        px *= 0.14
        py *= 2.2
      }
      px += ox
      py += oy
      const qx = fbm(px, py, 3)
      const qy = fbm(px + 5.2, py + 1.3, 3)
      const rx = fbm(px + warp * qx + 1.7, py + warp * qy + 9.2, 3)
      const ry = fbm(px + warp * qx + 8.3, py + warp * qy + 2.8, 3)
      G[gy * gw + gx] = fbm(px + warp * rx, py + warp * ry, 4)
      GQ[gy * gw + gx] = Math.sqrt(qx * qx + qy * qy)
    }
  }

  // Piksel x ada di kolom grid x/2 + 1: tepat di sampel, atau di tengah dua sampel.
  const columns = (gy: number) => {
    const r = gy * gw
    for (let x = 0; x < w; x++) {
      const c = (x >> 1) + 1
      T[gy * w + x] = x & 1 ? cr(G[r + c - 1]!, G[r + c]!, G[r + c + 1]!, G[r + c + 2]!) : G[r + c]!
    }
  }

  const rows = (y: number) => {
    const c = (y >> 1) + 1
    for (let x = 0; x < w; x++) {
      F[y * w + x] =
        y & 1
          ? cr(T[(c - 1) * w + x]!, T[c * w + x]!, T[(c + 1) * w + x]!, T[(c + 2) * w + x]!)
          : T[c * w + x]!
      const gx = (x >> 1) + 1
      const q0 = GQ[c * gw + gx]!
      const qx = x & 1 ? (q0 + GQ[c * gw + gx + 1]!) / 2 : q0
      const q1 =
        y & 1
          ? x & 1
            ? (GQ[(c + 1) * gw + gx]! + GQ[(c + 1) * gw + gx + 1]!) / 2
            : GQ[(c + 1) * gw + gx]!
          : qx
      Q[y * w + x] = (qx + q1) / 2
    }
  }

  // Persentil dari sampel, bukan pengurutan penuh: murah dan sama stabilnya.
  const percentiles = () => {
    const sample: number[] = []
    const stride = Math.max(1, Math.floor(F.length / 4096))
    for (let i = 0; i < F.length; i += stride) sample.push(F[i]!)
    sample.sort((a, b) => a - b)
    lo = sample[Math.floor(sample.length * 0.02)]!
    const hi = sample[Math.floor(sample.length * 0.98)]!
    k = 1 / (hi - lo || 1)
    slope = k * m * 0.012
  }

  const lx = -0.55
  const ly = -0.65
  const lz = 0.52
  const color = (y: number) => {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let t = (F[i]! - lo) * k
      t = t < 0 ? 0 : t > 1 ? 1 : t
      let j = 1
      while (j < stops.length - 1 && stops[j]!.t < t) j++
      const a = stops[j - 1]!
      const b = stops[j]!
      let f = (t - a.t) / (b.t - a.t || 1)
      f = f < 0 ? 0 : f > 1 ? 1 : f
      f = f * f * (3 - 2 * f)
      const gx = (F[x < w - 1 ? i + 1 : i]! - F[x > 0 ? i - 1 : i]!) * slope
      const gy = (F[y < h - 1 ? i + w : i]! - F[y > 0 ? i - w : i]!) * slope
      const nd = (-gx * lx - gy * ly + lz) / Math.sqrt(gx * gx + gy * gy + 1)
      const spec = Math.pow(nd > 0 ? nd : 0, 24) * gloss * 255
      const silk = 1 + 0.035 * Math.sin(t * 150 + Q[i]! * 24)
      const vein = veins * Math.max(0, 1 - Math.abs(Q[i]! - 0.42) * 14) * 0.6
      const lit = (0.82 + 0.28 * nd) * silk * (1 - vein)
      pixels[i * 4] = (a.c[0] + (b.c[0] - a.c[0]) * f) * lit + spec
      pixels[i * 4 + 1] = (a.c[1] + (b.c[1] - a.c[1]) * f) * lit + spec
      pixels[i * 4 + 2] = (a.c[2] + (b.c[2] - a.c[2]) * f) * lit + spec
      pixels[i * 4 + 3] = 255
    }
  }

  // Banyak baris per potong, kira-kira sama beratnya untuk tiap tahap.
  const chunk = { field: 3, columns: 24, rows: 24, color: 6 }

  const step = (): boolean => {
    if (phase === 'field') {
      const end = Math.min(gh, row + chunk.field)
      while (row < end) field(row++)
      if (row >= gh) [phase, row] = ['columns', 0]
    } else if (phase === 'columns') {
      const end = Math.min(gh, row + chunk.columns)
      while (row < end) columns(row++)
      if (row >= gh) [phase, row] = ['rows', 0]
    } else if (phase === 'rows') {
      const end = Math.min(h, row + chunk.rows)
      while (row < end) rows(row++)
      if (row >= h) {
        percentiles()
        ;[phase, row] = ['color', 0]
      }
    } else if (phase === 'color') {
      const end = Math.min(h, row + chunk.color)
      while (row < end) color(row++)
      if (row >= h) phase = 'done'
    }
    return phase === 'done'
  }

  return { width: w, height: h, pixels, step }
}

/**
 * Semai seni folder dari kuncinya (slug kotak, atau id folder di Kotak surat), supaya folder yang
 * sama selalu bercorak sama di setiap halaman, dan folder lain bercorak lain.
 */
export function folderSeed(key: string): number {
  return hashString(key) % 997
}

/** Posisi berkas di kipas: -1 sampai 1 dari kiri ke kanan, 0 kalau cuma satu. */
export function fanSlot(index: number, count: number): number {
  return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1
}

/** Ruang di atas folder kaca yang tertutup, dalam satuan folder (340 × 272). */
export const FOLDER_HEADROOM = 54

/**
 * Jarak antarlembar di kipas yang terbuka (`--gf-stack` di GlassFolder). Tiap lembar di belakang
 * menyembul setinggi ini di atas lembar di depannya, cukup untuk diketuk jari (44 px) dan untuk
 * label nama di ujung atasnya.
 */
export const FAN_STACK = 48

/** Lembar surat di folder kaca (`.gf-sheet`), berputar pada titik tengah bawahnya. */
export const SHEET_W = 272
export const SHEET_H = 184
/** Lembar di ujung kipas yang terbuka bergeser 40 satuan dan miring 5° (`--gf-spread`, `--gf-fan`). */
const FAN_SPREAD = 40
const FAN_TILT = 5

/** Letak lembar di kipas: `slot` dari fanSlot(), plus acakan geser (`jx`) dan miring (`jr`, derajat). */
export interface FanSheet {
  slot: number
  jx: number
  jr: number
}

/** Acakan geser dan miring tiap lembar, tetap per berkas, jadi kipasnya sama setiap dibuka. */
export function sheetJitter(id: string): Pick<FanSheet, 'jx' | 'jr'> {
  const jitter = rng(hashString(id))
  return { jx: (jitter() - 0.5) * 10, jr: (jitter() - 0.5) * 3.2 }
}

/** Tepi atas lembar di kipas yang terbuka, relatif ke titik putarnya: kedua ujung dan tingginya di x. */
function topEdge({ slot, jx, jr }: FanSheet) {
  const tilt = ((jr + slot * FAN_TILT) * Math.PI) / 180
  const x = jx + slot * FAN_SPREAD + SHEET_H * Math.sin(tilt)
  const y = -SHEET_H * Math.cos(tilt)
  const half = (SHEET_W / 2) * Math.cos(tilt)
  return { left: x - half, right: x + half, at: (px: number) => y + Math.tan(tilt) * (px - x) }
}

/**
 * Bagian jarak antarlapis yang tertutup lembar `front` di titik tersempit jalur lembar `back` di
 * belakangnya, dalam satuan folder. Keduanya miring ke arah berbeda, jadi tepi atas lembar depan
 * naik mendekati lembar belakang di salah satu ujungnya. Jalur yang bisa diketuk = jarak antarlapis
 * dikurangi nilai ini.
 */
export function fanOverlap(front: FanSheet, back: FanSheet): number {
  const f = topEdge(front)
  const b = topEdge(back)
  // Kedua tepi atas lurus, jadi titik tersempitnya di salah satu ujung bagian yang bertumpuk.
  const ends = [Math.max(f.left, b.left), Math.min(f.right, b.right)]
  return Math.max(...ends.map((x) => b.at(x) - f.at(x)))
}

/**
 * Ruang di atas folder kaca yang terbuka dengan `count` lembar di kipasnya, sesuai nilai
 * `.gf-root[data-open]` di GlassFolder: lembar paling belakang naik 96 + `stack` per lapis dari
 * posisinya (96 di bawah tepi atas), lalu 18 lagi saat disorot dan sampai 20 di sudutnya yang
 * miring. Dengan ruang ini kipasnya tidak menutupi isi halaman di atas folder.
 */
export function openRoom(count: number, stack = FAN_STACK): number {
  const layers = Math.max(1, count) - 1
  return Math.max(FOLDER_HEADROOM, 96 + stack * layers + 18 + 20 - 96)
}
