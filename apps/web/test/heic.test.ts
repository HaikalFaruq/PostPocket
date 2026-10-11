import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readExifDate } from '../app/utils/exif'
import { isHeic, isHeifBytes } from '../app/utils/heic'

// Foto HEIC asli kecil, dibuat dengan `sips -s format heic` di macOS.
const heic = new Uint8Array(readFileSync(new URL('../e2e/fixtures/foto.heic', import.meta.url)))

/** Kotak ftyp dengan brand utama dan daftar brand kompatibel. */
function ftyp(major: string, ...compatible: string[]): Uint8Array {
  const text = `ftyp${major}\0\0\0\0${compatible.join('')}`
  const bytes = new Uint8Array(4 + text.length)
  new DataView(bytes.buffer).setUint32(0, bytes.length)
  bytes.set(
    [...text].map((char) => char.charCodeAt(0)),
    4,
  )
  return bytes
}

describe('HEIC', () => {
  it('mengenali HEIC dari isinya, termasuk brand umum mif1 dengan brand HEVC', () => {
    expect(isHeifBytes(heic)).toBe(true)
    expect(isHeifBytes(ftyp('mif1', 'mif1', 'heic'))).toBe(true)
  })

  it('AVIF, JPEG, dan berkas pendek bukan HEIC', () => {
    expect(isHeifBytes(ftyp('avif', 'mif1', 'miaf'))).toBe(false)
    expect(isHeifBytes(ftyp('mif1', 'mif1', 'avif'))).toBe(false)
    expect(isHeifBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe(false)
  })

  it('melihat tipe, nama, lalu isi berkas', async () => {
    expect(await isHeic(new Blob([], { type: 'image/heif' }))).toBe(true)
    expect(await isHeic(new File([], 'IMG_0001.HEIC'))).toBe(true)
    // Di Windows tipe HEIC sering kosong; isinya tetap dikenali.
    expect(await isHeic(new File([heic], 'foto'))).toBe(true)
    expect(
      await isHeic(new File([new Uint8Array([0xff, 0xd8])], 'a.jpg', { type: 'image/jpeg' })),
    ).toBe(false)
  })
})

describe('tanggal EXIF dari HEIC', () => {
  it('dibaca dari item Exif berkas HEIC', async () => {
    // Dibuat dengan `sips -s format heic` dari JPEG ber-EXIF DateTimeOriginal 2026:10:05 14:30:00.
    const dated = readFileSync(new URL('../e2e/fixtures/foto-tanggal.heic', import.meta.url))
    const local = new Date(2026, 9, 5, 14, 30, 0).toISOString()
    expect(await readExifDate(new Blob([new Uint8Array(dated)]))).toBe(local)
  })

  it('HEIC tanpa EXIF atau yang terpotong tidak membuat error', async () => {
    expect(await readExifDate(new Blob([heic]))).toBeNull()
    expect(await readExifDate(new Blob([heic.slice(0, 40)]))).toBeNull()
  })
})
