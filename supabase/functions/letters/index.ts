// Fungsi `letters`: POST /letters, POST /letters/{id}/publish, DELETE /letters/{id}.
// Kontrak: docs/api/openapi.yaml.

import {
  type AssetRow,
  BUCKET,
  check,
  clientIp,
  db,
  type LetterRow,
  ok,
  secretKey,
  siteUrl,
  toPublic,
} from '../_shared/db.ts'
import { ApiError, empty, json, notFound, readJson, serve } from '../_shared/http.ts'
import { imageInfo, type ImageType, stripMetadata } from '../_shared/image.ts'
import { bytea, newEditToken, newSlug, rateKey, sameHash, sha256 } from '../_shared/token.ts'
import { type FileMeta, parseCreateRequest } from '../_shared/validate.ts'

/** Batas awal pembuatan surat, dievaluasi selama beta (docs/backend.md). */
const RATE_LIMIT = { bucket: 'create_letter', limit: 10, window: '1 hour' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
}

interface NewAsset {
  kind: 'photo' | 'cover' | 'og'
  key: string | null
  storage_path: string
  mime: string
  size: number
  width: number
  height: number
}

async function letterIdOf(slug: string): Promise<string | null> {
  const rows = check(
    await db().from('letters').select('id').eq('slug', slug).eq('status', 'sent')
      .gt('expires_at', new Date().toISOString()).limit(1),
  ) as { id: string }[]
  return rows[0]?.id ?? null
}

async function takeRateLimit(request: Request) {
  const key = await rateKey(clientIp(request), secretKey())
  const retryAfter = check(
    await db().rpc('take_rate_limit', {
      p_bucket: RATE_LIMIT.bucket,
      p_key: bytea(key),
      p_limit: RATE_LIMIT.limit,
      p_window: RATE_LIMIT.window,
    }),
  ) as number
  if (retryAfter > 0) {
    throw new ApiError(429, 'rate_limited', 'terlalu banyak surat dari IP ini', undefined, {
      'retry-after': String(retryAfter),
    })
  }
}

async function createLetter(request: Request) {
  const body = parseCreateRequest(await readJson(request))
  let replyToId: string | null = null
  if (body.replyTo != null) {
    replyToId = await letterIdOf(body.replyTo)
    if (!replyToId) throw new ApiError(422, 'reply_not_found', 'replyTo tidak ditemukan')
  }
  await takeRateLimit(request)

  const id = crypto.randomUUID()
  const asset = (kind: NewAsset['kind'], meta: FileMeta, key: string | null = null): NewAsset => ({
    kind,
    key,
    storage_path: `${id}/${crypto.randomUUID()}.${EXTENSIONS[meta.type]}`,
    mime: meta.type,
    size: meta.size,
    width: meta.width,
    height: meta.height,
  })
  const assets = [
    ...(body.cover ? [asset('cover', body.cover)] : []),
    ...body.photos.map((photo) => asset('photo', photo, photo.key)),
    asset('og', body.og),
  ]
  const editToken = newEditToken()
  const draftExpiresAt = check(
    await db().rpc('create_letter', {
      p_id: id,
      p_design: body.design,
      p_content: body.content,
      p_edit_token_hash: bytea(await sha256(editToken)),
      p_reply_to_id: replyToId,
      p_assets: assets,
    }),
  ) as string

  // URL upload berlaku 2 jam (bawaan Storage). Draf tanpa upload dibersihkan setelah 24 jam.
  const targets = await Promise.all(assets.map(async (item) => {
    const signed = check(
      await db().storage.from(BUCKET).createSignedUploadUrl(item.storage_path),
    )
    return {
      item,
      target: { path: signed.path, token: signed.token, signedUrl: toPublic(signed.signedUrl) },
    }
  }))
  const of = (kind: NewAsset['kind']) => targets.filter(({ item }) => item.kind === kind)

  return json(request, 201, {
    id,
    editToken,
    draftExpiresAt: new Date(draftExpiresAt).toISOString(),
    uploads: {
      cover: of('cover')[0]?.target ?? null,
      photos: Object.fromEntries(of('photo').map(({ item, target }) => [item.key, target])),
      og: of('og')[0]!.target,
    },
  })
}

/** Surat milik pemegang `X-Edit-Token`. 404 kalau tidak ada, 401 kalau tokennya salah. */
async function ownedLetter(request: Request, id: string): Promise<LetterRow> {
  if (!UUID.test(id)) throw notFound()
  const rows = check(await db().from('letters').select('*').eq('id', id).limit(1)) as LetterRow[]
  const letter = rows[0]
  if (!letter) throw notFound()
  const token = request.headers.get('x-edit-token')
  if (!token || !sameHash(await sha256(token), letter.edit_token_hash)) {
    throw new ApiError(401, 'unauthorized', 'X-Edit-Token tidak ada atau tidak cocok')
  }
  return letter
}

