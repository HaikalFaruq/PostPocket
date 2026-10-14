import { describe, expect, it } from 'vitest'
import {
  emptyMemories,
  withPending,
  withoutMoments,
  type MemoryData,
  type Moment,
  type PocketDay,
} from '../app/utils/memories'
import {
  mergeRemote,
  pullSince,
  pushPlan,
  type AlbumRow,
  type MomentRow,
  type PocketRow,
  type RemoteChanges,
} from '../app/utils/sync'
import { QuotaFull, runSync, type SyncBackend, type SyncLocal } from '../app/utils/sync-run'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const DAY = '2026-10-14'

const moment = (n: number, day = DAY): Moment => ({
  id: id(n),
  day,
  takenAt: `${day}T08:00:00.000Z`,
  source: 'upload',
  width: 800,
  height: 600,
})

const pocketDay = (moments: string[], packet = 'blue', day = DAY): PocketDay => ({
  day,
  packet,
  sticker: 'heart',
  frame: 'polaroid',
  frameColor: 'cream',
  moments,
  savedAt: `${day}T09:00:00.000Z`,
})

const momentRowOf = (n: number, extra: Partial<MomentRow> = {}): MomentRow => ({
  id: id(n),
  day: DAY,
  taken_at: `${DAY}T08:00:00.000Z`,
  source: 'upload',
  width: 800,
  height: 600,
  mime: 'image/jpeg',
  size: 1000,
  updated_at: '2026-10-14T10:00:00.000Z',
  deleted_at: null,
  ...extra,
})

const pocketRowOf = (moments: string[], extra: Partial<PocketRow> = {}): PocketRow => ({
  day: DAY,
  packet: 'pink',
  sticker: 'heart',
  frame: 'polaroid',
  frame_color: 'cream',
  moment_ids: moments,
  saved_at: `${DAY}T09:00:00.000Z`,
  updated_at: '2026-10-14T10:00:00.000Z',
  deleted_at: null,
  ...extra,
})

const none: RemoteChanges = { moments: [], pockets: [], albums: [] }

describe('mergeRemote', () => {
  it('momen baru dari server masuk, momen yang dihapus server hilang juga dari kantong', () => {
    const local: MemoryData = {
      ...emptyMemories(),
      moments: { [id(1)]: moment(1) },
      days: { [DAY]: pocketDay([id(1)]) },
    }
    const next = mergeRemote(
      local,
      { ...none, moments: [momentRowOf(1, { deleted_at: 'x' }), momentRowOf(2)] },
      false,
    )
    expect(Object.keys(next.moments)).toEqual([id(2)])
    expect(next.days[DAY]!.moments).toEqual([])
  })

  it('kantong yang belum terkirim menang, tapi momen dari server tetap ditambahkan', () => {
    const local = withPending(
      {
        ...emptyMemories(),
        moments: { [id(1)]: moment(1), [id(2)]: moment(2) },
        days: { [DAY]: pocketDay([id(1)], 'blue') },
      },
      { days: [DAY] },
    )
    const next = mergeRemote(local, { ...none, pockets: [pocketRowOf([id(2)])] }, false)
    expect(next.days[DAY]).toMatchObject({ packet: 'blue', moments: [id(1), id(2)] })
  })

  it('kantong lain mengikuti server, momen yang hanya ada di sini ditempel lagi lalu dikirim', () => {
    const local: MemoryData = {
      ...emptyMemories(),
      moments: { [id(1)]: moment(1), [id(2)]: moment(2) },
      days: { [DAY]: pocketDay([id(1), id(2)], 'blue') },
    }
    const next = mergeRemote(local, { ...none, pockets: [pocketRowOf([id(2)])] }, false)
    expect(next.days[DAY]).toMatchObject({ packet: 'pink', moments: [id(2), id(1)] })
    expect(next.pending?.days[DAY]).toBeDefined()
  })

  it('kantong yang dihapus server ikut hilang, kecuali sedang diubah di sini', () => {
    const local: MemoryData = { ...emptyMemories(), days: { [DAY]: pocketDay([]) } }
    const deleted = { ...none, pockets: [pocketRowOf([], { deleted_at: 'x' })] }
    expect(mergeRemote(local, deleted, false).days[DAY]).toBeUndefined()
    const editing = withPending(local, { days: [DAY] })
    expect(mergeRemote(editing, deleted, false).days[DAY]).toBeDefined()
  })

  it('sinkron pertama: server menang, data yang hanya di sini dikirim, tanda hapus lama dibuang', () => {
    const local = withPending(
      {
        ...emptyMemories(),
        moments: { [id(1)]: moment(1) },
        days: {
          [DAY]: pocketDay([id(1)], 'blue'),
          '2026-10-01': pocketDay([], 'blue', '2026-10-01'),
        },
      },
      // Kantong 2 Oktober dihapus sebelum login: tanda hapusnya tidak boleh dikirim.
      { days: [DAY, '2026-10-02'] },
    )
    const remote: RemoteChanges = {
      moments: [momentRowOf(2)],
      pockets: [
        pocketRowOf([id(2)]),
        pocketRowOf([], { day: '2026-10-01', deleted_at: 'lama' }),
        pocketRowOf([], { day: '2026-10-02' }),
      ],
      albums: [],
    }
    const next = mergeRemote(local, remote, true)
    expect(next.days[DAY]).toMatchObject({ packet: 'pink', moments: [id(2), id(1)] })
    // Tanda hapus lama di server tidak menghapus kantong di perangkat ini.
    expect(next.days['2026-10-01']).toBeDefined()
    expect(next.days['2026-10-02']).toBeDefined()
    expect(Object.keys(next.pending!.moments)).toEqual([id(1)])
    expect(Object.keys(next.pending!.days).sort()).toEqual(['2026-10-01', DAY])
  })
})

