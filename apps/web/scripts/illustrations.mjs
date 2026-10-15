// Ilustrasi depan kartu Letter: tiap ilustrasi punya lapisan cetak (art) dan lapisan foil
// (dipakai sebagai mask). Semuanya dibentuk prosedural dengan angka acak ber-seed, jadi hasilnya
// selalu sama dan asetnya milik sendiri.
//
// Setiap desain digambar ulang untuk setiap bentuk kartu (packages/presets/letter.json): tingginya
// selalu 1000, lebarnya mengikuti rasio bentuk, dan letak bendanya dihitung dari lebar itu. Jadi
// kartu Mendatar mendapat komposisi mendatar, bukan potongan tengah dari desain tegak.
//
//   node scripts/illustrations.mjs

import { mkdirSync, writeFileSync } from 'node:fs'

const H = 1000
/** Akhiran nama berkas per bentuk kartu, dengan lebar kanvasnya. Akhiran kosong untuk bentuk Asli. */
const SHAPES = [
  ['', 720],
  ['-portrait', 750],
  ['-square', 1000],
  ['-landscape', 1333],
]
const outDir = new URL('../public/illustrations/', import.meta.url)

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const r1 = (n) => Math.round(n * 10) / 10
const rad = (deg) => (deg * Math.PI) / 180

function svg(body, defs, width) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H}" width="${width}" height="${H}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`
}

/** Titik-titik acak yang saling berjauhan minimal `gap`, di dalam kotak, di luar area `blocked`. */
function scatter(random, { count, x0, x1, y0, y1, gap, blocked = () => false, tries = 40 }) {
  const points = []
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < tries; attempt++) {
      const x = x0 + random() * (x1 - x0)
      const y = y0 + random() * (y1 - y0)
      if (blocked(x, y)) continue
      if (points.some((p) => Math.hypot(p.x - x, p.y - y) < gap)) continue
      points.push({ x, y })
      break
    }
  }
  return points
}

// ---------------------------------------------------------------------------------------------
// Bentuk dasar

/** Daun almond sepanjang `len`, lebar `wid`, berpangkal di (x, y) dan mengarah ke `angle` derajat. */
function leaf(x, y, len, wid, angle, fill, extra = '') {
  return `<path d="M0 0Q${r1(len * 0.45)} ${r1(-wid)} ${r1(len)} 0Q${r1(len * 0.55)} ${r1(wid)} 0 0Z" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(angle)})" fill="${fill}"${extra}/>`
}

/**
 * Daun bulat eukaliptus dengan tangkai pendek dan tulang daun yang lebih terang. Tanpa `vein`,
 * daunnya digambar sebagai garis tepi dan tulang daun saja, untuk daun foil yang halus.
 */
function roundLeaf(x, y, len, angle, fill, vein) {
  const w = len * 0.5
  const stalk = len * 0.16
  const body = `M0 0L${r1(stalk)} 0C${r1(stalk + len * 0.02)} ${r1(-w * 0.9)} ${r1(len * 0.86)} ${r1(-w * 1.02)} ${r1(len)} 0C${r1(len * 0.86)} ${r1(w * 1.02)} ${r1(stalk + len * 0.02)} ${r1(w * 0.9)} ${r1(stalk)} 0Z`
  const rib = `M${r1(stalk)} 0Q${r1(len * 0.55)} ${r1(-w * 0.08)} ${r1(len * 0.9)} 0`
  const g = (inner) =>
    `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(angle)})">${inner}</g>`
  if (!vein) {
    const line = r1(Math.max(1.8, len * 0.04))
    return g(
      `<path d="${body}" fill="none" stroke="${fill}" stroke-width="${line}" stroke-linejoin="round"/><path d="${rib}" fill="none" stroke="${fill}" stroke-width="${r1(line * 0.7)}" stroke-linecap="round"/>`,
    )
  }
  const midrib = `<path d="${rib}" fill="none" stroke="${vein}" stroke-width="${r1(Math.max(1.2, len * 0.035))}" stroke-linecap="round"/>`
  return g(`<path d="${body}" fill="${fill}"/>${midrib}`)
}

function sparkle(x, y, s, fill) {
  const k = s * 0.18
  return `<path d="M${r1(x)} ${r1(y - s)}Q${r1(x + k)} ${r1(y - k)} ${r1(x + s)} ${r1(y)}Q${r1(x + k)} ${r1(y + k)} ${r1(x)} ${r1(y + s)}Q${r1(x - k)} ${r1(y + k)} ${r1(x - s)} ${r1(y)}Q${r1(x - k)} ${r1(y - k)} ${r1(x)} ${r1(y - s)}Z" fill="${fill}"/>`
}

function star(x, y, outer, inner, rotate, fill) {
  const points = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const a = rad(rotate + i * 36 - 90)
    points.push(`${r1(x + radius * Math.cos(a))},${r1(y + radius * Math.sin(a))}`)
  }
  return `<polygon points="${points.join(' ')}" fill="${fill}"/>`
}

/** Bintang segi delapan (dua persegi bertumpuk), ornamen khas kartu Lebaran. */
function octagram(x, y, r, fill, inner = 0.76) {
  const points = []
  for (let i = 0; i < 16; i++) {
    const radius = i % 2 === 0 ? r : r * inner
    const a = rad(i * 22.5 - 90)
    points.push(`${r1(x + radius * Math.cos(a))},${r1(y + radius * Math.sin(a))}`)
  }
  return `<polygon points="${points.join(' ')}" fill="${fill}"/>`
}

/**
 * Bulan sabit: lingkaran (cx, cy, R) dikurangi lingkaran (cx + dx, cy + dy, r), sebagai satu path
 * tanpa mask, jadi aman dipakai sebagai gambar mask CSS.
 */
function crescent(cx, cy, R, dx, dy, r, fill) {
  const d = Math.hypot(dx, dy)
  const along = (d * d + R * R - r * r) / (2 * d)
  const half = Math.sqrt(Math.max(0, R * R - along * along))
  const ux = dx / d
  const uy = dy / d
  const mx = cx + ux * along
  const my = cy + uy * along
  const p1 = [mx - uy * half, my + ux * half]
  const p2 = [mx + uy * half, my - ux * half]
  return `<path d="M${r1(p1[0])} ${r1(p1[1])}A${R} ${R} 0 1 1 ${r1(p2[0])} ${r1(p2[1])}A${r} ${r} 0 0 0 ${r1(p1[0])} ${r1(p1[1])}Z" fill="${fill}"/>`
}

/**
 * Batang lengkung dari (x0, y0) sepanjang `len` ke arah `angle` (derajat, 0 = ke atas).
 * Mengembalikan path batang, titik ujung, dan fungsi titik serta arah di sepanjang batang.
 */