function published(
  request: Request,
  letter: Pick<LetterRow, 'slug' | 'published_at' | 'expires_at'>,
) {
  return {
    slug: letter.slug,
    url: `${siteUrl(request)}/l/${letter.slug}`,
    publishedAt: new Date(letter.published_at!).toISOString(),
    expiresAt: new Date(letter.expires_at!).toISOString(),
  }
}

/**
 * Cek satu berkas di Storage: ada, isinya sesuai tipe dan dimensi metadata, ukurannya sama.
 * Metadata yang tersisa dibuang dan berkasnya ditulis ulang. Mengembalikan ukuran akhir.
 */
async function verifyAsset(asset: AssetRow): Promise<number> {
  const storage = db().storage.from(BUCKET)
  const { data: blob, error } = await storage.download(asset.storage_path)
  if (error || !blob) {
    const status = error as { status?: number; statusCode?: string } | null
    if (status?.status === 400 || status?.status === 404 || status?.statusCode === '404') {
      throw new ApiError(
        422,
        'upload_missing',
        `${asset.kind} ${asset.key ?? ''} belum diunggah`.trim(),
      )
    }
    throw error
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const info = imageInfo(bytes)
  const label = `${asset.kind} ${asset.key ?? ''}`.trim()
  if (bytes.length !== asset.size) {
    throw new ApiError(
      422,
      'upload_invalid',
      `${label}: ukuran ${bytes.length}, metadata ${asset.size}`,
    )
  }
  if (
    !info || info.type !== asset.mime || info.width !== asset.width || info.height !== asset.height
  ) {
    throw new ApiError(422, 'upload_invalid', `${label}: isi berkas tidak sesuai metadata`)
  }
  const clean = stripMetadata(bytes, info.type as ImageType)
  // Ditulis ulang kalau ada metadata yang dibuang, atau content-type dari browser salah.
  if (clean !== bytes || blob.type !== asset.mime) {
    check(
      await storage.upload(asset.storage_path, clean, { contentType: asset.mime, upsert: true }),
    )
  }
  return clean.length
}

async function publishLetter(request: Request, id: string) {
  const letter = await ownedLetter(request, id)
  if (letter.status === 'sent') return json(request, 409, published(request, letter))
  if (Date.parse(letter.draft_expires_at) <= Date.now()) throw notFound('draf sudah kedaluwarsa')

  const assets = check(
    await db().from('letter_assets').select('*').eq('letter_id', id),
  ) as AssetRow[]
  const sizes = Object.fromEntries(
    await Promise.all(assets.map(async (asset) => [asset.storage_path, await verifyAsset(asset)])),
  )

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db().rpc('publish_letter', {
      p_id: id,
      p_slug: newSlug(),
      p_sizes: sizes,
    }).select('slug, published_at, expires_at')
    // Slug bentrok (sangat jarang): coba slug lain.
    if ((error as { code?: string } | null)?.code === '23505') continue
    const rows = check({ data, error }) as Pick<LetterRow, 'slug' | 'published_at' | 'expires_at'>[]
    if (rows[0]) return json(request, 200, published(request, rows[0]))
    // Publish lain menang duluan.
    const latest = await ownedLetter(request, id)
    if (latest.status === 'sent') return json(request, 409, published(request, latest))
    throw notFound()
  }
  throw new Error('Gagal membuat slug unik')
}

async function deleteLetter(request: Request, id: string) {
  await ownedLetter(request, id)
  const assets = check(
    await db().from('letter_assets').select('storage_path').eq('letter_id', id),
  ) as Pick<AssetRow, 'storage_path'>[]
  // Berkas dulu, baru baris: letter_assets memakai on delete restrict supaya tidak ada file yatim.
  if (assets.length) {
    check(await db().storage.from(BUCKET).remove(assets.map((asset) => asset.storage_path)))
  }
  ok(await db().from('letter_assets').delete().eq('letter_id', id))
  ok(await db().from('letters').delete().eq('id', id))
  return empty(request, 204)
}

Deno.serve(serve(async (request, path) => {
  const method = request.method
  if (path === '/letters' && method === 'POST') return await createLetter(request)
  const publish = path.match(/^\/letters\/([^/]+)\/publish$/)
  if (publish && method === 'POST') return await publishLetter(request, publish[1])
  const one = path.match(/^\/letters\/([^/]+)$/)
  if (one && method === 'DELETE') return await deleteLetter(request, one[1])
  throw notFound('endpoint tidak ada')
}))
