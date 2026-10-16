import { withoutSent, type MemoryData, type PendingKind } from './memories'
import {
  albumRow,
  latestUpdate,
  mergeRemote,
  momentRow,
  pocketRow,
  pullSince,
  pushPlan,
  type AlbumRow,
  type MomentRow,
  type Outgoing,
  type PocketRow,
  type RemoteChanges,
} from './sync'
import type { UploadImage } from './letter-api'

// Satu putaran sinkron Pocket. Bergantung pada dua antarmuka, supaya bisa diuji tanpa jaringan:
// `SyncLocal` (store kenangan di IndexedDB) dan `SyncBackend` (Supabase, utils/sync-supabase.ts).

/** Sisi perangkat: store kenangan. */
export interface SyncLocal {
  data(): MemoryData
  /** Terapkan perubahan ke data terbaru, tanpa jeda `await` di antara baca dan tulis. */
  apply(update: (current: MemoryData) => MemoryData): Promise<void>
  /** Id momen yang fotonya ada di perangkat ini. */
  photosHere(): Promise<Set<string>>
  savePhoto(id: string, blob: Blob, width: number, height: number): Promise<void>
  /** Versi kompres untuk diunggah, atau `null` kalau fotonya tidak ada di perangkat ini. */
  uploadVersion(id: string): Promise<UploadImage | null>
}

/** Sisi server: tabel fase 2 dan bucket `moments`, selalu milik user yang login. */
export interface SyncBackend {
  pull(since: string | null): Promise<RemoteChanges>
  /** Melempar `QuotaFull` kalau user sudah punya 100 momen aktif. */
  upsertMoment(row: Outgoing<MomentRow>): Promise<void>
  upsertPockets(rows: Outgoing<PocketRow>[]): Promise<void>
  upsertAlbums(rows: Outgoing<AlbumRow>[]): Promise<void>
  /** Tandai hapus (`deleted_at`) dan hapus berkasnya. */
  removeMoments(ids: string[]): Promise<void>
  removePockets(days: string[]): Promise<void>
  removeAlbums(ids: string[]): Promise<void>
  /** Unggah berkas momen. Berkas yang sudah ada dianggap berhasil. */
  upload(id: string, blob: Blob): Promise<void>
  /** Momen aktif yang berkasnya tidak ada di bucket. */
  missing(ids: string[]): Promise<string[]>
  /** Berkas momen, atau `null` kalau tidak ada. */
  download(id: string): Promise<Blob | null>
}

/** Bagian cadangan yang kuotanya penuh. */
export type QuotaKind = 'moments' | 'pockets' | 'albums'

/**
 * Kuota cadangan penuh (trigger kuota di database, kode 23514): 100 foto aktif, atau batas baris
 * kantong, album, dan momen per user yang jauh di atas pemakaian wajar.
 */
export class QuotaFull extends Error {
  constructor(readonly kind: QuotaKind = 'moments') {
    super(`kuota ${kind} penuh`)
    this.name = 'QuotaFull'
  }
}

export interface SyncProgress {
  /** Foto dari cadangan yang sedang diunduh. */
  downloading?: { done: number; total: number }
}

export interface SyncOutcome {
  /** `updated_at` terbaru yang sudah diterapkan, untuk tarikan berikutnya. */
  lastPulledAt: string | null
  /** Kuota yang penuh di putaran ini. Yang tidak muat tetap menunggu di perangkat. */
  quotaFull: QuotaKind | null
  downloaded: number
  uploaded: number
  /** Foto yang gagal diunduh. Momennya belum ditampilkan dan ditarik lagi di sinkron berikutnya. */
  failedDownloads: number
}