function curve({ x0, y0, len, angle, bend }) {
  const a = rad(angle)
  const x1 = x0 + Math.sin(a) * len
  const y1 = y0 - Math.cos(a) * len
  const cx = (x0 + x1) / 2 + Math.cos(a) * bend
  const cy = (y0 + y1) / 2 + Math.sin(a) * bend
  const point = (t) => ({
    x: (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1,
    y: (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1,
  })
  const tangent = (t) => {
    const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx)
    const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy)
    return (Math.atan2(dy, dx) * 180) / Math.PI
  }
  const d = `M${r1(x0)} ${r1(y0)}Q${r1(cx)} ${r1(cy)} ${r1(x1)} ${r1(y1)}`
  return { d, tip: { x: x1, y: y1 }, point, tangent }
}

/** Batang dengan daun berselang-seling. */
function stem(
  random,
  { x0, y0, len, angle, bend, leaves, leafLen, leafWid, color, leafColor, width },
) {
  const c = curve({ x0, y0, len, angle, bend })
  let out = `<path d="${c.d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`
  for (let i = 0; i < leaves; i++) {
    const t = 0.18 + (i / Math.max(1, leaves)) * 0.74
    const p = c.point(t)
    const side = i % 2 === 0 ? 1 : -1
    const dir = c.tangent(t) + side * (38 + random() * 18)
    const scale = 0.75 + (1 - t) * 0.45
    out += leaf(p.x, p.y, leafLen * scale, leafWid * scale, dir, leafColor)
  }
  return { svg: out, ...c }
}

/** Helai rumput: segitiga lengkung dari pangkal (x, y) setinggi `h`. */
function blade(x, y, h, lean, w, fill, opacity = 1) {
  return `<path d="M${r1(x - w / 2)} ${r1(y)}Q${r1(x + lean * 0.35)} ${r1(y - h * 0.55)} ${r1(x + lean)} ${r1(y - h)}Q${r1(x + lean * 0.4 + w * 0.25)} ${r1(y - h * 0.5)} ${r1(x + w / 2)} ${r1(y)}Z" fill="${fill}"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`
}

function tulip(x, y, s, fill, shade) {
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${r1(s)})"><path d="M-10 0C-15-17-8-30-2-23C0-31 5-31 6-23C12-30 16-17 10 0Q0 7-10 0Z" fill="${fill}"/><path d="M-2-23C-6-12-5-4 0 3C5-4 6-12 6-23C3-16 1-16-2-23Z" fill="${shade}" opacity=".55"/></g>`
}

function daisy(x, y, s, petal, center, random) {
  let petals = ''
  const n = 11
  for (let i = 0; i < n; i++) {
    petals += `<ellipse cx="0" cy="-9" rx="3.4" ry="8.5" fill="${petal}" transform="rotate(${r1((360 / n) * i + random() * 8)})"/>`
  }
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${r1(s)})">${petals}<circle r="5" fill="${center}"/></g>`
}

function iris(x, y, s, fill, accent) {
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${r1(s)})"><path d="M0-4C-8-26 2-34 0-34C-2-34 8-26 0-4Z" fill="${fill}"/><path d="M0-4C-10-8-24-2-20 10C-14 6-6 2 0-4Z" fill="${fill}"/><path d="M0-4C10-8 24-2 20 10C14 6 6 2 0-4Z" fill="${fill}"/><path d="M0-4C-4 2-9 4-12 3C-8 0-4-2 0-4Z" fill="${accent}"/></g>`
}

function lavender(x, y, s, fill, random) {
  let buds = ''
  for (let i = 0; i < 9; i++) {
    const dy = -i * 6
    buds += `<ellipse cx="${r1((i % 2 ? 2.4 : -2.4) + (random() - 0.5))}" cy="${dy}" rx="2.6" ry="3.6" fill="${fill}"/>`
  }
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${r1(s)})">${buds}</g>`
}

function forgetMeNots(x, y, s, fill, center, random) {
  let out = ''
  for (let i = 0; i < 5; i++) {
    const fx = x + (random() - 0.5) * 34 * s
    const fy = y + (random() - 0.5) * 22 * s
    let petals = ''
    for (let p = 0; p < 5; p++)
      petals += `<circle cx="0" cy="-3.6" r="3" fill="${fill}" transform="rotate(${p * 72})"/>`
    out += `<g transform="translate(${r1(fx)} ${r1(fy)}) scale(${r1(s)})">${petals}<circle r="1.6" fill="${center}"/></g>`
  }
  return out
}

/** Ranting pakis untuk lapisan foil. */
function frond(random, x0, y0, len, angle, fill) {
  const s = stem(random, {
    x0,
    y0,
    len,
    angle,
    bend: (random() - 0.5) * 40,
    leaves: 9,
    leafLen: 26,
    leafWid: 7,
    color: fill,
    leafColor: fill,
    width: 2.6,
  })
  return s.svg + leaf(s.tip.x, s.tip.y, 22, 6, s.tangent(1), fill)
}

/** Kupu-kupu kecil menghadap `angle`, untuk lapisan foil. */
function butterfly(x, y, s, angle, fill) {
  const wings = [1, -1]
    .map(
      (k) =>
        `<path d="M0 -3C${18 * k} -30 ${44 * k} -24 ${34 * k} 0C${28 * k} 10 ${10 * k} 8 0 2Z" fill="${fill}"/>` +
        `<path d="M0 3C${22 * k} 6 ${28 * k} 26 ${13 * k} 30C${4 * k} 32 ${1 * k} 18 0 5Z" fill="${fill}"/>`,
    )
    .join('')
  const body = `<path d="M0 -12L0 20" stroke="${fill}" stroke-width="4" stroke-linecap="round"/><path d="M0 -11Q-5 -24 -13 -29M0 -11Q5 -24 13 -29" fill="none" stroke="${fill}" stroke-width="1.8" stroke-linecap="round"/>`
  return `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(angle)}) scale(${r1(s)})">${wings}${body}</g>`
}

/** Kurva halus y(x) dari jumlah gelombang sinus ber-seed, untuk punggung bukit. */
function ridge(random, { base, amp, waves = 3 }) {
  const parts = Array.from({ length: waves }, (_, i) => ({
    freq: (0.6 + random() * 0.8) * (i + 1),
    phase: random() * Math.PI * 2,
    weight: 1 / (i + 1),
  }))
  const total = parts.reduce((sum, p) => sum + p.weight, 0)
  return (x) =>
    base -
    amp *
      (0.5 +
        (0.5 / total) *
          parts.reduce(
            (sum, p) => sum + p.weight * Math.sin((x / 700) * p.freq * 6.28 + p.phase),
            0,
          ))
}

function ridgePath(y, width, step = 12) {
  let d = `M-10 ${H + 10}L-10 ${r1(y(-10))}`
  for (let x = 0; x <= width + 10; x += step) d += `L${x} ${r1(y(x))}`
  return `${d}L${width + 10} ${H + 10}Z`
}