describe('pushPlan dan pullSince', () => {
  it('baris yang masih ada dikirim, yang sudah tidak ada ditandai hapus', () => {
    const data = withPending(
      { ...emptyMemories(), moments: { [id(1)]: moment(1) } },
      { moments: [id(1), id(2)], days: [DAY] },
    )
    expect(pushPlan(data)).toEqual({
      moments: { upsert: [id(1)], remove: [id(2)] },
      days: { upsert: [], remove: [DAY] },
      albums: { upsert: [], remove: [] },
    })
  })

  it('tarikan berikutnya mundur 5 menit dari tarikan terakhir', () => {
    expect(pullSince(null)).toBeNull()
    expect(pullSince('2026-10-14T10:05:00.000Z')).toBe('2026-10-14T10:00:00.000Z')
  })
})

/** Server palsu: tabel fase 2 dan bucket untuk satu user, dengan kuota seperti trigger aslinya. */
class FakeServer {
  moments = new Map<string, MomentRow>()
  pockets = new Map<string, PocketRow>()
  albums = new Map<string, AlbumRow>()
  files = new Set<string>()
  quota = 100
  clock = Date.parse('2026-10-14T10:00:00.000Z')
  onUpsert?: () => void

  stamp() {
    this.clock += 1000
    return new Date(this.clock).toISOString()
  }

  backend(): SyncBackend {
    const changed = <Row extends { updated_at: string }>(
      rows: Iterable<Row>,
      since: string | null,
    ) => [...rows].filter((row) => !since || row.updated_at > since)
    return {
      pull: async (since) => ({
        moments: changed(this.moments.values(), since),
        pockets: changed(this.pockets.values(), since),
        albums: changed(this.albums.values(), since),
      }),
      upsertMoment: async (row) => {
        this.onUpsert?.()
        const active = [...this.moments.values()].filter((m) => !m.deleted_at && m.id !== row.id)
        if (!row.deleted_at && active.length >= this.quota) throw new QuotaFull()
        this.moments.set(row.id, { ...row, updated_at: this.stamp() })
      },
      upsertPockets: async (rows) => {
        for (const row of rows) this.pockets.set(row.day, { ...row, updated_at: this.stamp() })
      },
      upsertAlbums: async (rows) => {
        for (const row of rows) this.albums.set(row.id, { ...row, updated_at: this.stamp() })
      },
      removeMoments: async (ids) => {
        for (const key of ids) {
          const row = this.moments.get(key)
          if (row) this.moments.set(key, { ...row, deleted_at: 'x', updated_at: this.stamp() })
          this.files.delete(key)
        }
      },
      removePockets: async (days) => {
        for (const key of days) {
          const row = this.pockets.get(key)
          if (row) this.pockets.set(key, { ...row, deleted_at: 'x', updated_at: this.stamp() })
        }
      },
      removeAlbums: async (ids) => {
        for (const key of ids) {
          const row = this.albums.get(key)
          if (row) this.albums.set(key, { ...row, deleted_at: 'x', updated_at: this.stamp() })
        }
      },
      upload: async (key) => void this.files.add(key),
      missing: async (ids) => ids.filter((key) => !this.files.has(key)),
      download: async (key) => (this.files.has(key) ? new Blob([key]) : null),
    }
  }
}

/** Perangkat palsu: data kenangan dan foto di "IndexedDB". */
class FakeDevice implements SyncLocal {
  memory: MemoryData = emptyMemories()
  photos = new Set<string>()
  lastPulledAt: string | null = null
  first = true