/** Jalankan fungsi untuk tiap item, paling banyak `limit` sekaligus. */
async function eachLimited<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0
  const worker = async () => {
    while (next < items.length) await run(items[next++]!)
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

/**
 * Satu putaran: tarik perubahan, unduh foto baru, gabungkan, kirim perubahan di perangkat ini,
 * lalu unggah ulang berkas yang hilang dari cadangan.
 *
 * - Foto momen baru diunduh sebelum momennya ditampilkan, jadi tidak pernah muncul kosong. Momen
 *   yang fotonya gagal diunduh dilewati, dan `lastPulledAt` tidak maju, supaya tertarik lagi.
 * - `first`: sinkron pertama akun ini di perangkat ini (lihat `mergeRemote`). Pemanggil yang
 *   mencatatnya per akun, bukan dari `lastPulledAt`, karena `lastPulledAt` bisa tetap kosong
 *   setelah sinkron pertama kalau ada foto yang gagal diunduh.
 */
export async function runSync(
  local: SyncLocal,
  backend: SyncBackend,
  options: { lastPulledAt: string | null; first: boolean; onProgress?: (p: SyncProgress) => void },
): Promise<SyncOutcome> {
  const { first, onProgress } = options
  const remote = await backend.pull(first ? null : pullSince(options.lastPulledAt))

  // 1. Unduh foto momen baru.
  const before = local.data()
  const waitingDeletion = (id: string) => !first && before.pending?.moments[id] !== undefined
  const incoming = remote.moments.filter(
    (row) => !row.deleted_at && !before.moments[row.id] && !waitingDeletion(row.id),
  )
  const failed = new Set<string>()
  let done = 0
  onProgress?.({ downloading: { done, total: incoming.length } })
  await eachLimited(incoming, 4, async (row) => {
    try {
      const blob = await backend.download(row.id)
      if (blob) await local.savePhoto(row.id, blob, row.width, row.height)
      else failed.add(row.id)
    } catch {
      failed.add(row.id)
    }
    onProgress?.({ downloading: { done: ++done, total: incoming.length } })
  })
  onProgress?.({})

  // 2. Gabungkan. Momen yang fotonya gagal diunduh belum ditampilkan.
  const ready: RemoteChanges = {
    ...remote,
    moments: remote.moments.filter((row) => !failed.has(row.id)),
  }
  await local.apply((current) => mergeRemote(current, ready, first))

  // 3. Kirim perubahan di perangkat ini.
  const data = local.data()
  const plan = pushPlan(data)
  const seqOf = (kind: PendingKind, key: string) => data.pending?.[kind][key]
  const sent: Record<PendingKind, Record<string, number>> = { moments: {}, days: {}, albums: {} }
  const markSent = (kind: PendingKind, keys: string[]) => {
    for (const key of keys) {
      const seq = seqOf(kind, key)
      if (seq !== undefined) sent[kind][key] = seq
    }
  }

  let quotaFull: QuotaKind | null = null
  /** Kirim satu jenis perubahan. Yang ditolak kuota tetap menunggu, sisanya jalan terus. */
  const send = async (run: () => Promise<void>) => {
    try {
      await run()
    } catch (problem) {
      if (!(problem instanceof QuotaFull)) throw problem
      quotaFull ??= problem.kind
    }
  }
  let uploaded = 0
  for (const id of plan.moments.upsert) {
    const moment = data.moments[id]!
    const image = await local.uploadVersion(id)
    // Foto lokalnya hilang: tidak ada yang bisa dicadangkan.
    if (!image) {
      markSent('moments', [id])
      continue
    }
    try {
      await backend.upsertMoment(momentRow(moment, image))
    } catch (problem) {
      if (problem instanceof QuotaFull) {
        quotaFull = problem.kind
        break
      }
      throw problem
    }
    await backend.upload(id, image.blob)
    uploaded++
    markSent('moments', [id])
  }
  if (plan.moments.remove.length) {
    await backend.removeMoments(plan.moments.remove)
    markSent('moments', plan.moments.remove)
  }
  if (plan.days.upsert.length) {
    await send(async () => {
      await backend.upsertPockets(plan.days.upsert.map((day) => pocketRow(data.days[day]!)))
      markSent('days', plan.days.upsert)
    })
  }
  if (plan.days.remove.length) {
    await backend.removePockets(plan.days.remove)
    markSent('days', plan.days.remove)
  }
  const albums = new Map(data.albums.map((album) => [album.id, album]))
  if (plan.albums.upsert.length) {
    await send(async () => {
      await backend.upsertAlbums(plan.albums.upsert.map((id) => albumRow(albums.get(id)!)))
      markSent('albums', plan.albums.upsert)
    })
  }
  if (plan.albums.remove.length) {
    await backend.removeAlbums(plan.albums.remove)
    markSent('albums', plan.albums.remove)
  }
  await local.apply((current) => withoutSent(current, sent))

  // 4. Berkas yang hilang dari cadangan diunggah ulang dari perangkat yang masih punya fotonya,
  // misalnya momen yang dipulihkan setelah job pembersihan menghapus berkasnya.
  const after = local.data()
  const here = await local.photosHere()
  const backedUp = Object.keys(after.moments).filter(
    (id) => here.has(id) && after.pending?.moments[id] === undefined,
  )
  for (const id of backedUp.length ? await backend.missing(backedUp) : []) {
    const image = await local.uploadVersion(id)
    if (!image) continue
    try {
      await backend.upload(id, image.blob)
      uploaded++
    } catch {
      // Dicoba lagi di sinkron berikutnya; satu berkas tidak boleh menggagalkan semuanya.
    }
  }

  return {
    lastPulledAt: failed.size
      ? options.lastPulledAt
      : (latestUpdate(remote) ?? options.lastPulledAt),
    quotaFull,
    downloaded: incoming.length - failed.size,
    uploaded,
    failedDownloads: failed.size,
  }
}
