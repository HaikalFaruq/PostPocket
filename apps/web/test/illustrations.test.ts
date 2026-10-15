import { byId, letter } from '@postpocket/presets'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const publicFile = (path: string) => new URL(`../public${path}`, import.meta.url)

/** Lebar dibagi tinggi dari `viewBox` sebuah SVG di public/. */
function svgRatio(path: string): number {
  const source = readFileSync(publicFile(path), 'utf8')
  const box = /viewBox="([\d.\s-]+)"/.exec(source)?.[1]?.split(/\s+/).map(Number)
  if (!box || box.length !== 4) throw new Error(`${path} tidak punya viewBox`)
  return box[2]! / box[3]!
}

describe('ilustrasi depan kartu', () => {
  for (const item of letter.illustrations) {
    it(`${item.id}: gambar asli dan setiap komposisi ada, dengan rasio bentuknya`, () => {
      const pairs: [number, { art: string; foil: string }][] = [
        [item.ratio, item],
        ...Object.entries(item.variants).map(
          ([shape, art]): [number, { art: string; foil: string }] => [
            byId(letter.shapes, shape)!.ratio!,
            art,
          ],
        ),
      ]
      for (const [ratio, { art, foil }] of pairs) {
        for (const path of [art, foil]) {
          expect(existsSync(publicFile(path)), path).toBe(true)
          // Selisih di bawah 0,5 %: tidak ada potongan yang terlihat di kartu.
          expect(Math.abs(svgRatio(path) / ratio - 1), path).toBeLessThan(0.005)
        }
      }
    })
  }

  it('lapisan foil tidak memakai mask atau id, jadi aman dipakai sebagai mask CSS', () => {
    for (const item of letter.illustrations) {
      for (const { foil } of [item, ...Object.values(item.variants)]) {
        const source = readFileSync(publicFile(foil), 'utf8')
        expect(source, foil).not.toMatch(/<mask|url\(#/)
      }
    }
  })
})