// ---------------------------------------------------------------------------------------------
// Padang bunga: ladang bunga di bawah, karangan daun foil di atasnya, dan dua kupu-kupu foil.

function meadow(W) {
  const random = seeded(2026)
  const greens = ['#5e8f58', '#6f9f62', '#4f7d4b', '#86ad6f']
  const density = W / 720
  let art = ''
  let foil = ''

  // Rumput belakang yang pucat memberi kedalaman di balik bunga.
  for (let i = 0; i < Math.round(70 * density); i++) {
    const x = random() * W
    art += blade(
      x,
      H + 6,
      150 + random() * 170,
      (random() - 0.5) * 70,
      7 + random() * 5,
      '#b4cfa2',
      0.7,
    )
  }

  // Batang dan bunga cetak.
  for (let i = 0; i < Math.round(64 * density); i++) {
    const x0 = 10 + random() * (W - 20)
    const len = 170 + random() * 220
    const green = greens[i % greens.length]
    const s = stem(random, {
      x0,
      y0: H + 10,
      len,
      angle: (random() - 0.5) * 22,
      bend: (random() - 0.5) * 50,
      leaves: 2 + Math.floor(random() * 4),
      leafLen: 30 + random() * 16,
      leafWid: 7 + random() * 4,
      color: green,
      leafColor: green,
      width: 2.6 + random() * 1.4,
    })
    art += s.svg
    const kind = i % 6
    const { x, y } = s.tip
    if (kind === 0) art += tulip(x, y, 2.3 + random() * 0.6, '#ef9bb1', '#d96f8c')
    else if (kind === 1) art += daisy(x, y, 1.8 + random() * 0.5, '#fbf3d0', '#f2b631', random)
    else if (kind === 2) art += iris(x, y, 1.9 + random() * 0.4, '#9585d4', '#f2c94c')
    else if (kind === 3) art += lavender(x, y, 1.7 + random() * 0.3, '#a58ad8', random)
    else if (kind === 4) art += forgetMeNots(x, y, 1.7, '#86a9e6', '#f6d36b', random)
    else art += daisy(x, y, 1.6 + random() * 0.5, '#f6d36b', '#e89a2a', random)
  }

  // Rumput depan yang pendek menutup pangkal batang.
  for (let i = 0; i < Math.round(80 * density); i++) {
    const x = random() * W
    art += blade(
      x,
      H + 6,
      40 + random() * 70,
      (random() - 0.5) * 40,
      6 + random() * 4,
      greens[i % 4],
    )
  }

  // Foil: ranting di sela bunga.
  const fronds = Math.round(12 * density)
  for (let i = 0; i < fronds; i++) {
    foil += frond(
      random,
      20 + ((i + 0.5) * (W - 40)) / fronds + (random() - 0.5) * 30,
      H + 10,
      210 + random() * 170,
      (random() - 0.5) * 28,
      '#000',
    )
  }

  // Karangan daun di tengah atas, dengan buah kecil di sela daunnya.
  const cx = W / 2
  const cy = 330
  const radius = 150
  for (const side of [-1, 1]) {
    let d = ''
    for (let i = 0; i <= 15; i++) {
      const t = i / 15
      const angle = Math.PI / 2 + side * t * Math.PI * 0.82
      const x = cx + Math.cos(angle) * radius
      const y = cy + Math.sin(angle) * radius
      d += `${i === 0 ? 'M' : 'L'}${r1(x)} ${r1(y)}`
      if (i > 0 && i < 15) {
        const dir = (angle * 180) / Math.PI + side * 90
        foil += leaf(x, y, 30 - t * 10, 8 - t * 2, dir - side * 42, '#000')
        foil += leaf(x, y, 26 - t * 9, 7 - t * 2, dir + side * 30, '#000')
        if (i % 4 === 2) {
          const out = radius + 16
          foil += `<circle cx="${r1(cx + Math.cos(angle) * out)}" cy="${r1(cy + Math.sin(angle) * out)}" r="4.2" fill="#000"/>`
        }
      }
    }
    foil += `<path d="${d}" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>`
  }
  foil += sparkle(cx, cy, 26, '#000')

  // Dua kupu-kupu di kiri dan kanan karangan daun.
  const wing = Math.min(W * 0.36, 300)
  foil += butterfly(cx - wing, cy + 140, 0.95, -14, '#000')
  foil += butterfly(cx + wing * 0.92, cy - 70, 0.72, 18, '#000')

  // Kilau kecil di langit, menjauhi karangan daun dan kupu-kupu.
  const sky = scatter(random, {
    count: Math.round(16 * density),
    x0: 40,
    x1: W - 40,
    y0: 70,
    y1: 520,
    gap: 70,
    blocked: (x, y) =>
      Math.hypot(x - cx, y - cy) < radius + 40 ||
      Math.hypot(x - (cx - wing), y - (cy + 140)) < 60 ||
      Math.hypot(x - (cx + wing * 0.92), y - (cy - 70)) < 50,
  })
  for (const p of sky) foil += sparkle(p.x, p.y, 6 + random() * 9, '#000')

  return { art: svg(art, '', W), foil: svg(foil, '', W) }
}

// ---------------------------------------------------------------------------------------------
// Ranting: buket eukaliptus, zaitun, dan beri yang diikat pita foil, di depan cincin foil ganda.

