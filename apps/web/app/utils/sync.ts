import {
  withPending,
  type Album,
  type MemoryData,
  type Moment,
  type PendingKind,
  type PocketDay,
} from './memories'

// Sinkron Pocket fase 2: bentuk baris tabel di Supabase (docs/backend.md, Rancangan skema fase 2)
// dan aturan menggabungkan perubahan dari server ke data di perangkat. Semua fungsi di sini murni,
// supaya bisa diuji tanpa jaringan; `runSync` (utils/sync-run.ts) yang menjalankannya.

export interface MomentRow {
  id: string
  day: string
  taken_at: string
  source: 'upload' | 'booth'
  width: number
  height: number
  mime: 'image/jpeg' | 'image/webp'
  size: number
  updated_at: string
  deleted_at: string | null
}

export interface PocketRow {
  day: string
  packet: string
  sticker: string
  frame: string
  frame_color: string
  moment_ids: string[]
  saved_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AlbumRow {
  id: string
  title: string
  emoji: string
  color: string
  moment_ids: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** Baris yang ditarik dari server: semua yang berubah sejak tarikan sebelumnya. */
export interface RemoteChanges {
  moments: MomentRow[]
  pockets: PocketRow[]
  albums: AlbumRow[]
}

/** Baris yang dikirim: `owner_id` dan `updated_at` selalu diisi server. */
export type Outgoing<Row> = Omit<Row, 'updated_at'>

/**
 * Tarikan berikutnya mulai 5 menit sebelum `updated_at` terbaru yang sudah diterima.
 * `updated_at = now()` adalah waktu mulai transaksi, jadi transaksi yang commit belakangan bisa
 * membawa waktu yang lebih kecil (docs/backend.md, Sinkron).
 */
export const PULL_OVERLAP_MS = 5 * 60 * 1000

export function pullSince(lastPulledAt: string | null): string | null {
  if (!lastPulledAt) return null
  return new Date(Date.parse(lastPulledAt) - PULL_OVERLAP_MS).toISOString()
}

/** `updated_at` terbaru di tarikan ini, atau `null` kalau tidak ada baris. */
export function latestUpdate(remote: RemoteChanges): string | null {
  let latest: string | null = null
  for (const row of [...remote.moments, ...remote.pockets, ...remote.albums]) {
    if (!latest || Date.parse(row.updated_at) > Date.parse(latest)) latest = row.updated_at
  }
  return latest
}

/** Foto yang naik ke cadangan selalu versi kompres JPEG (`compressPhoto`). */
export function momentRow(
  moment: Moment,
  upload: { width: number; height: number; size: number },
): Outgoing<MomentRow> {
  return {
    id: moment.id,
    day: moment.day,
    taken_at: moment.takenAt,
    source: moment.source,
    width: upload.width,
    height: upload.height,
    mime: 'image/jpeg',
    size: upload.size,
    deleted_at: null,
  }
}

export function pocketRow(day: PocketDay): Outgoing<PocketRow> {
  return {
    day: day.day,
    packet: day.packet,
    sticker: day.sticker,
    frame: day.frame,
    frame_color: day.frameColor,
    moment_ids: day.moments,
    saved_at: day.savedAt,
    deleted_at: null,
  }
}

export function albumRow(album: Album): Outgoing<AlbumRow> {
  return {
    id: album.id,
    title: album.title,
    emoji: album.emoji,
    color: album.color,
    moment_ids: album.moments,
    created_at: album.createdAt,
    deleted_at: null,
  }
}

function momentFromRow(row: MomentRow): Moment {
  return {
    id: row.id,
    day: row.day,
    takenAt: row.taken_at,
    source: row.source,
    width: row.width,
    height: row.height,
  }
}

function dayFromRow(row: PocketRow, moments: string[]): PocketDay {
  return {
    day: row.day,
    packet: row.packet,
    sticker: row.sticker,
    frame: row.frame,
    frameColor: row.frame_color,
    moments,
    savedAt: row.saved_at,
  }
}

function albumFromRow(row: AlbumRow, moments: string[]): Album {
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    color: row.color,
    moments,
    createdAt: row.created_at,
  }
}

export interface PushPlan {
  moments: { upsert: string[]; remove: string[] }
  days: { upsert: string[]; remove: string[] }
  albums: { upsert: string[]; remove: string[] }
}

/** Yang dikirim dari catatan perubahan: baris yang masih ada di-upsert, sisanya ditandai hapus. */
export function pushPlan(data: MemoryData): PushPlan {
  const pending = data.pending ?? { seq: 0, moments: {}, days: {}, albums: {} }
  const split = (kind: PendingKind, exists: (key: string) => boolean) => {
    const keys = Object.keys(pending[kind])
    return { upsert: keys.filter(exists), remove: keys.filter((key) => !exists(key)) }
  }
  return {
    moments: split('moments', (id) => !!data.moments[id]),
    days: split('days', (day) => !!data.days[day]),
    albums: split('albums', (id) => data.albums.some((album) => album.id === id)),
  }
}

/** Data tanpa catatan perubahan untuk baris yang sudah tidak ada (tanda hapus). */
export function withoutTombstones(data: MemoryData): MemoryData {
  if (!data.pending) return data
  const plan = pushPlan(data)
  const drop = (kind: PendingKind) => {
    const gone = new Set(plan[kind].remove)
    return Object.fromEntries(Object.entries(data.pending![kind]).filter(([key]) => !gone.has(key)))
  }
  return {
    ...data,
    pending: {
      ...data.pending,
      moments: drop('moments'),
      days: drop('days'),
      albums: drop('albums'),
    },
  }
}

/** Gabungan urutan: urutan server dulu, lalu momen yang hanya ada di perangkat ini. */
function union(first: string[], second: string[]): string[] {
  return [...first, ...second.filter((id) => !first.includes(id))]
}

/**
 * Gabungkan perubahan dari server ke data di perangkat.
 *
 * - Baris yang masih menunggu dikirim (`pending`) menang: perubahannya dikirim setelah ini, jadi
 *   "tulisan terakhir menang" dihitung saat kirim. Momen yang hanya ada di server tetap
 *   ditambahkan ke urutannya.
 * - Baris lain mengikuti server. Momen kantong atau album yang hanya ada di perangkat ini
 *   ditempelkan lagi di akhir urutan lalu dikirim ulang, supaya HP yang lama offline tidak
 *   membuang foto dari kantong (docs/backend.md, Sinkron).
 * - `first`: sinkron pertama akun ini di perangkat ini. Server menang untuk baris yang ada di
 *   kedua tempat, data yang hanya ada di perangkat ini dikirim, dan tanda hapus lama di server
 *   tidak pernah menghapus data di perangkat ini.
 * - Kantong dan album tidak pernah menyimpan id momen yang tidak ada di perangkat ini.
 */
export function mergeRemote(
  current: MemoryData,
  remote: RemoteChanges,
  first: boolean,
): MemoryData {
  // Tanda hapus dari sebelum sinkron pertama (sebelum login, atau milik akun lain) tidak dikirim:
  // tanggal kantong yang sama bisa jadi kantong lain milik akun ini di HP lain.
  const local = first ? withoutTombstones(current) : current
  const pending = local.pending ?? { seq: 0, moments: {}, days: {}, albums: {} }
  const waiting = (kind: PendingKind, key: string) => !first && pending[kind][key] !== undefined
  const resend: Record<PendingKind, string[]> = { moments: [], days: [], albums: [] }

  const moments = new Map(Object.entries(local.moments))
  for (const row of remote.moments) {
    if (waiting('moments', row.id)) continue
    if (row.deleted_at) {
      if (!first) moments.delete(row.id)
    } else if (!moments.has(row.id)) {
      moments.set(row.id, momentFromRow(row))
    }
  }
  const known = (id: string) => moments.has(id)

  const days = new Map(Object.entries(local.days))
  for (const row of remote.pockets) {
    const here = days.get(row.day)
    if (waiting('days', row.day)) {
      // Dihapus di sini dan belum terkirim: biarkan terhapus.
      if (!here || row.deleted_at) continue
      days.set(row.day, { ...here, moments: union(here.moments, row.moment_ids.filter(known)) })
      continue
    }
    if (row.deleted_at) {
      if (!first) days.delete(row.day)
      continue
    }
    const extra = here ? here.moments.filter((id) => known(id) && !row.moment_ids.includes(id)) : []
    days.set(row.day, dayFromRow(row, union(row.moment_ids.filter(known), extra)))
    if (extra.length) resend.days.push(row.day)
  }

  const albums = [...local.albums]
  for (const row of remote.albums) {
    const index = albums.findIndex((album) => album.id === row.id)
    const here = albums[index]
    if (waiting('albums', row.id)) {
      if (!here || row.deleted_at) continue
      albums[index] = { ...here, moments: union(here.moments, row.moment_ids.filter(known)) }
      continue
    }
    if (row.deleted_at) {
      if (!first && here) albums.splice(index, 1)
      continue
    }
    const extra = here ? here.moments.filter((id) => known(id) && !row.moment_ids.includes(id)) : []
    const album = albumFromRow(row, union(row.moment_ids.filter(known), extra))
    if (here) albums[index] = album
    else albums.push(album)
    if (extra.length) resend.albums.push(row.id)
  }

  if (first) {
    const active = <Row extends { deleted_at: string | null }>(rows: Row[]) =>
      rows.filter((row) => !row.deleted_at)
    const remoteMoments = new Set(active(remote.moments).map((row) => row.id))
    const remoteDays = new Set(active(remote.pockets).map((row) => row.day))
    const remoteAlbums = new Set(active(remote.albums).map((row) => row.id))
    resend.moments.push(...[...moments.keys()].filter((id) => !remoteMoments.has(id)))
    resend.days.push(...[...days.keys()].filter((day) => !remoteDays.has(day)))
    resend.albums.push(...albums.map((album) => album.id).filter((id) => !remoteAlbums.has(id)))
  }

  // Momen yang dihapus server tidak boleh tertinggal di kantong atau album mana pun.
  const merged: MemoryData = {
    ...local,
    moments: Object.fromEntries(moments),
    days: Object.fromEntries(
      [...days].map(([key, day]) => [key, { ...day, moments: day.moments.filter(known) }]),
    ),
    albums: albums.map((album) => ({ ...album, moments: album.moments.filter(known) })),
  }
  const changed = resend.moments.length + resend.days.length + resend.albums.length > 0
  return changed ? withPending(merged, resend) : merged
}
