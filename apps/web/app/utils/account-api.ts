import { createApiCall, type ApiOptions } from './letter-api'

// DELETE /account (kontrak 0.4.0): hapus akun yang sedang login beserta semua cadangan Pocket di
// server, yaitu berkas `moments/<user_id>/…` lalu akunnya (baris profiles, moments, pockets, dan
// albums ikut terhapus). Surat, kotak bareng, dan isi perangkat tidak disentuh.

/**
 * Hapus akun pemilik `accessToken`. Selesai kalau server menjawab 204. Sesi yang sudah tidak
 * berlaku, termasuk karena akunnya sudah terhapus, jadi `LetterApiError` dengan status 401.
 */
export async function deleteAccount(options: ApiOptions, accessToken: string): Promise<void> {
  await createApiCall(options)('DELETE', '/account', { bearer: accessToken })
}
