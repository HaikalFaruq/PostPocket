import {
  byId,
  defaultLetterDesign,
  kotak,
  letter,
  normalizeContent,
  type LetterContent,
  type LetterDesign,
  type Option,
} from '@postpocket/presets'
import { PHOTO_FRONT } from './letter-draft'

// Surat tersimpan (Kotak surat): surat yang diterima lewat link lalu disimpan penerimanya di
// perangkat ini, supaya tetap bisa dibuka setelah link-nya mati (30 hari) dan fotonya dihapus
// server (7 hari setelah dibuka). Hanya di IndexedDB; fotonya disimpan sebagai momen di
// useMemories, jadi sekalian masuk CD di TV dan ikut cadangan kalau sinkron Pocket menyala.

export const SAVED_KEY = 'postpocket:saved-letters'
/** Folder untuk surat satuan dari link `/l/…`. Kotak bareng punya folder sendiri. */
export const LETTERS_FOLDER = 'surat'

/** Satu surat yang disimpan. */
export interface SavedLetter {
  /** Slug untuk surat dari link, atau id surat di kotak bareng. */
  id: string
  folder: string
  /** Slug link aslinya, kalau ada. */
  slug: string | null
  /** Nama pengirim di kotak bareng. Surat dari link tidak punya nama pengirim. */
  from: string | null
  design: LetterDesign
  content: LetterContent
  /** Momen gambar depan dari foto user, beserta ukurannya untuk rasio kartu. */
  cover: { moment: string; width: number; height: number } | null
  /** Momen per kunci foto isi. Kunci yang tidak ada tampil sebagai placeholder. */
  photos: Record<string, string>
  /** Sebagian foto sudah dihapus server sebelum surat ini disimpan. */
  photosMissing: boolean
  publishedAt: string
  savedAt: string
}

export interface SavedFolder {
  id: string
  title: string
  /** Id `kotak.folders` untuk seni folder kacanya. */
  art: string
  /** Urutan baca surat di folder ini. */
  letters: string[]
  /** Album CD berisi foto surat-surat di folder ini, kalau sudah dibuat. */
  album: string | null
  createdAt: string
}

export interface SavedData {
  version: 1
  letters: Record<string, SavedLetter>
  /** Folder terbaru di depan. */
  folders: SavedFolder[]
}

export function emptySaved(): SavedData {
  return { version: 1, letters: {}, folders: [] }
}

const ID = /^[A-Za-z0-9_-]{1,40}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = Array.from(value.replaceAll('\u0000', '').trim()).slice(0, max).join('')
  return trimmed || null
}

function pick(list: readonly Option[], id: unknown, fallback: string): string {
  return typeof id === 'string' && byId(list, id) ? id : fallback
}

/** Desain dari IndexedDB atau server: id yang sudah tidak ada di preset diganti bawaan. */
export function normalizeDesign(raw: unknown): LetterDesign {
  const design = (raw && typeof raw === 'object' ? raw : {}) as Partial<LetterDesign>
  const base = defaultLetterDesign
  return {
    illustration:
      design.illustration === PHOTO_FRONT
        ? PHOTO_FRONT
        : pick(letter.illustrations, design.illustration, base.illustration),
    shape: pick(letter.shapes, design.shape, base.shape),
    foilMode: pick(letter.foilModes, design.foilMode, base.foilMode),
    foilBorder: typeof design.foilBorder === 'boolean' ? design.foilBorder : false,
    foilColor: pick(letter.foilColors, design.foilColor, base.foilColor),
    paper: pick(letter.papers, design.paper, base.paper),
    template: pick(letter.templates, design.template, base.template),
  }
}

function toLetter(value: unknown): SavedLetter | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !ID.test(item.id)) return null
  if (typeof item.folder !== 'string' || !ID.test(item.folder)) return null
  const cover = item.cover as Record<string, unknown> | null | undefined
  const width = Number(cover?.width)
  const height = Number(cover?.height)
  const photos: Record<string, string> = {}
  if (item.photos && typeof item.photos === 'object') {
    for (const [key, moment] of Object.entries(item.photos)) {
      if (ID.test(key) && typeof moment === 'string' && UUID.test(moment)) photos[key] = moment
    }
  }
  return {
    id: item.id,
    folder: item.folder,
    slug: typeof item.slug === 'string' && ID.test(item.slug) ? item.slug : null,
    from: text(item.from, 40),
    design: normalizeDesign(item.design),
    content: normalizeContent(item.content),
    cover:
      cover &&
      typeof cover.moment === 'string' &&
      UUID.test(cover.moment) &&
      width > 0 &&
      height > 0
        ? { moment: cover.moment, width, height }
        : null,
    photos,
    photosMissing: item.photosMissing === true,
    publishedAt: isIso(item.publishedAt) ? item.publishedAt : new Date(0).toISOString(),
    savedAt: isIso(item.savedAt) ? item.savedAt : new Date(0).toISOString(),
  }
}

