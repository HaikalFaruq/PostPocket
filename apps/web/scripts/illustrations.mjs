// Ilustrasi depan kartu Letter: tiap ilustrasi punya lapisan cetak (art) dan lapisan foil
// (dipakai sebagai mask). Semuanya dibentuk prosedural dengan angka acak ber-seed, jadi hasilnya
// selalu sama dan asetnya milik sendiri.
//
//   node scripts/illustrations.mjs

import { mkdirSync, writeFileSync } from 'node:fs'

const W = 720
const H = 1000
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

function svg(body, defs = '', box = [0, 0, W, H]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${box[2]}" height="${box[3]}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`
}

/** Daun almond sepanjang `len`, lebar `wid`, berpangkal di (x, y) dan mengarah ke `angle` derajat. */
function leaf(x, y, len, wid, angle, fill) {
  return `<path d="M0 0Q${r1(len * 0.45)} ${r1(-wid)} ${r1(len)} 0Q${r1(len * 0.55)} ${r1(wid)} 0 0Z" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(angle)})" fill="${fill}"/>`
}

function sparkle(x, y, s, fill) {
  const k = s * 0.18
  return `<path d="M${r1(x)} ${r1(y - s)}Q${r1(x + k)} ${r1(y - k)} ${r1(x + s)} ${r1(y)}Q${r1(x + k)} ${r1(y + k)} ${r1(x)} ${r1(y + s)}Q${r1(x - k)} ${r1(y + k)} ${r1(x - s)} ${r1(y)}Q${r1(x - k)} ${r1(y - k)} ${r1(x)} ${r1(y - s)}Z" fill="${fill}"/>`
}

function star(x, y, outer, inner, rotate, fill) {
  const points = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const a = ((rotate + i * 36 - 90) * Math.PI) / 180
    points.push(`${r1(x + radius * Math.cos(a))},${r1(y + radius * Math.sin(a))}`)
  }
  return `<polygon points="${points.join(' ')}" fill="${fill}"/>`
}

/**
 * Batang lengkung dari (x0, y0) sepanjang `len` ke arah `angle` (derajat, 0 = ke atas),
 * dengan daun berselang-seling. Mengembalikan path batang, daun, dan titik ujung.
 */
function stem(
  random,
  { x0, y0, len, angle, bend, leaves, leafLen, leafWid, color, leafColor, width },
) {
  const a = (angle * Math.PI) / 180
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
  let out = `<path d="M${r1(x0)} ${r1(y0)}Q${r1(cx)} ${r1(cy)} ${r1(x1)} ${r1(y1)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`
  for (let i = 0; i < leaves; i++) {
    const t = 0.18 + (i / Math.max(1, leaves)) * 0.74
    const p = point(t)
    const side = i % 2 === 0 ? 1 : -1
    const dir = tangent(t) + side * (38 + random() * 18)
    const scale = 0.75 + (1 - t) * 0.45
    out += leaf(p.x, p.y, leafLen * scale, leafWid * scale, dir, leafColor)
  }
  return { svg: out, tip: { x: x1, y: y1 }, point, tangent }
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

function meadow() {
  const random = seeded(2026)
  const greens = ['#5e8f58', '#6f9f62', '#4f7d4b', '#86ad6f']
  let art = ''
  let foil = ''

  // Batang dan bunga cetak.
  for (let i = 0; i < 64; i++) {
    const x0 = 10 + random() * 700
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

  // Foil: ranting di sela bunga, karangan daun di atas, dan kilau kecil.
  for (let i = 0; i < 12; i++) {
    foil += frond(
      random,
      20 + i * 60 + random() * 30,
      H + 10,
      210 + random() * 170,
      (random() - 0.5) * 28,
      '#000',
    )
  }
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
      }
    }
    foil += `<path d="${d}" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>`
  }
  for (let i = 0; i < 16; i++) {
    const x = 70 + random() * 580
    const y = 90 + random() * 420
    if (Math.hypot(x - cx, y - cy) < radius + 30) continue
    foil += sparkle(x, y, 6 + random() * 9, '#000')
  }
  foil += sparkle(cx, cy, 26, '#000')

  return { art: svg(art), foil: svg(foil) }
}

