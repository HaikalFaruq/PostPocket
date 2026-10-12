import { letter, pocket } from '@postpocket/presets'
import { describe, expect, it } from 'vitest'
import {
  albumShelf,
  dayAlbum,
  dayKey,
  monthAlbums,
  monthTitle,
  normalizeMemories,
  parseDay,
  withoutMoments,
  type MemoryData,
  type Moment,
} from '../app/utils/memories'

const moment = (id: string, day: string, takenAt: string): Moment => ({
  id,
  day,
  takenAt,
  source: 'upload',
  width: 400,
  height: 300,
})

describe('tanggal', () => {
  it('dayKey memakai tanggal lokal dan bolak-balik dengan parseDay', () => {
    expect(dayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05')
    expect(dayKey(parseDay('2026-01-31'))).toBe('2026-01-31')
  })

  it('judul bulan dalam bahasa Indonesia', () => {
    expect(monthTitle('2026-10')).toBe('Oktober 2026')
    expect(monthTitle('2027-01')).toBe('Januari 2027')
  })
})

describe('monthAlbums', () => {
  it('mengelompokkan per bulan, bulan terbaru dulu, foto urut waktu diambil', () => {
    const albums = monthAlbums({
      a: moment('a', '2026-09-30', '2026-09-30T10:00:00.000Z'),
      b: moment('b', '2026-10-02', '2026-10-02T09:00:00.000Z'),
      c: moment('c', '2026-10-01', '2026-10-01T20:00:00.000Z'),
    })
    expect(albums.map((album) => [album.id, album.title, album.moments])).toEqual([
      ['bulan-2026-10', 'Oktober 2026', ['c', 'b']],
      ['bulan-2026-09', 'September 2026', ['a']],
    ])
    expect(albums.every((album) => album.kind === 'month')).toBe(true)
  })
})

describe('normalizeMemories', () => {
  it('data rusak jadi kosong', () => {
    expect(normalizeMemories('rusak')).toEqual({ version: 1, moments: {}, days: {}, albums: [] })
  })

  it('membuang entri rusak, id preset lama, dan momen yang sudah tidak ada', () => {
    const data = normalizeMemories({
      moments: {
        a: moment('a', '2026-10-01', '2026-10-01T08:00:00.000Z'),
        rusak: { id: 'rusak', day: 'kemarin', width: 1, height: 1 },
        kosong: { id: 'kosong', day: '2026-10-01', width: 0, height: 10 },
      },
      days: {
        '2026-10-01': {
          day: '2026-10-01',
          packet: 'warna-lama',
          sticker: 'heart',
          frame: 'stamp',
          frameColor: '#123abc',
          moments: ['a', 'hilang'],
          savedAt: '2026-10-01T09:00:00.000Z',
        },
        salah: { day: 'bukan-tanggal' },
      },
      albums: [
        { id: 'x', title: '  ', emoji: '', color: 'merah', moments: ['a', 'hilang'] },
        { id: 'tanpa id?', title: 'Rusak' },
      ],
    })
    expect(Object.keys(data.moments)).toEqual(['a'])
    expect(data.days['2026-10-01']).toMatchObject({
      packet: pocket.packetColors[0]!.id,
      sticker: 'heart',
      frame: 'stamp',
      frameColor: '#123abc',
      moments: ['a'],
    })
    expect(Object.keys(data.days)).toEqual(['2026-10-01'])
    expect(data.albums).toHaveLength(1)
    expect(data.albums[0]).toMatchObject({ title: 'Album', emoji: '📀', moments: ['a'] })
  })

  it('stiker kantong yang tidak dikenal diganti bawaan', () => {
    const data = normalizeMemories({
      days: { '2026-10-02': { day: '2026-10-02', sticker: 'stiker-lama', moments: [] } },
    })
    expect(data.days['2026-10-02']?.sticker).toBe(letter.stickers[0]!.id)
  })
})

describe('albumShelf', () => {
  it('album bulanan dulu, lalu album buatan user', () => {
    const data = normalizeMemories({
      moments: { a: moment('a', '2026-10-01', '2026-10-01T08:00:00.000Z') },
      albums: [{ id: 'liburan', title: 'Liburan', emoji: '🌊', color: '#7fb3f5', moments: ['a'] }],
    })
    expect(albumShelf(data).map((album) => [album.id, album.kind])).toEqual([
      ['bulan-2026-10', 'month'],
      ['liburan', 'custom'],
    ])
  })
})

describe('dayAlbum', () => {
  it('isi satu kantong jadi CD sementara berwarna kantongnya', () => {
    const packet = pocket.packetColors[1]!
    const album = dayAlbum({
      day: '2026-10-05',
      packet: packet.id,
      sticker: letter.stickers[0]!.id,
      frame: pocket.frames[0]!.id,
      frameColor: pocket.frameColors[0]!.id,
      moments: ['b', 'a'],
      savedAt: '2026-10-05T10:00:00.000Z',
    })
    expect(album).toMatchObject({
      id: 'hari-2026-10-05',
      title: '5 Oktober 2026',
      color: packet.color,
      moments: ['b', 'a'],
      kind: 'day',
    })
  })
})

describe('withoutMoments', () => {
  const data: MemoryData = {
    version: 1,
    moments: {
      a: moment('a', '2026-10-01', '2026-10-01T10:00:00.000Z'),
      b: moment('b', '2026-10-01', '2026-10-01T11:00:00.000Z'),
      c: moment('c', '2026-10-02', '2026-10-02T09:00:00.000Z'),
    },
    days: {
      '2026-10-01': {
        day: '2026-10-01',
        packet: 'blue',
        sticker: 'heart',
        frame: 'polaroid',
        frameColor: 'cream',
        moments: ['a', 'b'],
        savedAt: '2026-10-01T12:00:00.000Z',
      },
      '2026-10-02': {
        day: '2026-10-02',
        packet: 'pink',
        sticker: 'heart',
        frame: 'stamp',
        frameColor: 'cream',
        moments: ['c'],
        savedAt: '2026-10-02T12:00:00.000Z',
      },
    },
    albums: [
      {
        id: 'x',
        title: 'Liburan',
        emoji: '📀',
        color: '#ff8fa3',
        moments: ['b', 'c'],
        createdAt: '2026-10-02T12:00:00.000Z',
      },
    ],
  }

  it('foto yang dikeluarkan hilang dari kantong dan dari CD buatan sendiri', () => {
    const next = withoutMoments(data, ['b'])
    expect(Object.keys(next.moments)).toEqual(['a', 'c'])
    expect(next.days['2026-10-01']!.moments).toEqual(['a'])
    expect(next.albums[0]!.moments).toEqual(['c'])
    // Data asli tidak diubah.
    expect(data.days['2026-10-01']!.moments).toEqual(['a', 'b'])
  })

  it('menghapus kantong sekalian semua fotonya, kantong lain tetap', () => {
    const next = withoutMoments(data, ['a', 'b'], '2026-10-01')
    expect(Object.keys(next.days)).toEqual(['2026-10-02'])
    expect(Object.keys(next.moments)).toEqual(['c'])
    expect(next.albums[0]!.moments).toEqual(['c'])
  })
})
