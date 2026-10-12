// Menghapus berkas surat. Dipakai DELETE /letters/{id} dan job pembersihan.

import { type AssetRow, BUCKET, check, db, ok } from './db.ts'

/** Batas path per panggilan `storage.remove()` (path di body JSON). */
const REMOVE_LIMIT = 1000
/**
 * Batas id per filter `.in()`. Filternya ada di query string, dan gateway Supabase menolak URL
 * sekitar 36 KB (1.000 UUID) dengan 400, sedangkan 600 UUID (21,7 KB) masih lolos.
 */
const IN_LIMIT = 200

/** Potong `items` jadi bagian berukuran paling banyak `size`. */
export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Gambar depan kartu adalah foto user. Gambar OG memuat gambar depan yang sama, jadi cover dan
 * OG ikut dihapus bersama foto isi surat.
 */
export const frontIsPhoto = (design: Record<string, unknown>) => design.illustration === 'upload'

/** Hapus berkas dari Storage, baru barisnya: letter_assets memakai on delete restrict. */
export async function removeAssets(assets: Pick<AssetRow, 'id' | 'storage_path'>[]) {
  for (const batch of chunks(assets, REMOVE_LIMIT)) {
    check(await db().storage.from(BUCKET).remove(batch.map((asset) => asset.storage_path)))
    for (const ids of chunks(batch.map((asset) => asset.id), IN_LIMIT)) {
      ok(await db().from('letter_assets').delete().in('id', ids))
    }
  }
}

/** Hapus surat beserta semua berkasnya. */
export async function deleteLetters(ids: string[]) {
  for (const part of chunks(ids, IN_LIMIT)) {
    const assets = check(
      await db().from('letter_assets').select('id, storage_path').in('letter_id', part),
    ) as Pick<AssetRow, 'id' | 'storage_path'>[]
    await removeAssets(assets)
    ok(await db().from('letters').delete().in('id', part))
  }
}
