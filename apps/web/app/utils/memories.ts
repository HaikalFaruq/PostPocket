import { byId, letter, pocket } from '@postpocket/presets'

// Data Pocket, TV, dan Booth. Rilis 1 hanya di browser (IndexedDB); bentuknya mengikuti tabel
// fase 2 di PRD (moments, pockets, albums) supaya nanti bisa disinkronkan ke server.

/** Satu foto kenangan, dari upload atau Booth. Gambarnya disimpan terpisah per id. */
export interface Moment {
  /** UUID, dibuat di browser supaya unik di semua perangkat saat disinkronkan (fase 2). */
  id: string
  /** Hari kantongnya, tanggal lokal `YYYY-MM-DD`. */
  day: string
  /** Waktu foto diambil (EXIF kalau ada), ISO. */
  takenAt: string
  source: 'upload' | 'booth'
  width: number
  height: number
  /**
   * Kunci foto di IndexedDB kalau beda dengan `id`: id lama momen yang dibuat sebelum UUID.
   * Fotonya tidak dipindah supaya penggantian id cukup satu tulisan. Hanya di perangkat ini.
   */
  photoKey?: string
}

/** Satu hari di Pocket: desain kantong dan momen di dalamnya. */
export interface PocketDay {
  day: string
  /** Id `pocket.packetColors`. */
  packet: string
  /** Id `letter.stickers`. */
  sticker: string
  /** Id `pocket.frames`. */
  frame: string
  /** Id `pocket.frameColors`, atau warna custom `#rrggbb`. */
  frameColor: string
  moments: string[]
  savedAt: string
}

/** Album CD buatan user. Album per bulan dibuat otomatis dari momen dan tidak disimpan. */
export interface Album {
  id: string
  title: string
  emoji: string
  /** Warna punggung CD. */
  color: string
  moments: string[]
  createdAt: string
}

export interface AlbumView {
  id: string
  title: string
  emoji: string
  color: string
  moments: string[]
  /** `day` adalah isi satu kantong Pocket yang sedang diputar (`/tv?hari=`), tidak disimpan. */
  kind: 'month' | 'custom' | 'day'
}

export interface MemoryData {
  version: 1
  moments: Record<string, Moment>
  days: Record<string, PocketDay>
  albums: Album[]
  /** Perubahan yang belum terkirim ke cadangan (fase 2). Hanya di perangkat ini. */
  pending?: PendingChanges
}

/** Jenis baris yang disinkronkan: id momen, tanggal kantong, dan id album CD. */
export type PendingKind = 'moments' | 'days' | 'albums'

/**
 * Baris yang berubah sejak sinkron terakhir, dengan nomor urut perubahannya. Baris yang tercatat
 * di sini tapi sudah tidak ada di data berarti dihapus. Nomor urut menjaga perubahan yang terjadi
 * selama sinkron berjalan supaya tidak ikut dianggap terkirim.
 */
export interface PendingChanges {
  seq: number
  moments: Record<string, number>
  days: Record<string, number>
  albums: Record<string, number>
}

/** Tandai baris-baris ini berubah atau dihapus, dalam data yang sama dengan perubahannya. */
export function withPending(
  data: MemoryData,
  changes: Partial<Record<PendingKind, string[]>>,
): MemoryData {
  const pending = data.pending ?? { seq: 0, moments: {}, days: {}, albums: {} }
  const seq = pending.seq + 1
  const next: PendingChanges = {
    seq,
    moments: { ...pending.moments },
    days: { ...pending.days },
    albums: { ...pending.albums },
  }
  for (const kind of ['moments', 'days', 'albums'] as const) {
    for (const key of changes[kind] ?? []) next[kind][key] = seq
  }
  return { ...data, pending: next }
}

/**
 * Data tanpa catatan perubahan yang sudah terkirim: hanya entri yang nomor urutnya masih sama
 * dengan `sent`. Baris yang berubah lagi selama sinkron tetap tercatat.
 */
export function withoutSent(
  data: MemoryData,
  sent: Partial<Record<PendingKind, Record<string, number>>>,
): MemoryData {
  if (!data.pending) return data
  const pending = data.pending
  const keep = (kind: PendingKind) =>
    Object.fromEntries(
      Object.entries(pending[kind]).filter(([key, seq]) => sent[kind]?.[key] !== seq),
    )
  return {
    ...data,
    pending: { ...pending, moments: keep('moments'), days: keep('days'), albums: keep('albums') },
  }
}

/**
 * Data tanpa momen-momen ini: dikeluarkan dari kantong dan album CD juga. `dropDay` sekalian
 * menghapus kantong hari itu.
 */
export function withoutMoments(data: MemoryData, ids: string[], dropDay?: string): MemoryData {
  const gone = new Set(ids)
  const keep = (list: string[]) => list.filter((id) => !gone.has(id))
  return {
    ...data,
    moments: Object.fromEntries(Object.entries(data.moments).filter(([id]) => !gone.has(id))),
    days: Object.fromEntries(
      Object.entries(data.days)
        .filter(([key]) => key !== dropDay)
        .map(([key, day]) => [key, { ...day, moments: keep(day.moments) }]),
    ),
    albums: data.albums.map((album) => ({ ...album, moments: keep(album.moments) })),
  }
}

