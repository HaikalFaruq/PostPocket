/**
 * Geometri kantong snack Pocket dan sobekannya, dalam satuan viewBox 200×290. Sobekan mengikuti
 * jari: setiap titik baru menambah panjang sobekan ke satu arah, dan tinggi sobekan mengikuti
 * tinggi jari di sekitar garis putus-putus di bawah segel atas.
 */

export const PACKET_W = 200
export const PACKET_H = 290
/** Tinggi segel bergerigi di atas dan di bawah. */
export const SEAL = 24
/** Garis putus-putus tempat sobekan dimulai, sedikit di bawah segel atas. */
export const TEAR_Y = 36
export const TEAR_MIN = 29
export const TEAR_MAX = 56
/** Sobekan dianggap tuntas kalau sudah sejauh ini dari tepi awalnya. */
export const TEAR_DONE = 0.92

export interface TearPoint {
  x: number
  y: number
}

/** Arah sobekan: 1 dari tepi kiri ke kanan, -1 dari tepi kanan ke kiri. */
export type TearDir = 1 | -1

export interface Tear {
  dir: TearDir
  /** Titik dari jari (atau animasi ketuk), urut dari tepi awal ke ujung sobekan. */
  points: TearPoint[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Angka acak yang tetap untuk posisi x yang sama, -1 sampai 1: gerigi sobekan tidak berubah-ubah. */
export function jag(x: number): number {
  const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

/** Tepi tempat sobekan dimulai untuk arah ini. */
export function startEdge(dir: TearDir): number {
  return dir === 1 ? 0 : PACKET_W
}

/** Sobekan baru yang dimulai dari tepi, setinggi `y`. */
export function beginTear(dir: TearDir, y = TEAR_Y): Tear {
  return { dir, points: [{ x: startEdge(dir), y: clamp(y, TEAR_MIN, TEAR_MAX) }] }
}

/** Ujung sobekan sekarang. */
export function tearTip(tear: Tear): TearPoint {
  return tear.points[tear.points.length - 1] ?? { x: startEdge(tear.dir), y: TEAR_Y }
}

/** Seberapa jauh sobekan dari tepi awalnya, 0 sampai 1. */
export function tearProgress(tear: Tear): number {
  const tip = tearTip(tear)
  return clamp(Math.abs(tip.x - startEdge(tear.dir)) / PACKET_W, 0, 1)
}

/**
 * Sobekan memanjang ke posisi jari kalau jari sudah melewati ujungnya. Sobekan tidak pernah mundur,
 * dan lompatan jauh diisi titik-titik di antaranya supaya garisnya tetap halus.
 */
export function extendTear(tear: Tear, x: number, y: number): Tear {
  const tip = tearTip(tear)
  const target = clamp(x, 0, PACKET_W)
  if ((target - tip.x) * tear.dir <= 0.5) return tear
  const ty = clamp(y, TEAR_MIN, TEAR_MAX)
  const steps = Math.max(1, Math.ceil(Math.abs(target - tip.x) / 6))
  const added: TearPoint[] = []
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    added.push({ x: tip.x + (target - tip.x) * t, y: tip.y + (ty - tip.y) * t })
  }
  return { dir: tear.dir, points: [...tear.points, ...added] }
}

/** Lintasan sobekan otomatis saat kantong diketuk: gelombang landai di sekitar garis putus-putus. */
export function autoTear(dir: TearDir, progress: number): Tear {
  let tear = beginTear(dir)
  const end = startEdge(dir) + dir * PACKET_W * clamp(progress, 0, 1)
  for (let x = 6; x <= PACKET_W; x += 6) {
    const px = startEdge(dir) + dir * x
    if ((px - end) * dir > 0) break
    tear = extendTear(tear, px, TEAR_Y + Math.sin(x / 31) * 3.2)
  }
  return extendTear(tear, end, TEAR_Y + Math.sin((PACKET_W * progress) / 31) * 3.2)
}

/** Garis sobek bergerigi: titik rapat tiap `step` dengan getaran kecil seperti foil yang robek. */
export function raggedLine(points: TearPoint[], step = 2.5, amp = 1.1): TearPoint[] {
  const out: TearPoint[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[i + 1]
    if (!b) {
      out.push({ x: a.x, y: a.y + jag(a.x) * amp })
      break
    }
    const n = Math.max(1, Math.round(Math.abs(b.x - a.x) / step))
    for (let k = 0; k < n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n
      const y = a.y + ((b.y - a.y) * k) / n
      out.push({ x, y: y + jag(x) * amp })
    }
  }
  return out
}

/**
 * Batas penuh selebar kantong, dari tepi ke tepi: bagian yang sudah sobek bergerigi, sisanya
 * lurus setinggi ujung sobekan (di sana kedua potongan masih menyatu).
 */
export function tearBoundary(tear: Tear): TearPoint[] {
  const line = raggedLine(tear.points)
  const tip = tearTip(tear)
  const far = tear.dir === 1 ? PACKET_W + 6 : -6
  const near = tear.dir === 1 ? -6 : PACKET_W + 6
  const first = line[0] ?? tip
  const ordered = [{ x: near, y: first.y }, ...line, { x: far, y: tip.y }]
  return tear.dir === 1 ? ordered : ordered.reverse()
}

const fmt = (n: number) => Number(n.toFixed(2))

/**
 * Path daerah di atas atau di bawah batas. `lift` mengangkat batas di bagian yang sudah sobek
 * (paling tinggi di tepi awal), supaya terlihat celah dari foil yang mulai terbuka.
 */
export function regionPath(
  boundary: TearPoint[],
  side: 'above' | 'below',
  lift: (x: number) => number = () => 0,
): string {
  const edge = side === 'above' ? -40 : PACKET_H + 40
  const pts = boundary.map((p) => `${fmt(p.x)} ${fmt(p.y - lift(p.x))}`)
  const first = boundary[0]!
  const last = boundary[boundary.length - 1]!
  return `M${fmt(first.x)} ${edge} L${pts.join(' L')} L${fmt(last.x)} ${edge} Z`
}

/** Path terbuka sepanjang bagian yang sudah sobek saja, untuk garis lapisan dalam foil. */
export function tornPath(tear: Tear, lift: (x: number) => number = () => 0, dy = 0): string {
  const line = raggedLine(tear.points)
  if (line.length < 2) return ''
  return `M${line.map((p) => `${fmt(p.x)} ${fmt(p.y - lift(p.x) + dy)}`).join(' L')}`
}

/** Celah sobekan: paling lebar di tepi awal dan menyempit ke ujung sobekan. */
export function liftAt(tear: Tear, max: number): (x: number) => number {
  const start = startEdge(tear.dir)
  const tip = tearTip(tear).x
  const span = Math.abs(tip - start)
  return (x: number) => {
    if (span < 1) return 0
    const t = (x - start) / (tip - start)
    if (t < 0 || t > 1) return 0
    return max * Math.pow(1 - t, 1.3)
  }
}
