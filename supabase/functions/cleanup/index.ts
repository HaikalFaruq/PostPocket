// Fungsi `cleanup`: job pembersihan berkas surat, dipanggil pg_cron tiap jam lewat
// public.run_cleanup() (migrasi cleanup_job). Bukan bagian kontrak API frontend.
//
// Menghapus, paling banyak BATCH × ROUNDS surat per jenis per panggilan:
// - draf yang lewat draft_expires_at, beserta berkasnya;
// - surat yang lewat expires_at (30 hari sejak publish), beserta berkasnya;
// - foto surat yang lewat photos_expire_at (7 hari sejak dibuka), plus cover dan gambar OG
//   kalau gambar depannya foto user, lalu mengisi photos_deleted_at.

import { type AssetRow, check, db, type LetterRow, ok, secretKey } from '../_shared/db.ts'
import { deleteLetters, frontIsPhoto, removeAssets } from '../_shared/files.ts'
import { bytea, sameHash, sha256 } from '../_shared/token.ts'

// Satu batch dipakai langsung di filter `.in()`, jadi jangan lebih dari IN_LIMIT di _shared/files.ts.
const BATCH = 100
const ROUNDS = 10
/** Draf yang sedang di-publish tepat saat kedaluwarsa tidak dihapus di tengah jalan. */
const DRAFT_GRACE_MS = 10 * 60_000

/** Token dari Vault (pg_cron), atau secret key proyek sebagai bearer (test dan manual). */
async function authorized(request: Request): Promise<boolean> {
  const token = request.headers.get('x-cleanup-token')
  if (token) {
    return check(await db().rpc('cleanup_token_valid', { p_token: token })) === true
  }
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  return !!bearer && sameHash(await sha256(bearer), bytea(await sha256(secretKey())))
}

async function expiredLetters(status: 'draft' | 'sent'): Promise<string[]> {
  const column = status === 'draft' ? 'draft_expires_at' : 'expires_at'
  const before = Date.now() - (status === 'draft' ? DRAFT_GRACE_MS : 0)
  const rows = check(
    await db().from('letters').select('id').eq('status', status)
      .lte(column, new Date(before).toISOString()).order(column).limit(BATCH),
  ) as Pick<LetterRow, 'id'>[]
  await deleteLetters(rows.map((row) => row.id))
  return rows.map((row) => row.id)
}

async function expiredPhotos(): Promise<string[]> {
  const letters = check(
    await db().from('letters').select('id, design').eq('status', 'sent')
      .is('photos_deleted_at', null).lte('photos_expire_at', new Date().toISOString())
      .order('photos_expire_at').limit(BATCH),
  ) as Pick<LetterRow, 'id' | 'design'>[]
  if (!letters.length) return []
  const ids = letters.map((letter) => letter.id)
  const withFront = new Set(letters.filter((l) => frontIsPhoto(l.design)).map((l) => l.id))
  const assets = check(
    await db().from('letter_assets').select('id, letter_id, kind, storage_path').in(
      'letter_id',
      ids,
    ),
  ) as (Pick<AssetRow, 'id' | 'kind' | 'storage_path'> & { letter_id: string })[]
  await removeAssets(
    assets.filter((asset) => asset.kind === 'photo' || withFront.has(asset.letter_id)),
  )
  ok(
    await db().from('letters').update({ photos_deleted_at: new Date().toISOString() }).in(
      'id',
      ids,
    ),
  )
  return ids
}

/** Ulangi satu jenis pembersihan sampai antreannya habis atau ROUNDS tercapai. */
async function drain(step: () => Promise<string[]>): Promise<number> {
  let total = 0
  for (let round = 0; round < ROUNDS; round++) {
    const done = await step()
    total += done.length
    if (done.length < BATCH) break
  }
  return total
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'method' }, { status: 405 })
  try {
    if (!(await authorized(request))) {
      return Response.json({ error: 'unauthorized' }, { status: 401 })
    }
    const result = {
      drafts: await drain(() => expiredLetters('draft')),
      letters: await drain(() => expiredLetters('sent')),
      photos: await drain(expiredPhotos),
    }
    console.log('cleanup', JSON.stringify(result))
    return Response.json(result)
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'internal' }, { status: 500 })
  }
})
