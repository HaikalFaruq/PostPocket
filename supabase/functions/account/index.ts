// Fungsi `account`: DELETE /account menghapus akun yang sedang login beserta semua cadangan
// Pocket-nya (kontrak 0.4.0). Kontrak: docs/api/openapi.yaml.

import { check, db } from '../_shared/db.ts'
import { ApiError, empty, notFound, serve } from '../_shared/http.ts'

const BUCKET = 'moments'
/** Batas berkas per `list()` dan `remove()`. Kuota 100 momen aktif, jadi biasanya sekali jalan. */
const PAGE = 1000
/** Batas putaran hapus berkas, supaya Storage yang tidak pernah kosong tidak membuat loop. */
const MAX_ROUNDS = 20

const unauthorized = () =>
  new ApiError(
    401,
    'unauthorized',
    'sesi login tidak ada, tidak berlaku, atau akunnya sudah dihapus',
  )

/**
 * Id user dari access token di `Authorization`. `auth.getUser()` bertanya ke Supabase Auth, jadi
 * token akun yang sudah dihapus ikut ditolak, bukan cuma tanda tangan dan masa berlakunya.
 */
async function sessionUser(request: Request): Promise<string> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token) throw unauthorized()
  const { data, error } = await db().auth.getUser(token)
  if (error) {
    // 4xx: token salah, kedaluwarsa, atau usernya tidak ada. Selain itu Auth sedang bermasalah.
    const status = (error as { status?: number }).status ?? 500
    if (status >= 400 && status < 500) throw unauthorized()
    throw error
  }
  return data.user.id
}

/** Hapus semua berkas `moments/<userId>/…`, halaman demi halaman sampai foldernya kosong. */
async function removeMomentFiles(userId: string) {
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const files = check(
      await db().storage.from(BUCKET).list(userId, { limit: PAGE }),
    ) as { name: string }[]
    if (!files.length) return
    check(await db().storage.from(BUCKET).remove(files.map((file) => `${userId}/${file.name}`)))
  }
  throw new Error('Berkas moments tidak habis dihapus')
}

async function deleteAccount(request: Request) {
  const userId = await sessionUser(request)
  // Berkas dulu: kalau akunnya duluan, user tidak bisa mengulang request untuk berkas yang
  // tertinggal. Baris profiles, moments, pockets, dan albums ikut terhapus on delete cascade.
  await removeMomentFiles(userId)
  const { error } = await db().auth.admin.deleteUser(userId)
  if (error) throw error
  return empty(request, 204)
}

Deno.serve(serve(async (request, path) => {
  if (path === '/account' && request.method === 'DELETE') return await deleteAccount(request)
  throw notFound('endpoint tidak ada')
}))