/**
 * Pulihkan surat tersimpan dari IndexedDB dengan aman: entri rusak dibuang, surat tanpa folder
 * dibuang, dan folder hanya berisi surat yang ada (folder kosong ikut dibuang).
 */
export function normalizeSaved(raw: unknown): SavedData {
  const data = emptySaved()
  if (!raw || typeof raw !== 'object') return data
  const stored = raw as Record<string, unknown>
  const letters: Record<string, SavedLetter> = {}
  for (const value of Object.values((stored.letters as object | undefined) ?? {})) {
    const item = toLetter(value)
    if (item) letters[item.id] = item
  }
  const seen = new Set<string>()
  for (const value of Array.isArray(stored.folders) ? stored.folders : []) {
    if (!value || typeof value !== 'object') continue
    const item = value as Record<string, unknown>
    if (typeof item.id !== 'string' || !ID.test(item.id) || seen.has(item.id)) continue
    const order = Array.isArray(item.letters)
      ? [...new Set(item.letters)].filter(
          (id): id is string => typeof id === 'string' && letters[id]?.folder === item.id,
        )
      : []
    if (!order.length) continue
    seen.add(item.id)
    data.folders.push({
      id: item.id,
      title: text(item.title, 40) ?? 'Surat',
      art: pick(kotak.folders, item.art, kotak.folders[0]!.id),
      letters: order,
      album: typeof item.album === 'string' && UUID.test(item.album) ? item.album : null,
      createdAt: isIso(item.createdAt) ? item.createdAt : new Date(0).toISOString(),
    })
  }
  const placed = new Set(data.folders.flatMap((folder) => folder.letters))
  data.letters = Object.fromEntries(Object.entries(letters).filter(([id]) => placed.has(id)))
  return data
}

/**
 * Data dengan surat `item` di folder `folder`: dibuat kalau belum ada (paling depan), dan surat
 * yang sudah ada diganti di tempatnya. Surat baru masuk paling belakang, sesuai urutan baca.
 */
export function withLetter(
  data: SavedData,
  item: SavedLetter,
  folder: Pick<SavedFolder, 'id' | 'title' | 'art'>,
  now = new Date(),
): SavedData {
  const existing = data.folders.find((entry) => entry.id === folder.id)
  const next: SavedFolder = existing
    ? {
        ...existing,
        letters: existing.letters.includes(item.id)
          ? existing.letters
          : [...existing.letters, item.id],
      }
    : {
        id: folder.id,
        title: folder.title,
        art: folder.art,
        letters: [item.id],
        album: null,
        createdAt: now.toISOString(),
      }
  return {
    ...data,
    letters: { ...data.letters, [item.id]: { ...item, folder: folder.id } },
    folders: existing
      ? data.folders.map((entry) => (entry.id === folder.id ? next : entry))
      : [next, ...data.folders],
  }
}

/** Data tanpa surat `id`. Folder yang jadi kosong ikut dibuang. */
export function withoutLetter(data: SavedData, id: string): SavedData {
  return {
    ...data,
    letters: Object.fromEntries(Object.entries(data.letters).filter(([key]) => key !== id)),
    folders: data.folders
      .map((folder) => ({ ...folder, letters: folder.letters.filter((other) => other !== id) }))
      .filter((folder) => folder.letters.length),
  }
}

/** Data tanpa folder `id` beserta semua suratnya. */
export function withoutFolder(data: SavedData, id: string): SavedData {
  const gone = new Set(data.folders.find((folder) => folder.id === id)?.letters ?? [])
  return {
    ...data,
    letters: Object.fromEntries(Object.entries(data.letters).filter(([key]) => !gone.has(key))),
    folders: data.folders.filter((folder) => folder.id !== id),
  }
}

/** Data dengan album CD `album` dicatat di folder `id`. */
export function withFolderAlbum(data: SavedData, id: string, album: string | null): SavedData {
  return {
    ...data,
    folders: data.folders.map((folder) => (folder.id === id ? { ...folder, album } : folder)),
  }
}

/** Momen yang dipakai surat-surat ini, urut seperti di surat: gambar depan dulu, lalu isinya. */
export function letterMoments(items: readonly SavedLetter[]): string[] {
  return items.flatMap((item) => [
    ...(item.cover ? [item.cover.moment] : []),
    ...Object.values(item.photos),
  ])
}