  data = () => this.memory
  apply = async (update: (current: MemoryData) => MemoryData) => {
    const next = update(this.memory)
    for (const key of Object.keys(this.memory.moments))
      if (!next.moments[key]) this.photos.delete(key)
    this.memory = next
  }
  photosHere = async () => new Set(this.photos)
  savePhoto = async (key: string) => void this.photos.add(key)
  uploadVersion = async (key: string) =>
    this.photos.has(key)
      ? { blob: new Blob([key]), type: 'image/jpeg' as const, width: 800, height: 600, size: 1000 }
      : null

  addMoment(n: number) {
    this.photos.add(id(n))
    this.memory = withPending(
      { ...this.memory, moments: { ...this.memory.moments, [id(n)]: moment(n) } },
      { moments: [id(n)] },
    )
  }

  saveDay(day: PocketDay) {
    this.memory = withPending(
      { ...this.memory, days: { ...this.memory.days, [day.day]: day } },
      { days: [day.day] },
    )
  }

  async sync(server: FakeServer) {
    const outcome = await runSync(this, server.backend(), {
      lastPulledAt: this.lastPulledAt,
      first: this.first,
    })
    this.first = false
    this.lastPulledAt = outcome.lastPulledAt
    return outcome
  }
}

describe('runSync', () => {
  it('kenangan dari HP A sampai di HP B, termasuk fotonya, lalu hapus dari B sampai di A', async () => {
    const server = new FakeServer()
    const phoneA = new FakeDevice()
    phoneA.addMoment(1)
    phoneA.saveDay(pocketDay([id(1)]))
    await phoneA.sync(server)
    expect(server.files.has(id(1))).toBe(true)
    expect(phoneA.memory.pending).toMatchObject({ moments: {}, days: {} })

    const phoneB = new FakeDevice()
    await phoneB.sync(server)
    expect(phoneB.memory.days[DAY]!.moments).toEqual([id(1)])
    expect(phoneB.photos.has(id(1))).toBe(true)

    // B menghapus kantong beserta fotonya, seperti deleteDay.
    phoneB.memory = withPending(withoutMoments(phoneB.memory, [id(1)], DAY), {
      moments: [id(1)],
      days: [DAY],
    })
    await phoneB.sync(server)
    expect(server.files.has(id(1))).toBe(false)
    await phoneA.sync(server)
    expect(phoneA.memory.days[DAY]).toBeUndefined()
    expect(phoneA.memory.moments[id(1)]).toBeUndefined()
    expect(phoneA.photos.has(id(1))).toBe(false)
  })

  it('kuota penuh: momen yang tidak muat tetap menunggu di perangkat', async () => {
    const server = new FakeServer()
    server.quota = 2
    const phone = new FakeDevice()
    for (const n of [1, 2, 3]) phone.addMoment(n)
    const outcome = await phone.sync(server)
    expect(outcome.quotaFull).toBe(true)
    expect(server.moments.size).toBe(2)
    expect(Object.keys(phone.memory.pending!.moments)).toHaveLength(1)
  })

  it('berkas yang hilang dari cadangan diunggah ulang dari perangkat yang masih punya fotonya', async () => {
    const server = new FakeServer()
    const phone = new FakeDevice()
    phone.addMoment(1)
    await phone.sync(server)
    server.files.delete(id(1))
    const outcome = await phone.sync(server)
    expect(outcome.uploaded).toBe(1)
    expect(server.files.has(id(1))).toBe(true)
  })

  it('foto yang gagal diunduh: momennya belum tampil dan ditarik lagi nanti', async () => {
    const server = new FakeServer()
    const phoneA = new FakeDevice()
    phoneA.addMoment(1)
    await phoneA.sync(server)
    server.files.delete(id(1))

    const phoneB = new FakeDevice()
    const first = await phoneB.sync(server)
    expect(first.failedDownloads).toBe(1)
    expect(phoneB.memory.moments[id(1)]).toBeUndefined()
    expect(phoneB.lastPulledAt).toBeNull()

    server.files.add(id(1))
    await phoneB.sync(server)
    expect(phoneB.memory.moments[id(1)]).toBeDefined()
    expect(phoneB.photos.has(id(1))).toBe(true)
  })

  it('perubahan selama sinkron berjalan tidak ikut dianggap terkirim', async () => {
    const server = new FakeServer()
    const phone = new FakeDevice()
    phone.addMoment(1)
    phone.saveDay(pocketDay([id(1)], 'blue'))
    // User mengganti desain kantong tepat saat momennya sedang dikirim.
    server.onUpsert = () => {
      server.onUpsert = undefined
      phone.saveDay(pocketDay([id(1)], 'pink'))
    }
    await phone.sync(server)
    expect(phone.memory.pending!.days[DAY]).toBeDefined()
    await phone.sync(server)
    expect(server.pockets.get(DAY)!.packet).toBe('pink')
    expect(phone.memory.pending!.days[DAY]).toBeUndefined()
  })
})
