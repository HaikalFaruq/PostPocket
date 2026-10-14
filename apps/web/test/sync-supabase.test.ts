import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { supabaseBackend } from '../app/utils/sync-supabase'

// Klien Supabase tiruan secukupnya untuk pull(): mencatat urutan yang diminta tiap tabel dan
// menjawab per halaman sesuai range().
function fakeClient(tables: Record<string, Record<string, unknown>[]>) {
  const orders: Record<string, string[]> = {}
  const client = {
    from(table: string) {
      let from = 0
      let to = 0
      const builder = {
        select: () => builder,
        order: (column: string) => {
          ;(orders[table] ??= []).push(column)
          return builder
        },
        range: (start: number, end: number) => {
          from = start
          to = end
          return builder
        },
        gt: () => builder,
        then: (resolve: (result: { data: unknown[]; error: null }) => void) =>
          resolve({ data: (tables[table] ?? []).slice(from, to + 1), error: null }),
      }
      return builder
    },
    storage: { from: () => ({}) },
  }
  return { client: client as unknown as SupabaseClient, orders }
}

describe('sinkron Supabase', () => {
  it('menarik semua baris lewat beberapa halaman, diurutkan updated_at lalu kunci unik', async () => {
    // Baris dari satu upsert: updated_at sama persis, jadi kunci uniknya yang menentukan urutan.
    const stamp = '2026-10-15T00:00:00.000Z'
    const moments = Array.from({ length: 1001 }, (_, i) => ({ id: `m${i}`, updated_at: stamp }))
    const pockets = [{ day: '2026-10-15', updated_at: stamp }]
    const { client, orders } = fakeClient({ moments, pockets, albums: [] })

    const changes = await supabaseBackend(client, 'user-1').pull(null)

    expect(changes.moments).toHaveLength(1001)
    expect(changes.pockets).toHaveLength(1)
    expect(orders.moments).toEqual(['updated_at', 'id', 'updated_at', 'id'])
    expect(orders.pockets).toEqual(['updated_at', 'day'])
    expect(orders.albums).toEqual(['updated_at', 'id'])
  })
})
