import { defaultLetterDesign, kotak, normalizeContent } from '@postpocket/presets'
import { describe, expect, it } from 'vitest'
import {
  LETTERS_FOLDER,
  emptySaved,
  letterMoments,
  normalizeDesign,
  normalizeSaved,
  withFolderAlbum,
  withLetter,
  withoutFolder,
  withoutLetter,
  type SavedLetter,
} from '../app/utils/saved-letters'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const content = normalizeContent({
  elements: [
    { kind: 'photo', id: 'a', x: 0.5, y: 0.3, width: 0.5, rotation: 0, photo: 'f1', aspect: 1 },
    { kind: 'text', id: 't', x: 0.5, y: 0.8, width: 0.8, rotation: 0, text: 'Halo', size: 0.06 },
  ],
})

const saved = (id: string, extra: Partial<SavedLetter> = {}): SavedLetter => ({
  id,
  folder: LETTERS_FOLDER,
  slug: id,
  from: null,
  design: { ...defaultLetterDesign },
  content,
  cover: null,
  photos: { f1: uuid(1) },
  photosMissing: false,
  publishedAt: '2026-10-14T03:00:00.000Z',
  savedAt: '2026-10-14T04:00:00.000Z',
  ...extra,
})

const folder = { id: LETTERS_FOLDER, title: 'Surat untukmu', art: 'par-avion' }

describe('normalizeDesign', () => {
  it('mengganti id preset yang tidak ada dengan bawaan, dan foto user tetap foto user', () => {
    expect(normalizeDesign({ illustration: 'hilang', paper: 'emas', foilBorder: 'ya' })).toEqual({
      ...defaultLetterDesign,
      foilBorder: false,
    })
    expect(normalizeDesign({ ...defaultLetterDesign, illustration: 'upload' }).illustration).toBe(
      'upload',
    )
    expect(normalizeDesign(null)).toEqual(defaultLetterDesign)
  })
})

describe('normalizeSaved', () => {
  it('memulihkan data yang utuh apa adanya', () => {
    const data = withLetter(emptySaved(), saved('x7Kp2qLm9A'), folder, new Date(0))
    expect(normalizeSaved(JSON.parse(JSON.stringify(data)))).toEqual(data)
  })

  it('membuang entri rusak, surat tanpa folder, dan folder kosong', () => {
    const good = saved('x7Kp2qLm9A')
    const data = normalizeSaved({
      letters: {
        good,
        lost: saved('AAAAAAAAAA'),
        broken: { id: 'bad id!', folder: LETTERS_FOLDER },
        elsewhere: saved('BBBBBBBBBB', { folder: 'lain' }),
      },
      folders: [
        {
          id: LETTERS_FOLDER,
          title: 'Surat untukmu',
          art: 'par-avion',
          letters: [good.id, 'BBBBBBBBBB', good.id],
        },
        { id: 'kosong', title: 'Kosong', art: 'par-avion', letters: ['tidak-ada'] },
        'rusak',
      ],
    })
    expect(Object.keys(data.letters)).toEqual([good.id])
    expect(data.folders.map((item) => [item.id, item.letters])).toEqual([
      [LETTERS_FOLDER, [good.id]],
    ])
  })

  it('memperbaiki judul, seni folder, nama pengirim, dan momen yang tidak valid', () => {
    const data = normalizeSaved({
      letters: {
        a: saved('a1', {
          folder: 'kotak1',
          from: `  ${'B'.repeat(60)}\u0000  `,
          photos: { f1: 'bukan-uuid', f2: uuid(2) },
          cover: { moment: uuid(3), width: 0, height: 10 },
        }),
      },
      folders: [{ id: 'kotak1', title: '   ', art: 'pelangi', letters: ['a1'], album: 'x' }],
    })
    const [entry] = data.folders
    expect(entry).toMatchObject({ title: 'Surat', art: kotak.folders[0]!.id, album: null })
    expect(data.letters.a1!.from).toBe('B'.repeat(40))
    expect(data.letters.a1!.photos).toEqual({ f2: uuid(2) })
    expect(data.letters.a1!.cover).toBeNull()
  })

  it('data kosong atau bukan objek jadi data kosong', () => {
    expect(normalizeSaved(undefined)).toEqual(emptySaved())
    expect(normalizeSaved('rusak')).toEqual(emptySaved())
  })
})

describe('perubahan data', () => {
  it('folder baru masuk paling depan, surat baru paling belakang di foldernya', () => {
    let data = withLetter(emptySaved(), saved('a1'), folder)
    data = withLetter(data, saved('a2', { folder: 'kotak1' }), {
      id: 'kotak1',
      title: 'Ultah Rani',
      art: 'emas',
    })
    data = withLetter(data, saved('a3'), folder)
    expect(data.folders.map((item) => item.id)).toEqual(['kotak1', LETTERS_FOLDER])
    expect(data.folders[1]!.letters).toEqual(['a1', 'a3'])
    expect(data.letters.a2!.folder).toBe('kotak1')
  })

  it('surat yang disimpan ulang diganti di tempatnya, tidak jadi ganda', () => {
    let data = withLetter(emptySaved(), saved('a1'), folder)
    data = withLetter(data, saved('a2'), folder)
    data = withLetter(data, saved('a1', { from: 'Budi' }), folder)
    expect(data.folders[0]!.letters).toEqual(['a1', 'a2'])
    expect(data.letters.a1!.from).toBe('Budi')
  })

  it('menghapus surat terakhir ikut membuang foldernya', () => {
    let data = withLetter(emptySaved(), saved('a1'), folder)
    data = withLetter(data, saved('a2'), folder)
    data = withoutLetter(data, 'a1')
    expect(data.folders[0]!.letters).toEqual(['a2'])
    expect(data.letters.a1).toBeUndefined()
    expect(withoutLetter(data, 'a2')).toEqual({ ...emptySaved(), letters: {} })
  })

  it('menghapus folder ikut membuang semua suratnya saja', () => {
    let data = withLetter(emptySaved(), saved('a1'), folder)
    data = withLetter(data, saved('b1', { folder: 'kotak1' }), {
      id: 'kotak1',
      title: 'Ultah Rani',
      art: 'emas',
    })
    data = withoutFolder(data, 'kotak1')
    expect(Object.keys(data.letters)).toEqual(['a1'])
    expect(data.folders.map((item) => item.id)).toEqual([LETTERS_FOLDER])
  })

  it('album CD dicatat di foldernya', () => {
    const data = withFolderAlbum(
      withLetter(emptySaved(), saved('a1'), folder),
      LETTERS_FOLDER,
      uuid(9),
    )
    expect(data.folders[0]!.album).toBe(uuid(9))
  })

  it('momen surat urut gambar depan dulu, lalu isinya', () => {
    expect(
      letterMoments([
        saved('a1', { cover: { moment: uuid(5), width: 3, height: 4 } }),
        saved('a2', { photos: { f1: uuid(6), f2: uuid(7) } }),
      ]),
    ).toEqual([uuid(5), uuid(1), uuid(6), uuid(7)])
  })
})
