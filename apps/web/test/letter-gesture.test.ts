import { contentLimits, letter, normalizeContent, type LetterElement } from '@postpocket/presets'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  moved,
  pointerAngle,
  scaled,
  snappedRotation,
  textSized,
  uniqueId,
} from '../app/utils/letter-gesture'
import { describeElement, elementStyle } from '../app/utils/letter-page'

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

describe('textSized', () => {
  it('mengubah huruf saja, dalam rentangnya', () => {
    if (text.kind !== 'text') throw new Error('bukan teks')
    expect(textSized(text, 2).size).toBeCloseTo(0.12)
    expect(textSized(text, 100).size).toBe(contentLimits.size.max)
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