function sprig(W) {
  const random = seeded(77)
  let art = ''
  let foil = ''
  const wide = W / H
  const cx = W / 2
  const R = Math.min(W, H) * 0.31
  // Ekor pita (sampai 124 di bawah ikatan) berhenti di atas bingkai foil kartu.
  const cy = Math.min(H / 2 - R * 0.08, H - 90 - 124 - R * 1.12)
  const gather = { x: cx, y: cy + R * 1.12 }

  // Cincin foil ganda di belakang buket.
  foil += `<circle cx="${r1(cx)}" cy="${cy}" r="${r1(R)}" fill="none" stroke="#000" stroke-width="4.5"/>`
  foil += `<circle cx="${r1(cx)}" cy="${cy}" r="${r1(R - 12)}" fill="none" stroke="#000" stroke-width="1.6"/>`

  const sage = ['#9fb8a3', '#86a38d', '#b8cab6', '#738f7a']
  const olive = ['#8f9d5e', '#728246', '#a8b479']
  const stemColor = '#6d8872'

  /** Ranting eukaliptus: daun bulat berpasangan yang mengecil ke ujung; sebagian jadi foil. */
  function eucalyptus(angle, len, bend, size, foilEvery = 3) {
    const c = curve({ x0: gather.x, y0: gather.y, len, angle, bend })
    art += `<path d="${c.d}" fill="none" stroke="${stemColor}" stroke-width="3.6" stroke-linecap="round"/>`
    const pairs = Math.max(3, Math.round(len / (size * 0.95)))
    for (let i = 0; i < pairs; i++) {
      const t = 0.3 + (i / pairs) * 0.66
      const p = c.point(t)
      const dir = c.tangent(t)
      const leafLen = size * (1.1 - t * 0.5)
      for (const side of [1, -1]) {
        const spread = dir + side * (48 + random() * 16)
        const color = sage[(i * 2 + (side > 0 ? 0 : 1)) % sage.length]
        art += roundLeaf(p.x, p.y, leafLen, spread, color, '#d5e1d3')
        // Sebagian daun bertepi foil, tepat di garis tepi daunnya sendiri.
        if (i % foilEvery === 1 && side === (i % 2 ? 1 : -1)) {
          foil += roundLeaf(p.x, p.y, leafLen, spread, '#000')
        }
      }
    }
    art += roundLeaf(c.tip.x, c.tip.y, size * 0.52, c.tangent(1) - 8, sage[2], '#dfe8dd')
  }

  /** Ranting zaitun: daun ramping berselang-seling dengan buah kecil; batangnya foil. */
  function oliveBranch(angle, len, bend) {
    const c = curve({ x0: gather.x, y0: gather.y, len, angle, bend })
    foil += `<path d="${c.d}" fill="none" stroke="#000" stroke-width="2.8" stroke-linecap="round"/>`
    const leaves = Math.round(len / 28)
    for (let i = 0; i < leaves; i++) {
      const t = 0.24 + (i / leaves) * 0.74
      const p = c.point(t)
      const side = i % 2 === 0 ? 1 : -1
      const dir = c.tangent(t) + side * (28 + random() * 12)
      const leafLen = 66 - t * 22
      if (i % 4 === 3) foil += leaf(p.x, p.y, leafLen, 9, dir, '#000')
      else art += leaf(p.x, p.y, leafLen, 9.5, dir, olive[i % olive.length])
      if (i % 3 === 1) {
        const a = rad(dir - side * 50)
        const ox = p.x + Math.cos(a) * 15
        const oy = p.y + Math.sin(a) * 15
        art += `<ellipse cx="${r1(ox)}" cy="${r1(oy)}" rx="7.5" ry="10" fill="#5f4b66" transform="rotate(${r1(dir)} ${r1(ox)} ${r1(oy)})"/>`
      }
    }
    foil += leaf(c.tip.x, c.tip.y, 40, 7.5, c.tangent(1), '#000')
  }

  /** Tangkai beri: cabang tipis dengan buah bulat di sepanjang ujungnya. */
  function berries(angle, len, bend) {
    const c = curve({ x0: gather.x, y0: gather.y, len, angle, bend })
    art += `<path d="${c.d}" fill="none" stroke="#8c6f78" stroke-width="2.2" stroke-linecap="round"/>`
    for (let i = 0; i < 7; i++) {
      const t = 0.5 + i * 0.075
      const p = c.point(Math.min(t, 1))
      const side = i % 2 === 0 ? 1 : -1
      const a = rad(c.tangent(t) + side * 64)
      const bx = p.x + Math.cos(a) * 15
      const by = p.y + Math.sin(a) * 15
      art += `<path d="M${r1(p.x)} ${r1(p.y)}L${r1(bx)} ${r1(by)}" stroke="#8c6f78" stroke-width="1.6"/>`
      art += `<circle cx="${r1(bx)}" cy="${r1(by)}" r="${r1(7 + random() * 2.5)}" fill="${i % 2 ? '#cf93a3' : '#b06f83'}"/>`
    }
    foil += `<circle cx="${r1(c.tip.x)}" cy="${r1(c.tip.y)}" r="6.5" fill="#000"/>`
  }

  // Sudut dihitung dari tegak. Yang paling tinggi di tengah, yang pendek di pinggir.
  oliveBranch(-64, R * 1.3, -36)
  eucalyptus(-36, R * 1.6, -46, 66)
  berries(-14, R * 1.38, 26)
  eucalyptus(6, R * 1.92, 34, 72)
  berries(24, R * 1.22, -24)
  eucalyptus(42, R * 1.5, 44, 62)
  oliveBranch(66, R * 1.24, 30)
  // Kartu mendatar: sulur rendah ke kiri dan kanan, melingkari bagian bawah cincin.
  if (wide > 1.1) {
    oliveBranch(-100, R * 1.3, 70)
    eucalyptus(100, R * 1.22, -70, 50)
  }

  // Pita foil yang mengikat batang: dua simpul, dua ekor, dan simpul tengah.
  const { x, y } = gather
  for (const dx of [-9, -4, 1, 6, 10]) {
    art += `<path d="M${r1(x + dx * 0.3)} ${y}L${r1(x + dx)} ${y + 70}" stroke="${stemColor}" stroke-width="3.2" stroke-linecap="round"/>`
  }
  foil += `<path d="M${x} ${y}C${x - 36} ${y - 44} ${x - 88} ${y - 26} ${x - 78} ${y + 4}C${x - 70} ${y + 24} ${x - 28} ${y + 12} ${x} ${y}Z" fill="#000"/>`
  foil += `<path d="M${x} ${y}C${x + 36} ${y - 44} ${x + 88} ${y - 26} ${x + 78} ${y + 4}C${x + 70} ${y + 24} ${x + 28} ${y + 12} ${x} ${y}Z" fill="#000"/>`
  foil += `<path d="M${x - 4} ${y + 2}C${x - 18} ${y + 42} ${x - 32} ${y + 78} ${x - 54} ${y + 110}L${x - 36} ${y + 106}L${x - 30} ${y + 124}C${x - 15} ${y + 88} ${x - 4} ${y + 46} ${x + 4} ${y + 6}Z" fill="#000"/>`
  foil += `<path d="M${x + 4} ${y + 2}C${x + 15} ${y + 38} ${x + 32} ${y + 70} ${x + 60} ${y + 98}L${x + 42} ${y + 98}L${x + 40} ${y + 116}C${x + 19} ${y + 86} ${x + 4} ${y + 46} ${x - 4} ${y + 6}Z" fill="#000"/>`
  foil += `<ellipse cx="${x}" cy="${y + 2}" rx="12" ry="10" fill="#000"/>`

  // Kartu mendatar: daun yang berguguran mengisi kiri dan kanan buket.
  const drifting = []
  if (wide > 1.1) {
    for (const side of [-1, 1]) {
      const edge = side < 0 ? 0 : W
      for (const [dx, py, len, turn, gilded] of [
        [0.1, 0.3, 54, 30, false],
        [0.18, 0.5, 48, -40, true],
        [0.11, 0.69, 58, 15, false],
      ]) {
        const px = edge - side * W * dx
        drifting.push({ x: px, y: H * py })
        const angle = side < 0 ? turn : 180 - turn
        art += roundLeaf(
          px,
          H * py,
          len,
          angle,
          sage[(drifting.length + 1) % sage.length],
          '#d5e1d3',
        )
        if (gilded) foil += roundLeaf(px, H * py, len, angle, '#000')
      }
    }
  }

  // Titik foil kecil di sekitar buket, di luar cincin.
  const dots = scatter(random, {
    count: Math.round(12 * Math.max(1, wide)),
    x0: 50,
    x1: W - 50,
    y0: 70,
    y1: H - 80,
    gap: 90,
    blocked: (px, py) =>
      Math.hypot(px - cx, py - cy) < R + 50 ||
      Math.hypot(px - x, py - y) < 170 ||
      drifting.some((leafAt) => Math.hypot(px - leafAt.x, py - leafAt.y) < 70),
  })
  for (const p of dots) {
    foil += `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="${r1(2.5 + random() * 3)}" fill="#000"/>`
  }

  return { art: svg(art, '', W), foil: svg(foil, '', W) }
}

