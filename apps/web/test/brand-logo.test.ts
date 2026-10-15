import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BRAND_COLORS,
  BRAND_LOCKUP,
  BRAND_SYMBOL,
  BRAND_WORDMARK,
  brandIconSvg,
  brandLockupSvg,
  brandSymbolSvg,
} from '../app/utils/brand-logo'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

/** Titik sudut path yang hanya berisi M, H, V, L, dan A absolut. */
function points(d: string): [number, number][] {
  const tokens = d.match(/[MHVLAZ]|-?\d*\.?\d+/g) ?? []
  const out: [number, number][] = []
  let x = 0
  let y = 0
  let cmd = ''
  for (let i = 0; i < tokens.length;) {
    if (/[MHVLAZ]/.test(tokens[i]!)) {
      cmd = tokens[i++]!
      continue
    }
    const n = () => Number(tokens[i++])
    if (cmd === 'M' || cmd === 'L') [x, y] = [n(), n()]
    else if (cmd === 'H') x = n()
    else if (cmd === 'V') y = n()
    else if (cmd === 'A') {
      i += 5
      ;[x, y] = [n(), n()]
    }
    out.push([x, y])
  }
  return out
}

describe('logo P-amplop', () => {
  it('tutup amplop mulai di tepi dalam batang dan ada di dalam mangkuk', () => {
    for (const flap of [BRAND_SYMBOL.flap, BRAND_SYMBOL.flapSmall]) {
      const corners = points(flap)
      expect(Math.min(...corners.map(([x]) => x))).toBe(44)
      for (const [x, y] of corners) {
        expect(x).toBeLessThan(BRAND_SYMBOL.width - 24)
        expect(y).toBeGreaterThan(24)
        expect(y).toBeLessThan(120 - 40)
      }
    }
    const outline = points(BRAND_SYMBOL.outline)
    expect(Math.max(...outline.map(([x]) => x))).toBe(BRAND_SYMBOL.width)
    expect(Math.max(...outline.map(([, y]) => y))).toBe(BRAND_SYMBOL.height)
  })

  it('lockup selebar simbol, jarak, dan wordmark; huruf kapitalnya separuh tinggi P', () => {
    expect(BRAND_LOCKUP.width).toBeCloseTo(BRAND_SYMBOL.width + 40 + BRAND_WORDMARK.width)
    expect(BRAND_WORDMARK.cap).toBe(BRAND_SYMBOL.height / 2)
    expect(brandLockupSvg()).toContain(`viewBox="0 0 ${BRAND_LOCKUP.width} ${BRAND_LOCKUP.height}"`)
  })

  it('master di docs/brand dan favicon dibangun dari geometri yang sama', () => {
    const docs = (name: string) => read(`../../../docs/brand/${name}`).trim()
    expect(docs('postpocket-symbol.svg')).toBe(brandSymbolSvg({ gold: BRAND_COLORS.gold }))
    expect(docs('postpocket-symbol-mono.svg')).toBe(brandSymbolSvg({ ink: BRAND_COLORS.ink }))
    expect(docs('postpocket-horizontal.svg')).toBe(brandLockupSvg({ gold: BRAND_COLORS.gold }))
    expect(docs('postpocket-wordmark.svg')).toContain(BRAND_WORDMARK.d)
    const favicon = read('../public/favicon.svg').trim()
    expect(favicon).toBe(brandIconSvg(32, { fill: 0.74, radius: 0.22, small: true }))
    expect(favicon).toContain(BRAND_SYMBOL.flapSmall)
    expect(favicon).toContain(BRAND_COLORS.canvas)
  })

  it('P di ikon maskable muat di lingkaran aman 80%', () => {
    const size = 512
    const svg = brandIconSvg(size, { fill: 0.54 })
    const [, x, y, scale] = svg
      .match(/translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/)!
      .map(Number)
    // Sudut kotak P, bukan titik path: lengkung sudutnya tidak pernah lebih jauh dari sini.
    const { width, height } = BRAND_SYMBOL
    const corners = [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ].map(([px, py]) => [x! + px! * scale!, y! + py! * scale!])
    for (const [cx, cy] of corners) {
      expect(Math.hypot(cx! - size / 2, cy! - size / 2)).toBeLessThan(0.4 * size)
    }
  })
})
