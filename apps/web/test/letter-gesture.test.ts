import {
  contentLimits,
  elementBounds,
  letter,
  normalizeContent,
  textRooms,
  type LetterElement,
} from '@postpocket/presets'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  keptInPage,
  moved,
  pinched,
  pointerAngle,
  scaled,
  snappedRotation,
  textSized,
  uniqueId,
} from '../app/utils/letter-gesture'
import {
  MIN_TEXT_SCALE,
  describeElement,
  elementStyle,
  fittedScale,
} from '../app/utils/letter-page'

const [text, photo, sticker] = normalizeContent({
  elements: [
    { kind: 'text', id: 't', x: 0.5, y: 0.5, width: 0.5, rotation: 0, text: 'Halo', size: 0.06 },
    { kind: 'photo', id: 'p', x: 0.2, y: 0.8, width: 0.4, rotation: 3, photo: 'f1', aspect: 1 },
    { kind: 'sticker', id: 's', x: 0.9, y: 0.1, width: 0.2, rotation: -8, sticker: 'heart' },
  ],
}).elements as [LetterElement, LetterElement, LetterElement]

describe('moved', () => {
  it('menggeser dan menjaga titik tengah di halaman', () => {
    expect(moved(text, 0.1, -0.2)).toEqual({ x: 0.6, y: 0.3 })
    expect(moved(sticker, 0.5, -0.5)).toEqual({ x: 1, y: 0 })
  })
})

describe('scaled', () => {
  it('teks ikut membesarkan hurufnya', () => {
    const next = scaled(text, 1.5)
    expect(next.width).toBeCloseTo(0.75)
    expect(next.size).toBeCloseTo(0.09)
  })

  it('berhenti di batas lebar, dan huruf ikut berhenti di skala yang sama', () => {
    const next = scaled(text, 4)
    expect(next.width).toBe(contentLimits.width.max)
    expect(next.size).toBeCloseTo(0.06 * (contentLimits.width.max / 0.5))
    expect(scaled(photo, 0.01)).toEqual({ width: contentLimits.width.min })
  })
})