// ---------------------------------------------------------------------------------------------
// Malam berbintang: bukit berlapis, pohon cemara, dan pondok kecil; bulan, bintang, rasi, dan
// bintang jatuh jadi foil.

function night(W) {
  const random = seeded(9)
  let art = ''
  let foil = ''
  const density = W / 720

  const far = ridge(random, { base: 770, amp: 90 })
  const mid = ridge(random, { base: 850, amp: 70 })
  const near = ridge(random, { base: 925, amp: 50 })

  // Awan tipis memanjang di belakang bukit.
  const cloud = (x, y, w) => {
    const h = w * 0.16
    return `<path d="M${r1(x - w / 2)} ${r1(y)}C${r1(x - w * 0.42)} ${r1(y - h * 1.1)} ${r1(x - w * 0.2)} ${r1(y - h * 1.25)} ${r1(x - w * 0.1)} ${r1(y - h * 0.8)}C${r1(x - w * 0.02)} ${r1(y - h * 2.1)} ${r1(x + w * 0.26)} ${r1(y - h * 2)} ${r1(x + w * 0.24)} ${r1(y - h * 0.9)}C${r1(x + w * 0.36)} ${r1(y - h * 1.3)} ${r1(x + w * 0.5)} ${r1(y - h * 0.7)} ${r1(x + w / 2)} ${r1(y)}Z" fill="#e3ebf5"/>`
  }
  art += cloud(W * 0.24, 560, 230)
  art += cloud(W * 0.74, 470, 170)
  if (density > 1.3) art += cloud(W * 0.52, 640, 200)

  art += `<path d="${ridgePath(far, W)}" fill="#bccce0"/>`
  // Cemara di punggung bukit tengah.
  for (let x = 30; x < W; x += 34 + random() * 70) {
    if (random() < 0.35) continue
    const base = mid(x) + 6
    const h = 46 + random() * 40
    const w = h * 0.42
    art += `<path d="M${r1(x)} ${r1(base - h)}L${r1(x + w / 2)} ${r1(base)}L${r1(x - w / 2)} ${r1(base)}Z" fill="#6f8bb6"/>`
  }
  art += `<path d="${ridgePath(mid, W)}" fill="#91a9cb"/>`

  // Pondok kecil di bukit tengah, jendelanya menyala foil.
  const hx = W * 0.7
  const hy = mid(hx) + 4
  art += `<path d="M${r1(hx - 30)} ${r1(hy)}L${r1(hx - 30)} ${r1(hy - 34)}L${r1(hx)} ${r1(hy - 58)}L${r1(hx + 30)} ${r1(hy - 34)}L${r1(hx + 30)} ${r1(hy)}Z" fill="#4f6b98"/>`
  art += `<path d="M${r1(hx - 38)} ${r1(hy - 30)}L${r1(hx)} ${r1(hy - 64)}L${r1(hx + 38)} ${r1(hy - 30)}" fill="none" stroke="#3d5683" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>`
  foil += `<rect x="${r1(hx - 9)}" y="${r1(hy - 30)}" width="18" height="16" rx="2" fill="#000"/>`

  art += `<path d="${ridgePath(near, W)}" fill="#6584b3"/>`

  // Bulan sabit di kanan atas.
  const moon = { x: W - 190, y: 200 }
  foil += crescent(moon.x, moon.y, 80, 34, -28, 70, '#000')

  // Rasi bintang di kiri atas, garisnya putus-putus.
  const constellation = [
    [110, 250],
    [180, 205],
    [252, 236],
    [292, 318],
    [232, 380],
    [158, 352],
  ]
  foil += `<polyline points="${constellation.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round"/>`
  for (const [x, y] of constellation) foil += star(x, y, 10, 4, 0, '#000')

  // Bintang jatuh di tengah langit.
  const sx = W * 0.56
  const sy = 330
  foil += `<path d="M${r1(sx)} ${r1(sy - 3)}L${r1(sx - 150)} ${r1(sy + 70)}L${r1(sx + 1)} ${r1(sy + 3)}Z" fill="#000" opacity=".9"/>`
  foil += star(sx + 4, sy - 2, 13, 5.5, 18, '#000')

  // Bintang dan kilau tersebar di langit, menjauhi bulan, rasi, dan bintang jatuh.
  const stars = scatter(random, {
    count: Math.round(42 * density),
    x0: 30,
    x1: W - 30,
    y0: 50,
    y1: 640,
    gap: 44,
    blocked: (x, y) =>
      Math.hypot(x - moon.x, y - moon.y) < 120 ||
      (x < 330 && y > 170 && y < 420) ||
      (x > sx - 170 && x < sx + 30 && y > sy - 30 && y < sy + 90) ||
      y > far(x) - 40,
  })
  for (const p of stars) {
    foil +=
      random() < 0.55
        ? sparkle(p.x, p.y, 4 + random() * 9, '#000')
        : star(p.x, p.y, 4 + random() * 6, 2 + random() * 1.6, random() * 72, '#000')
  }
  return { art: svg(art, '', W), foil: svg(foil, '', W) }
}

// ---------------------------------------------------------------------------------------------
// Ulang tahun: bendera segitiga di atas, balon, dan kue bertingkat; tali bendera, nyala lilin,
// tali balon, dan konfeti jadi foil.

