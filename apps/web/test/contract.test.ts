import { readFileSync } from 'node:fs'
import { defaultLetterDesign, letter, normalizeContent } from '@postpocket/presets'
import { describe, expect, it } from 'vitest'
import { buildCreateRequest, type SendInput, type UploadImage } from '../app/utils/letter-api'
import { compileContract, contractDetails } from '../server/utils/contract'

// Body dari klien harus lolos skema di docs/api/openapi.yaml, karena backend memvalidasi dengan
// skema yang sama. Mock API memakai validator yang sama (server/utils/contract.ts).

const schemas = compileContract(
  readFileSync(new URL('../../../docs/api/openapi.yaml', import.meta.url), 'utf8'),
)
const createRequest = schemas('CreateLetterRequest')

const image = (width: number, height: number, size: number, type = 'image/jpeg'): UploadImage => ({
  blob: new Blob([]),
  type,
  width,
  height,
  size,
})

/** Isi surat sepenuh-penuhnya: 4 teks, 4 foto, dan 16 stiker. */
const full = normalizeContent({
  elements: [
    ...Array.from({ length: 4 }, (_, i) => ({
      kind: 'text',
      id: `t${i}`,
      x: 0.5,
      y: 0.2 * i,
      width: 0.8,
      rotation: -3.5,
      text: `Selamat ulang tahun 🎂\nbaris ${i}`,
      size: 0.07,
      align: 'left',
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      kind: 'photo',
      id: `p${i}`,
      x: 0.25,
      y: 0.3,
      width: 0.45,
      rotation: 4,
      photo: `f${i}`,
      aspect: 4 / 3,
    })),
    ...letter.stickers.slice(0, 16).map((sticker, i) => ({
      kind: 'sticker',
      id: `s${i}`,
      x: 0.9,
      y: 0.1,
      width: 0.18,
      rotation: 12,
      sticker: sticker.id,
    })),
  ],
})

const input: SendInput = {
  design: defaultLetterDesign,
  content: full,
  cover: null,
  photos: Object.fromEntries(
    Array.from({ length: 4 }, (_, i) => [`f${i}`, image(2048, 1536, 380_000, 'image/webp')]),
  ),
  og: image(1200, 630, 110_000),
}

function expectValid(body: unknown) {
  const valid = createRequest(body)
  expect(contractDetails(createRequest.errors)).toEqual([])
  expect(valid).toBe(true)
}

describe('kontrak POST /letters', () => {
  it('body dari klien lolos skema, termasuk isi surat sepenuh-penuhnya', () => {
    expect(full.elements).toHaveLength(24)
    expectValid(buildCreateRequest(input))
  })

  it('cover foto user dan replyTo juga lolos', () => {
    expectValid(
      buildCreateRequest({
        ...input,
        design: { ...defaultLetterDesign, illustration: 'upload', foilMode: 'detail' },
        cover: image(1536, 2048, 412_000),
        replyTo: 'x7Kp2qLm9A',
      }),
    )
  })

  it('panjang teks dihitung per code point, sama dengan batas di presets', () => {
    const content = normalizeContent({
      elements: [{ kind: 'text', id: 't', x: 0.5, y: 0.5, width: 0.8, text: '😀'.repeat(700) }],
    })
    expectValid(buildCreateRequest({ ...input, content, photos: {} }))
  })

  it('skema menolak field asing dan gambar OG selain JPEG atau PNG', () => {
    const body = JSON.parse(JSON.stringify(buildCreateRequest(input)))
    body.content.elements[0].color = 'red'
    body.photos[0].exif = {}
    body.og.type = 'image/webp'
    expect(createRequest(body)).toBe(false)
    // Error dari cabang elemen lain (foto, stiker) tidak ikut dilaporkan.
    expect(contractDetails(createRequest.errors)).toEqual([
      { path: 'content.elements[0].color', message: 'must NOT have unevaluated properties' },
      { path: 'content.elements[0]', message: 'must match exactly one schema in oneOf' },
      { path: 'photos[0].exif', message: 'must NOT have unevaluated properties' },
      { path: 'og.type', message: 'must be equal to one of the allowed values' },
      // Sejak 0.3.0 `og` boleh `null` (surat titipan), jadi cabang `null`-nya ikut dilaporkan,
      // sama seperti `cover`. Lokasi pertama tetap field yang salah.
      { path: 'og', message: 'must be null' },
      { path: 'og', message: 'must match exactly one schema in oneOf' },
    ])

    const png = buildCreateRequest({ ...input, og: image(1200, 630, 290_000, 'image/png') })
    expectValid(png)
  })

  it('surat titipan kotak bareng lolos tanpa gambar OG, dengan nama pengirim dipangkas', () => {
    const body = buildCreateRequest({
      ...input,
      og: null,
      replyTo: 'x7Kp2qLm9A',
      box: { invite: 'Ab3dE6gH9jKm', from: '  Budi  ' },
    })
    expect(body).toMatchObject({
      og: null,
      replyTo: null,
      box: { invite: 'Ab3dE6gH9jKm', from: 'Budi' },
    })
    expectValid(body)
  })

  it('nama pengirim kosong atau kode titip yang salah ditolak skema', () => {
    const body = JSON.parse(
      JSON.stringify(
        buildCreateRequest({ ...input, og: null, box: { invite: 'Ab3dE6gH9jKm', from: 'Budi' } }),
      ),
    )
    body.box = { invite: 'pendek', from: '   ' }
    expect(createRequest(body)).toBe(false)
    expect(contractDetails(createRequest.errors).map((detail) => detail.path)).toEqual(
      expect.arrayContaining(['box.invite', 'box.from']),
    )
  })
})

describe('kontrak kotak bareng', () => {
  const createBox = schemas('CreateBoxRequest')
  const updateBox = schemas('UpdateBoxRequest')

  it('kotak baru dengan jadwal atau dibuka manual lolos skema', () => {
    for (const opensAt of ['2026-10-20T12:00:00.000Z', null]) {
      const valid = createBox({
        title: 'Ultah ke-20 Rani',
        to: 'Rani',
        design: 'par-avion',
        opensAt,
      })
      expect(contractDetails(createBox.errors)).toEqual([])
      expect(valid).toBe(true)
    }
  })

  it('judul lebih dari 40 huruf, field asing, dan ubahan kosong ditolak', () => {
    expect(
      createBox({ title: 'a'.repeat(41), to: 'Rani', design: 'par-avion', opensAt: null }),
    ).toBe(false)
    expect(
      createBox({ title: 'Ultah', to: 'Rani', design: 'par-avion', opensAt: null, warna: 'merah' }),
    ).toBe(false)
    expect(updateBox({})).toBe(false)
    expect(updateBox({ opensAt: null })).toBe(true)
    // 40 code point, bukan 40 unit UTF-16: emoji dihitung satu.
    expect(updateBox({ title: '🎂'.repeat(40) })).toBe(true)
  })
})