export function emptyMemories(): MemoryData {
  return { version: 1, moments: {}, days: {}, albums: [] }
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Tanggal lokal `YYYY-MM-DD`. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Tengah malam lokal untuk `YYYY-MM-DD`. */
export function parseDay(day: string): Date {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const ID = /^[A-Za-z0-9_-]{1,40}$/
const HEX = /^#[0-9a-f]{6}$/i

/** Nama bulan bahasa Indonesia, misalnya "Oktober 2026". */
export function monthTitle(month: string): string {
  const [year = 1970, index = 1] = month.split('-').map(Number)
  return new Date(year, index - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })
}

/** Emoji punggung CD album bulanan, satu per bulan Januari sampai Desember. */
const MONTH_EMOJI = ['❄️', '💌', '🌸', '🌧️', '🌼', '☀️', '🍉', '🎐', '🍂', '🎃', '🍁', '🎄']

/** Warna punggung CD, diambil dari warna kantong Pocket. */
export const SPINE_COLORS = pocket.packetColors.map((item) => item.color)

/** Album otomatis per bulan, bulan terbaru dulu. Foto di dalamnya urut waktu diambil. */
export function monthAlbums(moments: Record<string, Moment>): AlbumView[] {
  const byMonth = new Map<string, Moment[]>()
  for (const moment of Object.values(moments)) {
    const month = moment.day.slice(0, 7)
    byMonth.set(month, [...(byMonth.get(month) ?? []), moment])
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, list]) => {
      const index = Number(month.slice(5, 7)) - 1
      return {
        id: `bulan-${month}`,
        title: monthTitle(month),
        emoji: MONTH_EMOJI[index] ?? '📀',
        color: SPINE_COLORS[index % SPINE_COLORS.length] ?? '#7fb3f5',
        moments: list.sort((a, b) => a.takenAt.localeCompare(b.takenAt)).map((item) => item.id),
        kind: 'month' as const,
      }
    })
}

function isIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function toMoment(value: unknown): Moment | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const width = Number(item.width)
  const height = Number(item.height)
  if (typeof item.id !== 'string' || !ID.test(item.id)) return null
  if (typeof item.day !== 'string' || !DAY.test(item.day)) return null
  if (!(width > 0 && height > 0)) return null
  return {
    id: item.id,
    day: item.day,
    takenAt: isIso(item.takenAt) ? item.takenAt : `${item.day}T12:00:00.000Z`,
    source: item.source === 'booth' ? 'booth' : 'upload',
    width,
    height,
    ...(typeof item.photoKey === 'string' && ID.test(item.photoKey)
      ? { photoKey: item.photoKey }
      : {}),
  }
}

function pick(list: readonly { id: string }[], id: unknown, fallback: string): string {
  return typeof id === 'string' && list.some((item) => item.id === id) ? id : fallback
}

/**
 * Pulihkan data kenangan dari IndexedDB dengan aman: entri rusak dibuang, id preset yang sudah
 * tidak ada diganti bawaan, dan momen yang tidak ada dibuang dari hari maupun album.
 */
export function normalizeMemories(raw: unknown): MemoryData {
  const data = emptyMemories()
  if (!raw || typeof raw !== 'object') return data
  const stored = raw as Record<string, unknown>
  for (const value of Object.values((stored.moments as object | undefined) ?? {})) {
    const moment = toMoment(value)
    if (moment) data.moments[moment.id] = moment
  }
  const known = (ids: unknown) =>
    Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string' && !!data.moments[id])
      : []
  for (const value of Object.values((stored.days as object | undefined) ?? {})) {
    if (!value || typeof value !== 'object') continue
    const item = value as Record<string, unknown>
    if (typeof item.day !== 'string' || !DAY.test(item.day)) continue
    const frameColor =
      typeof item.frameColor === 'string' &&
      (HEX.test(item.frameColor) || byId(pocket.frameColors, item.frameColor))
        ? item.frameColor
        : pocket.frameColors[0]!.id
    data.days[item.day] = {
      day: item.day,
      packet: pick(pocket.packetColors, item.packet, pocket.packetColors[0]!.id),
      sticker: pick(letter.stickers, item.sticker, letter.stickers[0]!.id),
      frame: pick(pocket.frames, item.frame, pocket.frames[0]!.id),
      frameColor,
      moments: known(item.moments),
      savedAt: isIso(item.savedAt) ? item.savedAt : new Date(0).toISOString(),
    }
  }
  if (Array.isArray(stored.albums)) {
    for (const value of stored.albums) {
      if (!value || typeof value !== 'object') continue
      const item = value as Record<string, unknown>
      if (typeof item.id !== 'string' || !ID.test(item.id)) continue
      data.albums.push({
        id: item.id,
        title:
          typeof item.title === 'string' && item.title.trim() ? item.title.slice(0, 40) : 'Album',
        emoji: typeof item.emoji === 'string' && item.emoji ? item.emoji.slice(0, 8) : '📀',
        color:
          typeof item.color === 'string' && HEX.test(item.color) ? item.color : SPINE_COLORS[0]!,
        moments: known(item.moments),
        createdAt: isIso(item.createdAt) ? item.createdAt : new Date(0).toISOString(),
      })
    }
  }
  const pending = toPending(stored.pending)
  if (pending) data.pending = pending
  return data
}

