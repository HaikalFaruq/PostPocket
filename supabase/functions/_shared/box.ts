// Kotak bareng (kontrak 0.3.0): batas, pencarian kotak, pemakaian, dan bentuk respons yang
// dipakai fungsi `boxes`, `k`, dan `letters` (surat titipan).

import { type AssetRow, type BoxRow, check, db, type LetterRow, siteUrl } from './db.ts'
import { ApiError } from './http.ts'

/** Batas per kotak (`BoxLimits` di kontrak), juga dikirim ke `publish_letter()`. */
export const BOX_LIMITS = { letters: 20, photos: 40 }

export const BOX_SLUG = /^[A-Za-z0-9]{10}$/
export const INVITE = /^[A-Za-z0-9]{12}$/
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Semua 404 kotak berkode `box_not_found` (kontrak), juga untuk id yang bentuknya salah. */
export const boxNotFound = (message = 'kotak tidak ada atau sudah kedaluwarsa') =>
  new ApiError(404, 'box_not_found', message)

export const iso = (value: string | null) => (value === null ? null : new Date(value).toISOString())

/** Kotak yang masih berlaku (belum lewat `expires_at`), atau `null`. */
export async function liveBox(
  column: 'id' | 'slug' | 'invite',
  value: string,
): Promise<BoxRow | null> {
  const rows = check(
    await db().from('boxes').select('*').eq(column, value)
      .gt('expires_at', new Date().toISOString()).limit(1),
  ) as BoxRow[]
  return rows[0] ?? null
}

/** `opens_at` sudah lewat menurut jam server: terbuka untuk penerima, tertutup untuk titipan. */
export const openable = (box: BoxRow) => Date.parse(box.opens_at) <= Date.now()

/** Foto titipan tidak dikembalikan lagi: sudah dihapus job, atau masanya sudah lewat. */
export const photosGone = (box: BoxRow) =>
  box.photos_deleted_at !== null ||
  (box.photos_expire_at !== null && Date.parse(box.photos_expire_at) <= Date.now())

/** `photosDeletedAt` di kontrak: waktu job menghapusnya, atau `photosExpireAt` begitu lewat. */
export const photosDeletedAt = (box: BoxRow) =>
  iso(box.photos_deleted_at ?? (photosGone(box) ? box.photos_expire_at : null))

export type BoxLetter =
  & Pick<LetterRow, 'id' | 'from_name' | 'published_at' | 'design' | 'content'>
  & { letter_assets: AssetRow[] }

/** Titipan yang sudah terbit, urut waktu terbit. `content` hanya kalau diminta. */
export async function boxLetters(boxId: string, withContent = false): Promise<BoxLetter[]> {
  const columns = withContent
    ? 'id, from_name, published_at, design, content, letter_assets(*)'
    : 'id, from_name, published_at, letter_assets(kind)'
  return check(
    await db().from('letters').select(columns).eq('box_id', boxId).eq('status', 'sent')
      .order('published_at').order('id'),
  ) as unknown as BoxLetter[]
}

/** Foto dan cover di satu titipan (dihitung ke batas 40 foto). */
export const letterPhotos = (letter: Pick<BoxLetter, 'letter_assets'>) =>
  letter.letter_assets.filter((asset) => asset.kind === 'photo' || asset.kind === 'cover').length

export function usage(letters: BoxLetter[]) {
  return {
    letters: letters.length,
    photos: letters.reduce((sum, letter) => sum + letterPhotos(letter), 0),
  }
}

export const boxUrl = (request: Request, box: BoxRow) => `${siteUrl(request)}/k/${box.slug}`
export const inviteUrl = (request: Request, box: BoxRow) =>
  `${siteUrl(request)}/titip/${box.invite}`

/** Kotak untuk pembuatnya (`OrganizerBox`). */
export function organizerBox(request: Request, box: BoxRow, letters: BoxLetter[]) {
  return {
    id: box.id,
    slug: box.slug,
    url: boxUrl(request, box),
    invite: box.invite,
    inviteUrl: inviteUrl(request, box),
    title: box.title,
    to: box.recipient,
    design: box.design,
    createdAt: iso(box.created_at),
    opensAt: iso(box.opens_at),
    scheduled: box.scheduled,
    openable: openable(box),
    expiresAt: iso(box.expires_at),
    openedAt: iso(box.opened_at),
    photosExpireAt: iso(box.photos_expire_at),
    photosDeletedAt: photosDeletedAt(box),
    limits: BOX_LIMITS,
    usage: usage(letters),
    letters: letters.map((letter) => ({
      id: letter.id,
      from: letter.from_name,
      publishedAt: iso(letter.published_at),
      photos: letterPhotos(letter),
    })),
  }
}

/** Ringkasan kotak untuk pengirim surat titipan (`BoxReceipt`). */
export const boxReceipt = (box: BoxRow) => ({
  title: box.title,
  to: box.recipient,
  opensAt: iso(box.opens_at),
  scheduled: box.scheduled,
})

/**
 * Error kotak dari fungsi database (`raise exception '<kode>' using errcode = 'P0001'`) jadi
 * `ApiError` dengan status yang diminta, atau `null` kalau error lain.
 */
export function boxError(error: unknown, status: number): ApiError | null {
  const value = error as { code?: string; message?: string } | null
  if (value?.code !== 'P0001') return null
  const code = value.message
  if (code === 'box_closed' || code === 'box_full' || code === 'invalid_box') {
    const messages = {
      box_closed: 'kotak sudah terbuka, titipan dan perubahan ditutup',
      box_full: 'kotak sudah penuh',
      invalid_box:
        'opensAt harus di depan jam server dan paling lambat 30 hari setelah kotak dibuat',
    }
    return new ApiError(status, code, messages[code])
  }
  return null
}
