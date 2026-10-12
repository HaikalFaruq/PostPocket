// Menghapus berkas surat. Dipakai DELETE /letters/{id} dan job pembersihan.

import { type AssetRow, BUCKET, check, db, ok } from './db.ts'

/** Batas path per panggilan `storage.remove()`. */
const REMOVE_LIMIT = 1000

/**
 * Gambar depan kartu adalah foto user. Gambar OG memuat gambar depan yang sama, jadi cover dan
 * OG ikut dihapus bersama foto isi surat.
 */
export const frontIsPhoto = (design: Record<string, unknown>) => design.illustration === 'upload'

/** Hapus berkas dari Storage, baru barisnya: letter_assets memakai on delete restrict. */
export async function removeAssets(assets: Pick<AssetRow, 'id' | 'storage_path'>[]) {
  for (let i = 0; i < assets.length; i += REMOVE_LIMIT) {
    const batch = assets.slice(i, i + REMOVE_LIMIT)
    check(await db().storage.from(BUCKET).remove(batch.map((asset) => asset.storage_path)))
    ok(await db().from('letter_assets').delete().in('id', batch.map((asset) => asset.id)))
  }
}

/** Hapus surat beserta semua berkasnya. */
export async function deleteLetters(ids: string[]) {
  if (!ids.length) return
  const assets = check(
    await db().from('letter_assets').select('id, storage_path').in('letter_id', ids),
  ) as Pick<AssetRow, 'id' | 'storage_path'>[]
  await removeAssets(assets)
  ok(await db().from('letters').delete().in('id', ids))
}