/** Catatan perubahan yang tersimpan, tanpa entri rusak. Baris yang dihapus tetap dicatat. */
function toPending(value: unknown): PendingChanges | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const seq = Number(item.seq)
  if (!Number.isInteger(seq) || seq < 0) return null
  const entries = (raw: unknown, key: RegExp) =>
    Object.fromEntries(
      Object.entries(raw && typeof raw === 'object' ? raw : {}).filter(
        ([name, value]) => key.test(name) && Number.isInteger(value),
      ),
    ) as Record<string, number>
  return {
    seq,
    moments: entries(item.moments, ID),
    days: entries(item.days, DAY),
    albums: entries(item.albums, ID),
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Masih ada momen atau album dengan id lama (`m`/`a` + 6 karakter) yang belum jadi UUID. */
export function hasLegacyIds(data: MemoryData): boolean {
  return (
    Object.keys(data.moments).some((id) => !UUID.test(id)) ||
    data.albums.some((album) => !UUID.test(album.id))
  )
}

/**
 * Data yang sama, dengan id lama momen dan album diganti UUID, termasuk di kantong dan album.
 * Fase 2 menyinkronkan baris dengan id dari browser (docs/backend.md, Rancangan skema fase 2),
 * jadi id harus unik di semua perangkat; id lama hanya 6 karakter acak per perangkat. Momen
 * yang diganti menyimpan id lamanya sebagai `photoKey`, jadi fotonya tidak perlu dipindah.
 */
export function withUuids(
  data: MemoryData,
  newId: () => string = () => crypto.randomUUID(),
): MemoryData {
  const renamed = new Map<string, string>()
  for (const id of Object.keys(data.moments)) if (!UUID.test(id)) renamed.set(id, newId())
  const rename = (id: string) => renamed.get(id) ?? id
  return {
    ...data,
    moments: Object.fromEntries(
      Object.values(data.moments).map((moment) => {
        const id = renamed.get(moment.id)
        return id
          ? [id, { ...moment, id, photoKey: moment.photoKey ?? moment.id }]
          : [moment.id, moment]
      }),
    ),
    days: Object.fromEntries(
      Object.entries(data.days).map(([key, day]) => [
        key,
        { ...day, moments: day.moments.map(rename) },
      ]),
    ),
    albums: data.albums.map((album) => ({
      ...album,
      id: UUID.test(album.id) ? album.id : newId(),
      moments: album.moments.map(rename),
    })),
  }
}

/**
 * Data yang sama dengan id baru untuk semua momen dan album, untuk perangkat yang dipakai akun
 * lain. Id di cadangan unik untuk semua akun, jadi momen yang sudah tercadang ke akun lama tidak
 * bisa dikirim lagi dengan id yang sama. Fotonya tetap di kuncinya (`photoKey`). Catatan
 * perubahan dikosongkan, karena sinkron pertama akun baru mengirim semuanya.
 */
export function withNewIds(
  data: MemoryData,
  newId: () => string = () => crypto.randomUUID(),
): MemoryData {
  const renamed = new Map(Object.keys(data.moments).map((id) => [id, newId()]))
  const rename = (id: string) => renamed.get(id) ?? id
  const { pending: _sent, ...rest } = data
  return {
    ...rest,
    moments: Object.fromEntries(
      Object.values(data.moments).map((moment) => {
        const id = rename(moment.id)
        return [id, { ...moment, id, photoKey: moment.photoKey ?? moment.id }]
      }),
    ),
    days: Object.fromEntries(
      Object.entries(data.days).map(([key, day]) => [
        key,
        { ...day, moments: day.moments.map(rename) },
      ]),
    ),
    albums: data.albums.map((album) => ({
      ...album,
      id: newId(),
      moments: album.moments.map(rename),
    })),
  }
}

/** CD sementara berisi satu kantong Pocket, untuk tombol "Putar di TV". */
export function dayAlbum(day: PocketDay): AlbumView {
  return {
    id: `hari-${day.day}`,
    title: parseDay(day.day).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    emoji: '👝',
    color: byId(pocket.packetColors, day.packet)?.color ?? SPINE_COLORS[0]!,
    moments: day.moments,
    kind: 'day',
  }
}

/** Semua album untuk rak CD: album bulanan otomatis dulu, lalu album buatan user. */
export function albumShelf(data: MemoryData): AlbumView[] {
  return [
    ...monthAlbums(data.moments),
    ...data.albums.map((album) => ({ ...album, kind: 'custom' as const })),
  ]
}