describe('keptInPage', () => {
  const inside = (element: LetterElement, ratio: number, textHeight?: number) => {
    const box = elementBounds(element, ratio, textHeight)
    return box.left >= -1e-9 && box.right <= 1 + 1e-9 && box.top >= -1e-9 && box.bottom <= 1 + 1e-9
  }

  it('foto yang digeser ke pojok berhenti di tepi halaman, termasuk setelah diputar', () => {
    const corner = { ...photo, ...moved(photo, -1, 1) }
    const next = { ...corner, ...keptInPage(corner, 0.75) }
    expect(inside(next, 0.75)).toBe(true)
    // Menempel di tepi kiri dan bawah, tidak ditarik ke tengah.
    const box = elementBounds(next, 0.75)
    expect(box.left).toBeCloseTo(0, 6)
    expect(box.bottom).toBeCloseTo(1, 6)
  })

  it('teks memakai tingginya hasil ukur, dengan jarak dari tepi seperti ruangnya', () => {
    const low = { ...text, y: 0.98 }
    const next = { ...low, ...keptInPage(low, 0.75, 0.3) }
    expect(next.y).toBeCloseTo(0.82)
    expect(inside(next, 0.75, 0.3)).toBe(true)
    // Di posisi itu ruangnya pas setinggi teksnya, jadi hurufnya tidak ikut diperkecil.
    const room = textRooms({ version: 1, elements: [next] }, 0.75)[next.id]!
    expect(room).toBeCloseTo(0.3)
  })

  it('elemen yang lebih besar dari halaman diletakkan di tengah', () => {
    const huge = { ...sticker, width: 1, x: 0.9 }
    expect(keptInPage(huge, 1.3333)).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('scaled di dalam halaman', () => {
  it('foto dan stiker berhenti membesar di tepi halaman', () => {
    for (const ratio of [0.72, 1, 1.3333]) {
      for (const element of [photo, sticker]) {
        const next = { ...element, ...scaled(element, 10, ratio) }
        const box = elementBounds(next, ratio)
        expect(box.right - box.left).toBeLessThanOrEqual(1 + 1e-9)
        expect(box.bottom - box.top).toBeLessThanOrEqual(1 + 1e-9)
      }
    }
  })

  it('tanpa rasio halaman tetap memakai batas kontrak', () => {
    expect(scaled(photo, 10).width).toBe(contentLimits.width.max)
  })
})

describe('fittedScale', () => {
  // Tinggi tulisan kira-kira sebanding kuadrat skalanya: baris makin pendek dan makin banyak.
  const heightAt = (full: number) => (scale: number) => full * scale * scale

  it('tulisan yang muat tidak diperkecil', () => {
    expect(fittedScale(200, heightAt(150))).toBe(1)
  })

  it('tulisan yang terlalu tinggi diperkecil sampai muat', () => {
    const scale = fittedScale(100, heightAt(400))
    expect(scale).toBeLessThan(1)
    expect(heightAt(400)(scale)).toBeLessThanOrEqual(100.5)
    // Sedekat mungkin dengan skala terbesar yang muat (0.5).
    expect(scale).toBeGreaterThan(0.49)
  })

  it('tidak pernah lebih kecil dari batas bawahnya', () => {
    expect(fittedScale(10, heightAt(10_000))).toBe(MIN_TEXT_SCALE)
  })
})

describe('textSized', () => {
  it('mengubah huruf saja, dalam rentangnya', () => {
    if (text.kind !== 'text') throw new Error('bukan teks')
    expect(textSized(text, 2).size).toBeCloseTo(0.12)
    expect(textSized(text, 100).size).toBe(contentLimits.size.max)
  })
})

describe('pinched', () => {
  it('ukuran, putaran, dan posisi berubah sekaligus', () => {
    const next = pinched(sticker, { factor: 1.5, turn: 30, dx: -0.1, dy: 0.2 })
    expect(next.width).toBeCloseTo(0.3)
    expect(next.rotation).toBe(22)
    expect(next.x).toBeCloseTo(0.8)
    expect(next.y).toBeCloseTo(0.3)
  })

  it('teks ikut membesarkan hurufnya, putaran tetap menempel, dan elemen tetap di halaman', () => {
    const next = pinched(text, { factor: 2, turn: 88, dx: 1, dy: 0 })
    expect(next.width).toBeCloseTo(1)
    expect(next.size).toBeCloseTo(0.12)
    expect(next.rotation).toBe(90)
    expect(next.x).toBe(1)
  })
})

describe('pointerAngle dan snappedRotation', () => {
  it('menghitung sudut dari titik tengah', () => {
    expect(pointerAngle(0, 0, 10, 0)).toBe(0)
    expect(pointerAngle(0, 0, 0, 10)).toBe(90)
  })

  it('menempel ke kelipatan 90° kalau dekat, dan tetap di -180 sampai 180', () => {
    expect(snappedRotation(3)).toBe(0)
    expect(snappedRotation(-87)).toBe(-90)
    expect(snappedRotation(10)).toBe(10)
    expect(snappedRotation(370)).toBe(10)
    expect(Math.abs(snappedRotation(182))).toBe(180)
  })
})

describe('uniqueId', () => {
  it('tidak pernah memakai id yang sudah ada', () => {
    const taken = new Set<string>()
    for (let i = 0; i < 200; i++) taken.add(uniqueId('s', taken))
    expect(taken.size).toBe(200)
    for (const id of taken) expect(id).toMatch(/^s[a-z0-9]{1,6}$/)
  })
})

describe('elementStyle dan describeElement', () => {
  it('menaruh elemen di titik tengahnya, dengan putaran', () => {
    expect(elementStyle(photo)).toEqual({
      left: '20%',
      top: '80%',
      width: '40%',
      transform: 'translate(-50%, -50%) rotate(3deg)',
    })
  })

  it('label untuk pembaca layar', () => {
    expect(describeElement(text)).toBe('Teks: Halo')
    expect(describeElement(photo)).toBe('Foto')
    expect(describeElement(sticker, 'Hati')).toBe('Stiker Hati')
  })
})

describe('stiker', () => {
  it('setiap stiker di preset punya berkasnya', () => {
    for (const item of letter.stickers) {
      expect(existsSync(new URL(`../public${item.src}`, import.meta.url)), item.src).toBe(true)
    }
  })
})
