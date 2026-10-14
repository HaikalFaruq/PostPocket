import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlbumRow, MomentRow, Outgoing, PocketRow, RemoteChanges } from './sync'
import { QuotaFull, type SyncBackend } from './sync-run'

// SyncBackend di atas Supabase: tabel fase 2 lewat PostgREST dengan sesi user (RLS
// owner_id = auth.uid()) dan berkas di bucket privat `moments` (docs/backend.md, Rancangan skema
// fase 2). Path berkas sama dengan yang diwajibkan policy unggah: <owner_id>/<moment_id>.jpg.

const PAGE = 1000

/** Lempar error PostgREST atau Storage apa adanya. */
function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error
  return result.data
}

/** Unggahan ke path yang sudah ada dijawab Storage dengan "resource already exists" (409). */
function alreadyExists(error: unknown): boolean {
  const value = error as { status?: number; statusCode?: string; message?: string } | null
  return (
    value?.status === 409 ||
    value?.statusCode === '409' ||
    /already exists|duplicate/i.test(value?.message ?? '')
  )
}

export function supabaseBackend(client: SupabaseClient, userId: string): SyncBackend {
  const files = client.storage.from('moments')
  const path = (id: string) => `${userId}/${id}.jpg`
  const now = () => new Date().toISOString()

  /**
   * Semua baris `table` yang berubah sejak `since`, per halaman 1.000. Baris dari satu upsert
   * punya `updated_at` yang sama persis, jadi urutannya dikunci juga dengan kolom unik `key`.
   * Tanpa itu Postgres boleh mengurutkan baris yang sama waktunya secara berbeda di tiap halaman,
   * dan begitu lewat 1.000 baris ada yang terlewat atau terbaca dua kali.
   */
  async function read<Row>(table: string, key: string, since: string | null): Promise<Row[]> {
    const rows: Row[] = []
    for (let from = 0; ; from += PAGE) {
      let query = client
        .from(table)
        .select('*')
        .order('updated_at', { ascending: true })
        .order(key, { ascending: true })
        .range(from, from + PAGE - 1)
      if (since) query = query.gt('updated_at', since)
      const page = check(await query) as Row[]
      rows.push(...page)
      if (page.length < PAGE) return rows
    }
  }

  return {
    async pull(since): Promise<RemoteChanges> {
      // Kunci unik tiap tabel di bawah RLS (hanya baris milik user): id, atau hari untuk kantong.
      const [moments, pockets, albums] = await Promise.all([
        read<MomentRow>('moments', 'id', since),
        read<PocketRow>('pockets', 'day', since),
        read<AlbumRow>('albums', 'id', since),
      ])
      return { moments, pockets, albums }
    },

    async upsertMoment(row: Outgoing<MomentRow>) {
      const { error } = await client.from('moments').upsert(row, { onConflict: 'id' })
      if (!error) return
      // Trigger moments_quota memakai kode check_violation dengan pesan "kuota momen penuh".
      if (error.code === '23514' && /kuota/i.test(error.message)) throw new QuotaFull()
      throw error
    },

    async upsertPockets(rows: Outgoing<PocketRow>[]) {
      check(await client.from('pockets').upsert(rows, { onConflict: 'owner_id,day' }))
    },

    async upsertAlbums(rows: Outgoing<AlbumRow>[]) {
      check(await client.from('albums').upsert(rows, { onConflict: 'id' }))
    },

    async removeMoments(ids) {
      check(await client.from('moments').update({ deleted_at: now() }).in('id', ids))
      // Berkasnya langsung dihapus; yang tertinggal dibersihkan job tiap jam.
      check(await files.remove(ids.map(path)))
    },

    async removePockets(days) {
      check(await client.from('pockets').update({ deleted_at: now() }).in('day', days))
    },

    async removeAlbums(ids) {
      check(await client.from('albums').update({ deleted_at: now() }).in('id', ids))
    },

    async upload(id, blob) {
      const { error } = await files.upload(path(id), blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      })
      if (error && !alreadyExists(error)) throw error
    },

    async missing(ids) {
      const gone: string[] = []
      for (let start = 0; start < ids.length; start += 100) {
        const chunk = ids.slice(start, start + 100)
        const signed = check(await files.createSignedUrls(chunk.map(path), 60)) ?? []
        for (const [index, item] of signed.entries()) {
          if (item.error) gone.push(chunk[index]!)
        }
      }
      return gone
    },

    async download(id) {
      const { data, error } = await files.download(path(id))
      if (error) return null
      return data
    },
  }
}

/** Jumlah momen aktif di cadangan, untuk tampilan "x/100 foto". */
export async function backedUpCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from('moments')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
  if (error) throw error
  return count ?? 0
}