function birthday(W) {
  const random = seeded(31)
  let art = ''
  let foil = ''
  const palette = ['#f3a59c', '#f6d58a', '#a3d6c4', '#bba8e2', '#a5c8ec']
  const density = W / 720

  // Bendera segitiga: satu untaian melengkung, atau dua di kartu mendatar.
  const swags = W > 1100 ? 2 : 1
  for (let s = 0; s < swags; s++) {
    // Dua untaian bertemu di satu titik di tengah, ujung luarnya lewat sedikit dari tepi kartu.
    const x0 = s === 0 ? -30 : (s * W) / swags
    const x1 = s === swags - 1 ? W + 30 : ((s + 1) * W) / swags
    const y0 = 58
    const sag = 104
    const at = (t) => ({
      x: x0 + (x1 - x0) * t,
      y: y0 + sag * 4 * t * (1 - t),
    })
    let d = ''
    for (let i = 0; i <= 40; i++) {
      const p = at(i / 40)
      d += `${i ? 'L' : 'M'}${r1(p.x)} ${r1(p.y)}`
    }
    foil += `<path d="${d}" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round"/>`
    if (s > 0) foil += `<circle cx="${r1(x0)}" cy="${y0}" r="7" fill="#000"/>`
    const flags = Math.round((x1 - x0) / 66)
    for (let i = 1; i < flags; i++) {
      const t = i / flags
      const p = at(t)
      const slope = (Math.atan2(sag * 4 * (1 - 2 * t), x1 - x0) * 180) / Math.PI
      const color = palette[(i + s * 2) % palette.length]
      const pattern =
        i % 3 === 0
          ? `<circle cx="-7" cy="16" r="3.2" fill="#fff" opacity=".7"/><circle cx="7" cy="16" r="3.2" fill="#fff" opacity=".7"/><circle cx="0" cy="32" r="3.2" fill="#fff" opacity=".7"/>`
          : i % 3 === 1
            ? `<path d="M-19 14L19 14M-13 28L13 28M-7 42L7 42" stroke="#fff" stroke-width="3.4" opacity=".55"/>`
            : ''
      art += `<g transform="translate(${r1(p.x)} ${r1(p.y)}) rotate(${r1(slope)})"><path d="M-25 1L25 1L0 62Z" fill="${color}"/>${pattern}</g>`
    }
  }

  // Kue bertingkat di tengah bawah.
  const cw = Math.min(W * 0.5, 400)
  const cx = W / 2
  const plate = 926
  const lowH = 150
  const topW = cw * 0.66
  const topH = 108
  const tier = (x, y, w, h, body, frost) => {
    let out = `<rect x="${r1(x - w / 2)}" y="${r1(y - h)}" width="${r1(w)}" height="${r1(h)}" rx="10" fill="${body}"/>`
    // Lapisan krim yang meleleh di bagian atas tingkat.
    let d = `M${r1(x - w / 2)} ${r1(y - h + 8)}Q${r1(x - w / 2)} ${r1(y - h - 2)} ${r1(x - w / 2 + 10)} ${r1(y - h - 2)}L${r1(x + w / 2 - 10)} ${r1(y - h - 2)}Q${r1(x + w / 2)} ${r1(y - h - 2)} ${r1(x + w / 2)} ${r1(y - h + 8)}`
    const drips = Math.round(w / 34)
    for (let i = drips; i >= 0; i--) {
      const dx = x - w / 2 + (w * i) / drips
      const depth = 18 + ((i * 37) % 23)
      d += `L${r1(dx)} ${r1(y - h + depth)}`
      if (i > 0) {
        const mid = dx - w / drips / 2
        d += `Q${r1(mid)} ${r1(y - h + depth + 12)} ${r1(mid - 2)} ${r1(y - h + 16)}`
      }
    }
    out += `<path d="${d}Z" fill="${frost}"/>`
    return out
  }
  art += tier(cx, plate, cw, lowH, '#f7dcc0', '#f2a7b6')
  art += tier(cx, plate - lowH, topW, topH, '#fbe9d4', '#f6c9d2')
  // Taburan meses di badan kue.
  for (let i = 0; i < 26; i++) {
    const onTop = i % 2 === 0
    const w = onTop ? topW : cw
    const y0 = onTop ? plate - lowH - topH + 34 : plate - lowH + 34
    const x = cx - w / 2 + 16 + random() * (w - 32)
    const y = y0 + random() * ((onTop ? topH : lowH) - 50)
    art += `<rect x="${r1(x)}" y="${r1(y)}" width="10" height="3.6" rx="1.8" fill="${palette[i % 5]}" transform="rotate(${r1(random() * 180)} ${r1(x + 5)} ${r1(y + 1.8)})"/>`
  }
  // Piring foil.
  foil += `<rect x="${r1(cx - cw / 2 - 26)}" y="${plate - 2}" width="${r1(cw + 52)}" height="12" rx="6" fill="#000"/>`
  foil += `<path d="M${r1(cx - 22)} ${plate + 10}L${r1(cx - 34)} ${plate + 46}L${r1(cx + 34)} ${plate + 46}L${r1(cx + 22)} ${plate + 10}Z" fill="#000"/>`
  // Lilin bergaris dengan nyala foil.
  const candles = 5
  const candleTop = plate - lowH - topH - 70
  for (let i = 0; i < candles; i++) {
    const x = cx - topW * 0.32 + (topW * 0.64 * i) / (candles - 1)
    art += `<rect x="${r1(x - 6)}" y="${r1(candleTop)}" width="12" height="70" rx="3" fill="${palette[(i + 1) % 5]}"/>`
    for (let k = 0; k < 3; k++) {
      art += `<path d="M${r1(x - 6)} ${r1(candleTop + 14 + k * 20)}L${r1(x + 6)} ${r1(candleTop + 6 + k * 20)}" stroke="#fff" stroke-width="3.4" opacity=".75"/>`
    }
    foil += `<path d="M${r1(x)} ${r1(candleTop - 34)}C${r1(x + 10)} ${r1(candleTop - 18)} ${r1(x + 9)} ${r1(candleTop - 4)} ${r1(x)} ${r1(candleTop - 4)}C${r1(x - 9)} ${r1(candleTop - 4)} ${r1(x - 10)} ${r1(candleTop - 18)} ${r1(x)} ${r1(candleTop - 34)}Z" fill="#000"/>`
    art += `<path d="M${r1(x)} ${r1(candleTop - 4)}L${r1(x)} ${r1(candleTop + 2)}" stroke="#5b4a3a" stroke-width="2"/>`
  }

  // Balon di kiri, dan di kanan kalau kartunya lebar. Talinya foil, kilaunya juga.
  const balloon = (x, y, rx, color, tie) => {
    const ry = rx * 1.2
    let out = `<path d="M${r1(x)} ${r1(y + ry)}L${r1(x - 7)} ${r1(y + ry + 12)}L${r1(x + 7)} ${r1(y + ry + 12)}Z" fill="${color}"/>`
    out += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${color}"/>`
    art += out
    foil += `<path d="M${r1(x - rx * 0.5)} ${r1(y - ry * 0.35)}Q${r1(x - rx * 0.45)} ${r1(y - ry * 0.7)} ${r1(x - rx * 0.12)} ${r1(y - ry * 0.78)}" fill="none" stroke="#000" stroke-width="${r1(rx * 0.11)}" stroke-linecap="round"/>`
    const sx = x
    const sy = y + ry + 12
    foil += `<path d="M${r1(sx)} ${r1(sy)}C${r1(sx + 18)} ${r1(sy + 60)} ${r1(sx - 22)} ${r1(sy + 110)} ${r1(tie.x)} ${r1(tie.y)}" fill="none" stroke="#000" stroke-width="2"/>`
  }
  const left = Math.max(110, cx - cw / 2 - 120)
  // Tali balon diikat di ujung piring kue, dengan simpul foil.
  const tieL = { x: cx - cw / 2 - 16, y: plate + 2 }
  foil += `<circle cx="${r1(tieL.x)}" cy="${r1(tieL.y)}" r="6" fill="#000"/>`
  balloon(left - 30, 420, 50, palette[0], tieL)
  balloon(left + 52, 350, 46, palette[3], tieL)
  balloon(left + 8, 540, 42, palette[2], tieL)
  if (W > 900) {
    const right = W - Math.max(110, W - (cx + cw / 2 + 120))
    const tieR = { x: cx + cw / 2 + 16, y: plate + 2 }
    foil += `<circle cx="${r1(tieR.x)}" cy="${r1(tieR.y)}" r="6" fill="#000"/>`
    balloon(right + 30, 410, 50, palette[1], tieR)
    balloon(right - 52, 345, 44, palette[4], tieR)
    balloon(right - 6, 530, 42, palette[0], tieR)
  }

  // Konfeti: kertas warna-warni dicetak, sebagian jadi foil.
  const busy = (x, y) =>
    (Math.abs(x - cx) < cw / 2 + 30 && y > candleTop - 60) ||
    (x < left + 120 && y > 280 && y < 620) ||
    (W > 900 && x > W - (W - (cx + cw / 2 + 120)) - 100 && y > 280 && y < 620)
  const bits = scatter(random, {
    count: Math.round(46 * density),
    x0: 30,
    x1: W - 30,
    y0: 200,
    y1: H - 40,
    gap: 48,
    blocked: busy,
  })
  bits.forEach((p, i) => {
    const angle = r1(random() * 180)
    const color = palette[i % 5]
    const kind = i % 4
    if (kind === 0) {
      foil += `<rect x="${r1(p.x - 7)}" y="${r1(p.y - 3)}" width="14" height="6" rx="1.5" fill="#000" transform="rotate(${angle} ${r1(p.x)} ${r1(p.y)})"/>`
    } else if (kind === 1) {
      art += `<circle cx="${r1(p.x)}" cy="${r1(p.y)}" r="${r1(4 + random() * 3)}" fill="${color}"/>`
    } else if (kind === 2) {
      art += `<rect x="${r1(p.x - 8)}" y="${r1(p.y - 3.5)}" width="16" height="7" rx="1.5" fill="${color}" transform="rotate(${angle} ${r1(p.x)} ${r1(p.y)})"/>`
    } else {
      foil += `<path d="M${r1(p.x - 12)} ${r1(p.y)}q4 -8 8 0t8 0t8 0" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" transform="rotate(${angle} ${r1(p.x)} ${r1(p.y)})"/>`
    }
  })
  for (const p of scatter(random, {
    count: Math.round(6 * density),
    x0: 40,
    x1: W - 40,
    y0: 190,
    y1: 700,
    gap: 140,
    blocked: busy,
  })) {
    foil += sparkle(p.x, p.y, 10 + random() * 8, '#000')
  }

  return { art: svg(art, '', W), foil: svg(foil, '', W) }
}

