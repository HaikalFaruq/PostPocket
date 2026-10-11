// Fungsi `l`: GET /l/{slug} dan POST /l/{slug}/open untuk halaman penerima.
// Kontrak: docs/api/openapi.yaml.

import { type AssetRow, assetUrl, check, db, type LetterRow } from '../_shared/db.ts'
import { json, notFound, serve } from '../_shared/http.ts'

const SLUG = /^[A-Za-z0-9]{10}$/

const iso = (value: string | null) => (value === null ? null : new Date(value).toISOString())

/** Surat yang sudah terbit dan belum kedaluwarsa. Draf dan surat lewat 30 hari jadi 404. */
async function sentLetter(slug: string): Promise<LetterRow> {
  if (!SLUG.test(slug)) throw notFound()
  const rows = check(
    await db().from('letters').select('*').eq('slug', slug).eq('status', 'sent')
      .gt('expires_at', new Date().toISOString()).limit(1),
  ) as LetterRow[]
  if (!rows[0]) throw notFound('surat tidak ada atau sudah kedaluwarsa')
  return rows[0]
}

async function getLetter(request: Request, slug: string) {
  const letter = await sentLetter(slug)
  const [assets, replies] = await Promise.all([
    db().from('letter_assets').select('*').eq('letter_id', letter.id).not(
      'uploaded_at',
      'is',
      null,
    ),
    letter.reply_to_id
      ? db().from('letters').select('slug').eq('id', letter.reply_to_id).eq('status', 'sent')
        .gt('expires_at', new Date().toISOString()).limit(1)
      : Promise.resolve({ data: [], error: null }),
  ])
  const files = check(assets) as AssetRow[]
  const asset = (file?: AssetRow) =>
    file ? { url: assetUrl(file.storage_path), width: file.width, height: file.height } : null
  return json(request, 200, {
    slug: letter.slug,
    design: letter.design,
    content: letter.content,
    cover: asset(files.find((file) => file.kind === 'cover')),
    photos: Object.fromEntries(
      files.filter((file) => file.kind === 'photo').map((file) => [file.key, asset(file)]),
    ),
    og: asset(files.find((file) => file.kind === 'og')),
    replyTo: (check(replies) as { slug: string }[])[0]?.slug ?? null,
    publishedAt: iso(letter.published_at),
    expiresAt: iso(letter.expires_at),
    openedAt: iso(letter.opened_at),
    photosExpireAt: iso(letter.photos_expire_at),
    photosDeletedAt: iso(letter.photos_deleted_at),
  })
}

async function openLetter(request: Request, slug: string) {
  if (!SLUG.test(slug)) throw notFound()
  const rows = check(
    await db().rpc('open_letter', { p_slug: slug }).select('opened_at, photos_expire_at'),
  ) as Pick<LetterRow, 'opened_at' | 'photos_expire_at'>[]
  if (!rows[0]) throw notFound('surat tidak ada atau sudah kedaluwarsa')
  return json(request, 200, {
    openedAt: iso(rows[0].opened_at),
    photosExpireAt: iso(rows[0].photos_expire_at),
  })
}

Deno.serve(serve(async (request, path) => {
  const method = request.method
  const open = path.match(/^\/l\/([^/]+)\/open$/)
  if (open && method === 'POST') return await openLetter(request, open[1])
  const one = path.match(/^\/l\/([^/]+)$/)
  if (one && method === 'GET') return await getLetter(request, one[1])
  throw notFound('endpoint tidak ada')
}))
