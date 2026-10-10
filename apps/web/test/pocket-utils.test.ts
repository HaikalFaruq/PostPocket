import { describe, expect, it } from 'vitest'
import { isPocketDay, longDate, monthGrid, shiftMonth } from '../app/utils/calendar'
import { parseExifDate, readExifDate } from '../app/utils/exif'

/** JPEG kecil dengan segmen EXIF berisi tanggal, di IFD Exif (asli) atau di IFD0. */
function jpeg(date: string, options: { little?: boolean; original?: boolean } = {}): Blob {
  const { little = true, original = true } = options
  const dateOffset = original ? 44 : 26
  const tiff = new DataView(new ArrayBuffer(dateOffset + 20))
  tiff.setUint16(0, little ? 0x4949 : 0x4d4d)
  tiff.setUint16(2, 0x2a, little)
  tiff.setUint32(4, 8, little)
  // IFD0: satu entri, lalu pointer IFD berikutnya 0.
  tiff.setUint16(8, 1, little)
  tiff.setUint16(10, original ? 0x8769 : 0x0132, little)
  tiff.setUint16(12, original ? 4 : 2, little)
  tiff.setUint32(14, original ? 1 : 20, little)
  tiff.setUint32(18, original ? 26 : dateOffset, little)
  if (original) {
    tiff.setUint16(26, 1, little)
    tiff.setUint16(28, 0x9003, little)
    tiff.setUint16(30, 2, little)
    tiff.setUint32(32, 20, little)
    tiff.setUint32(36, dateOffset, little)
  }
  for (let i = 0; i < date.length; i++) tiff.setUint8(dateOffset + i, date.charCodeAt(i))
  const header = new DataView(new ArrayBuffer(12))
  header.setUint16(0, 0xffd8)
  header.setUint16(2, 0xffe1)
  header.setUint16(4, 2 + 6 + tiff.byteLength)
  header.setUint32(6, 0x45786966)
  header.setUint16(10, 0)
  return new Blob([header.buffer, tiff.buffer, new Uint8Array([0xff, 0xda, 0, 2])], {
    type: 'image/jpeg',
  })
}

describe('EXIF', () => {
  it('membaca DateTimeOriginal, little maupun big endian', async () => {
    const local = new Date(2026, 9, 5, 14, 30, 0).toISOString()
    expect(await readExifDate(jpeg('2026:10:05 14:30:00'))).toBe(local)
    expect(await readExifDate(jpeg('2026:10:05 14:30:00', { little: false }))).toBe(local)
  })

  it('memakai DateTime di IFD0 kalau tanggal asli tidak ada', async () => {
    expect(await readExifDate(jpeg('2025:01:02 03:04:05', { original: false }))).toBe(
      new Date(2025, 0, 2, 3, 4, 5).toISOString(),
    )
  })

  it('tanpa EXIF atau bukan JPEG hasilnya null', async () => {
    expect(
      await readExifDate(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2])])),
    ).toBeNull()
    expect(await readExifDate(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]))).toBeNull()
    expect(parseExifDate('0000:00:00 00:00:00')).toBeNull()
    expect(parseExifDate('bukan tanggal')).toBeNull()
  })
})

describe('kalender', () => {
  it('grid Senin sampai Minggu dengan jumlah minggu secukupnya', () => {
    // Oktober 2026 dimulai hari Kamis.
    const october = monthGrid(2026, 10)
    expect(october).toHaveLength(35)
    expect(october[0]).toEqual({ day: '2026-09-28', date: 28, inMonth: false })
    expect(october[3]).toEqual({ day: '2026-10-01', date: 1, inMonth: true })
    expect(october.filter((cell) => cell.inMonth)).toHaveLength(31)
    // Februari 2027 dimulai hari Senin dan pas 4 minggu.
    expect(monthGrid(2027, 2)).toHaveLength(28)
  })

  it('pindah bulan menyeberang tahun', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
  })

  it('tanggal lengkap bahasa Indonesia', () => {
    expect(longDate('2026-10-10')).toBe('Sabtu, 10 Oktober 2026')
  })

  it('hanya tanggal nyata yang sudah lewat atau hari ini yang bisa diisi', () => {
    expect(isPocketDay('2026-10-10', '2026-10-10')).toBe(true)
    expect(isPocketDay('2024-02-29', '2026-10-10')).toBe(true)
    expect(isPocketDay('2026-10-11', '2026-10-10')).toBe(false)
    expect(isPocketDay('2025-02-29', '2026-10-10')).toBe(false)
    expect(isPocketDay('2026-13-01', '2026-10-10')).toBe(false)
    expect(isPocketDay('kemarin', '2026-10-10')).toBe(false)
  })
})
