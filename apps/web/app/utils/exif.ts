// Tanggal foto dari EXIF JPEG (PRD Pocket langkah 04: tanggal diambil dari EXIF bila ada).
// Dibaca sebelum preparePhoto() menyimpan ulang foto, karena penyimpanan ulang membuang EXIF.

const DATE_TIME = 0x0132
const EXIF_IFD = 0x8769
const DATE_TIME_ORIGINAL = 0x9003

/** "2026:10:05 14:30:00" jadi ISO, dibaca sebagai waktu lokal kamera. */
export function parseExifDate(value: string): string | null {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as number[]
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day, hour, minute, second)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Cari tanggal di blok TIFF (isi segmen APP1 setelah "Exif\0\0"). */
export function exifDateFromTiff(view: DataView, start: number): string | null {
  if (start + 8 > view.byteLength) return null
  const order = view.getUint16(start)
  const little = order === 0x4949
  if (!little && order !== 0x4d4d) return null
  const u16 = (offset: number) => view.getUint16(start + offset, little)
  const u32 = (offset: number) => view.getUint32(start + offset, little)
  if (u16(2) !== 0x2a) return null

  const ascii = (offset: number, count: number) => {
    let text = ''
    for (let i = 0; i < count - 1 && start + offset + i < view.byteLength; i++) {
      text += String.fromCharCode(view.getUint8(start + offset + i))
    }
    return text
  }

  /** Nilai tag ASCII atau pointer di satu IFD. */
  const readIfd = (offset: number) => {
    const tags = new Map<number, { count: number; value: number }>()
    if (start + offset + 2 > view.byteLength) return tags
    const entries = u16(offset)
    for (let i = 0; i < entries; i++) {
      const entry = offset + 2 + i * 12
      if (start + entry + 12 > view.byteLength) break
      tags.set(u16(entry), { count: u32(entry + 4), value: u32(entry + 8) })
    }
    return tags
  }

  const ifd0 = readIfd(u32(4))
  const exifPointer = ifd0.get(EXIF_IFD)
  const original = exifPointer ? readIfd(exifPointer.value).get(DATE_TIME_ORIGINAL) : undefined
  const tag = original ?? ifd0.get(DATE_TIME)
  return tag ? parseExifDate(ascii(tag.value, tag.count)) : null
}

/** Tanggal pengambilan foto JPEG, atau `null` kalau tidak ada (PNG, HEIC, atau EXIF terhapus). */
export async function readExifDate(file: Blob): Promise<string | null> {
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer())
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null
    let offset = 2
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset)
      const length = view.getUint16(offset + 2)
      if ((marker & 0xff00) !== 0xff00 || length < 2) return null
      const exif =
        marker === 0xffe1 &&
        offset + 10 <= view.byteLength &&
        view.getUint32(offset + 4) === 0x45786966 && // "Exif"
        view.getUint16(offset + 8) === 0
      if (exif) return exifDateFromTiff(view, offset + 10)
      if (marker === 0xffda) return null
      offset += 2 + length
    }
    return null
  } catch {
    return null
  }
}