function sprig() {
  const random = seeded(77)
  let art = ''
  let foil = ''
  // Ranting eukaliptus diagonal: batang dan daun bulat jadi foil, buah kecil dicetak.
  const x0 = 210
  const y0 = 880
  const x1 = 520
  const y1 = 170
  const cx = 470
  const cy = 620
  const point = (t) => ({
    x: (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1,
    y: (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1,
  })
  foil += `<path d="M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round"/>`
  for (let i = 0; i < 17; i++) {
    const t = 0.06 + i * 0.056
    const p = point(t)
    const side = i % 2 === 0 ? 1 : -1
    const size = 62 - t * 26
    const ox = side * (size * 0.95)
    foil += `<path d="M${r1(p.x)} ${r1(p.y)}L${r1(p.x + ox * 0.55)} ${r1(p.y - 4)}" stroke="#000" stroke-width="3" stroke-linecap="round"/>`
    foil += `<ellipse cx="${r1(p.x + ox)}" cy="${r1(p.y - 6)}" rx="${r1(size * 0.62)}" ry="${r1(size * 0.5)}" transform="rotate(${r1(side * -18 - 10)} ${r1(p.x + ox)} ${r1(p.y - 6)})" fill="#000"/>`
  }
  for (let i = 0; i < 9; i++) {
    const p = point(0.2 + random() * 0.65)
    const dx = (random() - 0.5) * 120
    art += `<circle cx="${r1(p.x + dx)}" cy="${r1(p.y + 20 + random() * 30)}" r="${r1(6 + random() * 5)}" fill="#c98a9b"/>`
  }
  for (let i = 0; i < 6; i++) {
    const p = point(0.15 + random() * 0.7)
    art += leaf(p.x - 30, p.y + 10, 46, 9, 150 + random() * 40, '#8fae8b')
  }
  return { art: svg(art), foil: svg(foil) }
}

function night() {
  const random = seeded(9)
  let art = ''
  let foil = ''
  // Bukit berlapis dan awan dicetak; bulan, bintang, dan rasi jadi foil.
  const hills = [
    { y: 790, amp: 40, color: '#9db7d6' },
    { y: 840, amp: 34, color: '#7d9cc4' },
    { y: 900, amp: 26, color: '#5d7fae' },
  ]
  for (const hill of hills) {
    let d = `M0 ${H}L0 ${hill.y}`
    for (let x = 0; x <= W; x += 60) {
      d += `Q${x + 30} ${r1(hill.y - hill.amp * (0.4 + random()))} ${x + 60} ${r1(hill.y + (random() - 0.5) * 20)}`
    }
    art += `<path d="${d}L${W} ${H}Z" fill="${hill.color}" opacity=".9"/>`
  }
  for (const [x, y, s] of [
    [150, 560, 1],
    [520, 470, 0.8],
  ]) {
    art += `<g transform="translate(${x} ${y}) scale(${s})" fill="#e7eef7"><ellipse cx="0" cy="0" rx="70" ry="22"/><ellipse cx="-24" cy="-14" rx="34" ry="24"/><ellipse cx="22" cy="-18" rx="40" ry="28"/></g>`
  }

  const defs =
    '<mask id="crescent"><rect width="100%" height="100%" fill="#fff"/><circle cx="548" cy="168" r="66" fill="#000"/></mask>'
  foil += `<circle cx="520" cy="190" r="78" fill="#000" mask="url(#crescent)"/>`
  const stars = []
  for (let i = 0; i < 46; i++) {
    const x = 40 + random() * 640
    const y = 50 + random() * 640
    if (Math.hypot(x - 520, y - 190) < 110) continue
    stars.push([x, y])
    foil +=
      random() < 0.55
        ? sparkle(x, y, 4 + random() * 10, '#000')
        : star(x, y, 4 + random() * 7, 2 + random() * 2, random() * 72, '#000')
  }
  const constellation = [
    [120, 250],
    [190, 210],
    [260, 240],
    [300, 320],
    [240, 380],
  ]
  foil += `<polyline points="${constellation.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round"/>`
  for (const [x, y] of constellation) foil += star(x, y, 10, 4, 0, '#000')
  return { art: svg(art), foil: svg(foil, defs) }
}

/** Tanda kecil di sampul belakang. */
function mark() {
  const random = seeded(5)
  const body = frond(random, 360, 700, 300, 8, '#000')
  return svg(body, '', [250, 370, 220, 340])
}

mkdirSync(outDir, { recursive: true })
for (const [name, make] of Object.entries({ meadow, sprig, night })) {
  const { art, foil } = make()
  writeFileSync(new URL(`${name}.svg`, outDir), art)
  writeFileSync(new URL(`${name}-foil.svg`, outDir), foil)
}
writeFileSync(new URL('mark-foil.svg', outDir), mark())
console.log('Ilustrasi ditulis ke public/illustrations/')
