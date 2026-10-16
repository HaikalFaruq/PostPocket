// Fungsi `k`: GET /k/{slug} dan POST /k/{slug}/open untuk penerima kotak bareng
// (kontrak 0.3.0). Kontrak: docs/api/openapi.yaml.

import { boxLetters, boxNotFound, liveBox, openable } from '../_shared/box.ts'
import {
  assetJson,
  type BoxRow,
  check,
  db,
  iso,
  photosDeletedAt,
  photosGone,
  SLUG,
} from '../_shared/db.ts'
import { ApiError, json, notFound, serve } from '../_shared/http.ts'

/** Isi kotak untuk penerima. Sebelum `opensAt`, `letters` kosong tapi jumlahnya terisi. */
async function getBox(request: Request, slug: string) {
  if (!SLUG.test(slug)) throw boxNotFound()
  const box = await liveBox('slug', slug)
  if (!box) throw boxNotFound()
  const isOpen = openable(box)
  const letters = await boxLetters(box.id, isOpen)
  // Foto dan cover titipan tidak dikembalikan lagi begitu masanya lewat, walau job pembersihan
  // (tiap jam) belum menghapusnya, sama seperti GET /l/{slug}.
  const gone = photosGone(box)
  return json(request, 200, {
    slug: box.slug,
    title: box.title,
    to: box.recipient,
    design: box.design,
    opensAt: iso(box.opens_at),
    scheduled: box.scheduled,
    openable: isOpen,
    letterCount: letters.length,
    letters: isOpen
      ? letters.map((letter) => {
        const files = gone ? [] : letter.letter_assets.filter((file) => file.uploaded_at !== null)
        return {
          id: letter.id,
          from: letter.from_name,
          design: letter.design,
          content: letter.content,
          cover: assetJson(files.find((file) => file.kind === 'cover')),
          photos: Object.fromEntries(
            files.filter((file) => file.kind === 'photo').map((
              file,
            ) => [file.key, assetJson(file)]),
          ),
          publishedAt: iso(letter.published_at),
        }
      })
      : [],
    openedAt: iso(box.opened_at),
    photosExpireAt: iso(box.photos_expire_at),
    photosDeletedAt: photosDeletedAt(box),
    expiresAt: iso(box.expires_at),
  })
}

async function openBox(request: Request, slug: string) {
  if (!SLUG.test(slug)) throw boxNotFound()
  const rows = check(await db().rpc('open_box', { p_slug: slug })) as BoxRow[]
  const box = rows[0]
  if (!box) throw boxNotFound()
  // open_box() mengisi opened_at begitu opens_at lewat menurut jam database, jadi itu yang
  // dipakai, bukan jam fungsi.
  if (!box.opened_at) throw new ApiError(409, 'box_not_open', 'kotak belum bisa dibuka')
  return json(request, 200, {
    openedAt: iso(box.opened_at),
    photosExpireAt: iso(box.photos_expire_at),
  })
}

Deno.serve(serve(async (request, path) => {
  const method = request.method
  const open = path.match(/^\/k\/([^/]+)\/open$/)
  if (open && method === 'POST') return await openBox(request, open[1])
  const one = path.match(/^\/k\/([^/]+)$/)
  if (one && method === 'GET') return await getBox(request, one[1])
  throw notFound('endpoint tidak ada')
}))
