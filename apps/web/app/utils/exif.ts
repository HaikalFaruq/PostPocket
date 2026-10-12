// Tanggal foto dari EXIF JPEG atau HEIC (PRD Pocket langkah 04: tanggal diambil dari EXIF bila
// ada). Dibaca sebelum preparePhoto() menyimpan ulang foto, karena penyimpanan ulang membuang EXIF.

import { isHeifBytes } from './heic'

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

/** Tanggal pengambilan foto JPEG atau HEIC, atau `null` kalau tidak ada (PNG, EXIF terhapus). */
export async function readExifDate(file: Blob): Promise<string | null> {
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer())
    if (isHeifBytes(new Uint8Array(view.buffer, 0, Math.min(view.byteLength, 64)))) {
      return await heifExifDate(file, view)
    }
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

interface Box {
  type: string
  /** Awal isi kotak, setelah header. */
  start: number
  end: number
}

/** Kotak ISO BMFF (format HEIF) berurutan di `view`, dari `offset` sampai `end`. */
function boxes(view: DataView, offset: number, end: number): Box[] {
  const list: Box[] = []
  const limit = Math.min(end, view.byteLength)
  while (offset + 8 <= limit) {
    let size = view.getUint32(offset)
    let header = 8
    if (size === 1) {
      if (offset + 16 > limit) break
      size = Number(view.getBigUint64(offset + 8))
      header = 16
    } else if (size === 0) {
      size = limit - offset
    }
    if (size < header) break
    list.push({ type: fourcc(view, offset + 4), start: offset + header, end: offset + size })
    offset += size
  }
  return list
}

function fourcc(view: DataView, offset: number): string {
  let text = ''
  for (let i = 0; i < 4; i++) text += String.fromCharCode(view.getUint8(offset + i))
  return text
}

/** Angka tak bertanda selebar `size` byte (0, 4, atau 8), big-endian. */
function uint(view: DataView, offset: number, size: number): number {
  if (size === 4) return view.getUint32(offset)
  if (size === 8) return Number(view.getBigUint64(offset))
  return 0
}

/** Id item bertipe "Exif" di kotak `iinf`. */
function exifItemId(view: DataView, iinf: Box): number | null {
  const version = view.getUint8(iinf.start)
  const first = iinf.start + 4 + (version === 0 ? 2 : 4)
  for (const infe of boxes(view, first, iinf.end)) {
    if (infe.type !== 'infe') continue
    const infeVersion = view.getUint8(infe.start)
    if (infeVersion < 2) continue
    const id = infeVersion === 2 ? view.getUint16(infe.start + 4) : view.getUint32(infe.start + 4)
    const typeAt = infe.start + 4 + (infeVersion === 2 ? 2 : 4) + 2
    if (fourcc(view, typeAt) === 'Exif') return id
  }
  return null
}

/** Letak data item `id` menurut kotak `iloc`: cara penyimpanan, offset, dan panjangnya. */
function itemPlace(view: DataView, iloc: Box, id: number) {
  const version = view.getUint8(iloc.start)
  let at = iloc.start + 4
  const sizes = view.getUint16(at)
  const offsetSize = sizes >> 12
  const lengthSize = (sizes >> 8) & 0xf
  const baseSize = (sizes >> 4) & 0xf
  const indexSize = version > 0 ? sizes & 0xf : 0
  at += 2
  const count = version < 2 ? view.getUint16(at) : view.getUint32(at)
  at += version < 2 ? 2 : 4
  for (let i = 0; i < count && at < iloc.end; i++) {
    const itemId = version < 2 ? view.getUint16(at) : view.getUint32(at)
    at += version < 2 ? 2 : 4
    const method = version > 0 ? view.getUint16(at) & 0xf : 0
    if (version > 0) at += 2
    at += 2 // data_reference_index
    const base = uint(view, at, baseSize)
    at += baseSize
    const extents = view.getUint16(at)
    at += 2
    let first: { offset: number; length: number } | null = null
    for (let e = 0; e < extents; e++) {
      at += indexSize
      const offset = uint(view, at, offsetSize)
      const length = uint(view, at + offsetSize, lengthSize)
      at += offsetSize + lengthSize
      first ??= { offset: base + offset, length }
    }
    if (itemId === id && first) return { method, ...first }
  }
  return null
}

/**
 * Tanggal dari item "Exif" berkas HEIF. Kotak `meta` ada di awal berkas (`head`); data Exif-nya
 * bisa di mana saja, jadi diambil terpisah sesuai letaknya di `iloc`.
 */
async function heifExifDate(file: Blob, head: DataView): Promise<string | null> {
  const meta = boxes(head, 0, head.byteLength).find((box) => box.type === 'meta')
  if (!meta) return null
  const children = boxes(head, meta.start + 4, meta.end)
  const iinf = children.find((box) => box.type === 'iinf')
  const iloc = children.find((box) => box.type === 'iloc')
  const id = iinf ? exifItemId(head, iinf) : null
  const place = iloc && id !== null ? itemPlace(head, iloc, id) : null
  if (!place || place.method > 1) return null
  // Cara 1: data ada di kotak `idat` milik `meta`; cara 0: offset dari awal berkas.
  const idat = children.find((box) => box.type === 'idat')
  if (place.method === 1 && !idat) return null
  const start = (place.method === 1 ? idat!.start : 0) + place.offset
  const length = Math.min(place.length || 64 * 1024, 64 * 1024)
  const data = new DataView(await file.slice(start, start + length).arrayBuffer())
  // Isi item Exif: 4 byte offset ke header TIFF, lalu (biasanya) "Exif\0\0" dan blok TIFF.
  if (data.byteLength < 8) return null
  return exifDateFromTiff(data, 4 + data.getUint32(0))
}

/**
 * Waktu foto untuk kenangan: tanggal EXIF kalau ada, kalau tidak waktu berkasnya terakhir diubah
 * (tangkapan layar dan foto dari WhatsApp tidak punya EXIF), jadi bukan waktu fotonya dipilih.
 */
export async function photoTime(file: File): Promise<string | undefined> {
  const exif = await readExifDate(file)
  if (exif) return exif
  return file.lastModified ? new Date(file.lastModified).toISOString() : undefined
}