// ---------------------------------------------------------------------------------------------
// Lebaran: ketupat bergantung, bulan sabit dengan bintang, dan masjid berkubah di bawah; tali
// ketupat, bulan, bintang segi delapan, jendela masjid, dan pita ornamen jadi foil.

function lebaran(W) {
  const random = seeded(1447)
  let art = ''
  let foil = ''
  const density = W / 720
  const greens = ['#83b065', '#5f8f4c', '#b2d396', '#4a7539']

  /** Ketupat: anyaman kotak-kotak dua hijau diputar 45°, ekor janur di pucuknya, dan tali foil. */
  function ketupat(x, y, size, swing) {
    const a = size / Math.SQRT2
    const n = 4
    const cell = a / n
    let weave = ''
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const left = -a / 2 + i * cell
        const top = -a / 2 + j * cell
        weave += `<rect x="${r1(left)}" y="${r1(top)}" width="${r1(cell)}" height="${r1(cell)}" fill="${(i + j) % 2 ? greens[0] : greens[1]}"/>`
        // Satu helai janur yang lebih terang di tiap kotak, berselang arah seperti anyaman.
        weave +=
          (i + j) % 2
            ? `<rect x="${r1(left + cell * 0.18)}" y="${r1(top + cell * 0.38)}" width="${r1(cell * 0.64)}" height="${r1(cell * 0.24)}" rx="2" fill="${greens[2]}" opacity=".7"/>`
            : `<rect x="${r1(left + cell * 0.38)}" y="${r1(top + cell * 0.18)}" width="${r1(cell * 0.24)}" height="${r1(cell * 0.64)}" rx="2" fill="${greens[2]}" opacity=".45"/>`
      }
    }
    const t = -size / 2
    const tails =
      `<path d="M-2 ${t}C-14 ${t - 26} -40 ${t - 30} -52 ${t - 10}L-44 ${t - 6}C-34 ${t - 20} -16 ${t - 16} 3 ${t + 2}Z" fill="${greens[1]}"/>` +
      `<path d="M2 ${t}C16 ${t - 22} 40 ${t - 22} 50 ${t + 2}L42 ${t + 4}C34 ${t - 12} 16 ${t - 12} -3 ${t + 2}Z" fill="${greens[0]}"/>`
    art += `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(swing)})">${tails}<g transform="rotate(45)">${weave}<rect x="${r1(-a / 2)}" y="${r1(-a / 2)}" width="${r1(a)}" height="${r1(a)}" fill="none" stroke="${greens[3]}" stroke-width="2.6"/></g></g>`
    const top = {
      x: x + Math.sin(rad(swing)) * (size / 2),
      y: y - Math.cos(rad(swing)) * (size / 2),
    }
    foil += `<path d="M${r1(top.x)} -10L${r1(top.x)} ${r1(top.y)}" stroke="#000" stroke-width="2.2"/>`
    foil += `<circle cx="${r1(top.x)}" cy="${r1(top.y)}" r="5.5" fill="#000"/>`
    return { x, y, size }
  }

  // Bulan sabit besar dengan bintang segi delapan di lengkungnya.
  const moon = { x: W / 2 - 36, y: 452, r: 112 }
  foil += crescent(moon.x, moon.y, moon.r, 50, -36, 97, '#000')
  foil += octagram(moon.x + 60, moon.y - 34, 25, '#000', 0.72)

  // Ketupat yang tergantung di atas bulan dinaikkan, supaya tidak menempel ke bulannya.
  const count = W > 1100 ? 5 : W > 900 ? 4 : 3
  const drops = [250, 196, 312, 226, 282]
  const hung = []
  for (let i = 0; i < count; i++) {
    const x = (W * (i + 0.5)) / count + (i % 2 ? 12 : -12)
    const size = i % 2 ? 92 : 106
    const nearMoon = Math.abs(x - moon.x) < moon.r + size
    const drop = nearMoon ? Math.min(drops[i], moon.y - moon.r - size / 2 - 70) : drops[i]
    hung.push(ketupat(x, drop, size, (i - (count - 1) / 2) * 3))
  }

  // Masjid. Lapis belakang: kubah dan menara kecil berselang, hijau pucat.
  const ground = H - 72
  let back = `M-10 ${H + 10}L-10 ${ground - 60}`
  for (let x = -10; x < W + 10;) {
    const w = 60 + random() * 70
    const h = 70 + random() * 70
    if (random() < 0.3) {
      // Menara ramping.
      back += `L${r1(x)} ${r1(ground - 60)}L${r1(x + 8)} ${r1(ground - 60)}L${r1(x + 8)} ${r1(ground - h - 60)}L${r1(x + 14)} ${r1(ground - h - 82)}L${r1(x + 20)} ${r1(ground - h - 60)}L${r1(x + 20)} ${r1(ground - 60)}`
      x += 30
      continue
    }
    back += `L${r1(x)} ${r1(ground - h * 0.45)}C${r1(x)} ${r1(ground - h)} ${r1(x + w / 2)} ${r1(ground - h * 1.05)} ${r1(x + w / 2)} ${r1(ground - h * 1.25)}C${r1(x + w / 2)} ${r1(ground - h * 1.05)} ${r1(x + w)} ${r1(ground - h)} ${r1(x + w)} ${r1(ground - h * 0.45)}`
    x += w + 10 + random() * 30
  }
  art += `<path d="${back}L${W + 10} ${ground - 60}L${W + 10} ${H + 10}Z" fill="#c6dbd0"/>`

  // Lapis depan: masjid besar di tengah dengan dua menara, serambi berkubah kecil ke kiri-kanan.
  const front = '#88b09f'
  const cx = W / 2
  const dome = (x, base, w, h) =>
    `<path d="M${r1(x - w / 2)} ${r1(base)}C${r1(x - w * 0.62)} ${r1(base - h * 0.55)} ${r1(x - w * 0.2)} ${r1(base - h * 0.72)} ${r1(x)} ${r1(base - h)}C${r1(x + w * 0.2)} ${r1(base - h * 0.72)} ${r1(x + w * 0.62)} ${r1(base - h * 0.55)} ${r1(x + w / 2)} ${r1(base)}Z" fill="${front}"/>`
  const finial = (x, top) => {
    art += `<path d="M${r1(x)} ${r1(top)}L${r1(x)} ${r1(top - 18)}" stroke="${front}" stroke-width="3"/>`
    foil += crescent(x, top - 26, 8, 4, -3, 6.5, '#000')
  }
  // Serambi rendah sepanjang kartu, dengan kubah kecil berjarak.
  art += `<rect x="-10" y="${ground - 46}" width="${W + 20}" height="${H - ground + 56}" fill="${front}"/>`
  for (let x = cx - 290; x > -40; x -= 120) {
    art += dome(x, ground - 46, 54, 52)
    finial(x, ground - 98)
  }
  for (let x = cx + 290; x < W + 40; x += 120) {
    art += dome(x, ground - 46, 54, 52)
    finial(x, ground - 98)
  }
  // Bangunan utama, tambur, dan kubah besar.
  art += `<rect x="${r1(cx - 150)}" y="${ground - 130}" width="300" height="140" fill="${front}"/>`
  art += `<rect x="${r1(cx - 76)}" y="${ground - 158}" width="152" height="32" fill="${front}"/>`
  art += dome(cx, ground - 154, 188, 150)
  finial(cx, ground - 304)
  art += dome(cx - 112, ground - 128, 62, 56)
  art += dome(cx + 112, ground - 128, 62, 56)
  // Menara kembar dengan balkon.
  for (const side of [-1, 1]) {
    const mx = cx + side * 196
    art += `<rect x="${r1(mx - 14)}" y="${ground - 300}" width="28" height="310" fill="${front}"/>`
    art += `<rect x="${r1(mx - 22)}" y="${ground - 236}" width="44" height="12" rx="3" fill="${front}"/>`
    art += dome(mx, ground - 298, 34, 44)
    finial(mx, ground - 342)
  }
  // Jendela lengkung foil di bangunan utama.
  for (let i = -2; i <= 2; i++) {
    const wx = cx + i * 50
    const top = ground - 98
    foil += `<path d="M${r1(wx - 12)} ${ground - 20}L${r1(wx - 12)} ${top + 12}Q${r1(wx - 12)} ${top} ${r1(wx)} ${top - 8}Q${r1(wx + 12)} ${top} ${r1(wx + 12)} ${top + 12}L${r1(wx + 12)} ${ground - 20}Z" fill="#000"/>`
  }

  // Pita ornamen foil di kaki kartu: garis dan belah ketupat kecil.
  foil += `<rect x="0" y="${H - 38}" width="${W}" height="3" fill="#000"/>`
  for (let x = 18; x < W; x += 36) foil += `<path d="M${x} ${H - 26}l8 8l-8 8l-8 -8Z" fill="#000"/>`

  // Bintang segi delapan dan kilau kecil di langit, menjauhi bulan, ketupat, dan talinya.
  const sky = scatter(random, {
    count: Math.round(18 * density),
    x0: 36,
    x1: W - 36,
    y0: 60,
    y1: ground - 330,
    gap: 72,
    blocked: (x, y) =>
      Math.hypot(x - moon.x, y - moon.y) < 160 ||
      hung.some(
        (k) => Math.hypot(x - k.x, y - k.y) < k.size * 0.9 || (Math.abs(x - k.x) < 26 && y < k.y),
      ),
  })
  for (const p of sky) {
    foil +=
      random() < 0.55
        ? octagram(p.x, p.y, 7 + random() * 6, '#000')
        : sparkle(p.x, p.y, 6 + random() * 7, '#000')
  }

  return { art: svg(art, '', W), foil: svg(foil, '', W) }
}

/** Tanda kecil di sampul belakang. */
function mark() {
  const random = seeded(5)
  const body = frond(random, 360, 700, 300, 8, '#000')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="250 370 220 340" width="220" height="340">${body}</svg>\n`
}

mkdirSync(outDir, { recursive: true })
for (const [name, make] of Object.entries({ meadow, sprig, night, birthday, lebaran })) {
  for (const [suffix, width] of SHAPES) {
    const { art, foil } = make(width)
    writeFileSync(new URL(`${name}${suffix}.svg`, outDir), art)
    writeFileSync(new URL(`${name}${suffix}-foil.svg`, outDir), foil)
  }
}
writeFileSync(new URL('mark-foil.svg', outDir), mark())
console.log('Ilustrasi ditulis ke public/illustrations/')
