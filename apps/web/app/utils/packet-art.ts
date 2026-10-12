import { PACKET_H, PACKET_W, SEAL, TEAR_Y } from './packet-tear'

/**
 * Bentuk kantong snack foil (viewBox 200×290): segel bergerigi di atas dan bawah, sisi badan yang
 * tertarik ke dalam dan bergelombang di titik-titik lipatan, dan lipatan foil yang menjalar dari
 * sudut dan sisi ke tengah. Semua digambar sendiri, tanpa aset dari web referensi.
 */

export type Pt = [number, number]

const fmt = (n: number) => Number(n.toFixed(2))

/** Kurva halus lewat titik-titik (Catmull-Rom jadi Bézier kubik), mulai dari titik pertama. */
export function smoothPath(points: Pt[]): string {
  const out: string[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[i + 2] ?? p2
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    out.push(`C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`)
  }
  return out.join(' ')
}

const mirrorX = ([x, y]: Pt): Pt => [PACKET_W - x, y]
const mirrorY = ([x, y]: Pt): Pt => [x, PACKET_H - y]

/** Gerigi segel: `count` gigi selebar kantong, setinggi `depth` dari garis `y`. */
function teeth(y: number, depth: number, count = 16): Pt[] {
  return Array.from({ length: count * 2 + 1 }, (_, i) => [
    (i / (count * 2)) * PACKET_W,
    i % 2 ? y + depth : y,
  ])
}

/** Sisi kiri badan dari segel bawah ke atas: menyempit di titik lipatan, sedikit menggembung di antaranya. */
const LEFT_SIDE: Pt[] = [
  [0, PACKET_H - SEAL],
  [8, 244],
  [6.5, 226],
  [10, 204],
  [8.5, 175],
  [11, 145],
  [8.5, 115],
  [10, 86],
  [6.5, 66],
  [8, 48],
]
/** Takik sobek di sisi kiri, setinggi garis putus-putus, lalu naik ke segel atas. */
const LEFT_NOTCH: Pt[] = [
  [4.5, TEAR_Y + 5],
  [10, TEAR_Y],
  [4, TEAR_Y - 4.5],
  [0, SEAL],
]

const line = (points: Pt[]) => points.map(([x, y]) => `L${fmt(x)} ${fmt(y)}`).join(' ')

/** Siluet lengkap kantong, searah jarum jam dari pojok kiri atas. */
export const PACKET_SHAPE = (() => {
  const top = teeth(4, -4)
  const bottom = teeth(PACKET_H - 4, 4).reverse()
  const rightNotch = [...LEFT_NOTCH].reverse().map(mirrorX)
  const rightSide = [...LEFT_SIDE].reverse().map(mirrorX)
  return [
    `M${fmt(top[0]![0])} ${fmt(top[0]![1])}`,
    line(top.slice(1)),
    line(rightNotch),
    line([rightSide[0]!]),
    smoothPath(rightSide),
    line([[PACKET_W, PACKET_H - 4], ...bottom]),
    line([LEFT_SIDE[0]!]),
    smoothPath(LEFT_SIDE),
    line(LEFT_NOTCH),
    'Z',
  ].join(' ')
})()

/** Satu lipatan foil: dari tepi (lebar `width`) meruncing ke ujungnya, sedikit melengkung. */
export interface Fold {
  from: Pt
  to: Pt
  width: number
  bend: number
}

const SIDE_FOLDS: Fold[] = [
  { from: [8, 48], to: [34, 62], width: 7, bend: 2 },
  { from: [10, 86], to: [38, 93], width: 6, bend: 1.5 },
  { from: [11, 145], to: [37, 147], width: 6, bend: 1 },
  { from: [10, 204], to: [38, 198], width: 6, bend: -1.5 },
  { from: [8, 244], to: [34, 231], width: 7, bend: -2 },
]
const CORNER_FOLDS: Fold[] = [
  { from: [1, 26], to: [42, 70], width: 10, bend: 3 },
  { from: [15, 25], to: [54, 45], width: 6, bend: 2 },
  { from: [33, 25], to: [60, 33], width: 4, bend: 1 },
]
const flipX = (f: Fold): Fold => ({ ...f, from: mirrorX(f.from), to: mirrorX(f.to), bend: -f.bend })
const flipY = (f: Fold): Fold => ({ ...f, from: mirrorY(f.from), to: mirrorY(f.to), bend: -f.bend })
const LEFT_FOLDS = [...SIDE_FOLDS, ...CORNER_FOLDS, ...CORNER_FOLDS.map(flipY)]

/** Semua lipatan kantong, kiri dan kanan. */
export const FOLDS: Fold[] = [...LEFT_FOLDS, ...LEFT_FOLDS.map(flipX)]

/** Path tertutup berbentuk baji untuk satu lipatan; `scale` mengecilkan lebar, `reach` panjangnya. */
export function wedge(fold: Fold, scale = 1, reach = 1): string {
  const [sx, sy] = fold.from
  const ex = sx + (fold.to[0] - sx) * reach
  const ey = sy + (fold.to[1] - sy) * reach
  const len = Math.hypot(ex - sx, ey - sy) || 1
  const nx = -(ey - sy) / len
  const ny = (ex - sx) / len
  const half = (fold.width * scale) / 2
  const cx = (sx + ex) / 2 + nx * fold.bend
  const cy = (sy + ey) / 2 + ny * fold.bend
  return [
    `M${fmt(sx + nx * half)} ${fmt(sy + ny * half)}`,
    `Q${fmt(cx + (nx * half) / 2)} ${fmt(cy + (ny * half) / 2)} ${fmt(ex)} ${fmt(ey)}`,
    `Q${fmt(cx - (nx * half) / 2)} ${fmt(cy - (ny * half) / 2)} ${fmt(sx - nx * half)} ${fmt(sy - ny * half)}`,
    'Z',
  ].join(' ')
}

/** Alur segel: garis gelap dan garis terang di bawahnya, di segel atas dan bawah. */
export const GROOVES = [7, 11, 15, 19]
