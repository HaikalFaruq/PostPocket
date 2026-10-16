// Fungsi `letters`: POST /letters, POST /letters/{id}/publish, DELETE /letters/{id}.
// Kontrak: docs/api/openapi.yaml. Surat titipan kotak bareng (0.3.0) lewat jalur yang sama.

import {
  BOX_LIMITS,
  boxError,
  boxLetters,
  boxReceipt,
  inviteUrl,
  liveBox,
  usage,
} from '../_shared/box.ts'
import {
  type AssetRow,
  type BoxRow,
  BUCKET,
  check,
  db,
  type LetterRow,
  siteUrl,
  toPublic,
  UUID,
} from '../_shared/db.ts'
import { deleteLetters } from '../_shared/files.ts'
import { ApiError, empty, json, notFound, readJson, serve } from '../_shared/http.ts'
import { imageInfo, type ImageType, stripMetadata } from '../_shared/image.ts'
import { type RateLimit, takeRateLimit } from '../_shared/rate-limit.ts'
import { bytea, newEditToken, newSlug, sameHash, sha256 } from '../_shared/token.ts'
import { type FileMeta, parseCreateRequest } from '../_shared/validate.ts'

/** Batas pembuatan surat per IP (docs/backend.md, Keamanan). */
const RATE_LIMIT: RateLimit = {
  bucket: 'create_letter',
  limit: 10,
  window: '1 hour',
  message: 'terlalu banyak surat dari IP ini',
}
/**
 * Surat titipan punya bucket sendiri, per IP lintas kotak: teman-teman satu Wi-Fi tetap muat
 * satu kotak penuh (20), tapi satu IP tidak bisa menimbun draf di banyak kotak.
 */
const BOX_RATE_LIMIT: RateLimit = { ...RATE_LIMIT, bucket: 'box_letter', limit: 30 }

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

/** Surat biasa yang masih berlaku. Surat titipan dianggap tidak ada, sama seperti di `l`. */
async function letterIdOf(slug: string): Promise<string | null> {
  const rows = check(
    await db().from('letters').select('id').eq('slug', slug).eq('status', 'sent')
      .is('box_id', null).gt('expires_at', new Date().toISOString()).limit(1),
  ) as { id: string }[]
  return rows[0]?.id ?? null
}

/** Kotak tujuan surat titipan, kalau masih menerima titipan dan surat ini masih muat. */
async function boxForEntry(invite: string, photos: number): Promise<BoxRow> {
  const box = await liveBox('invite', invite)
  if (!box) throw new ApiError(422, 'box_not_found', 'kode titip tidak ada')
  if (Date.parse(box.opens_at) <= Date.now()) {
    throw new ApiError(422, 'box_closed', 'kotak sudah ditutup untuk titipan')
  }
  const used = usage(await boxLetters(box.id))
  if (used.letters + 1 > BOX_LIMITS.letters || used.photos + photos > BOX_LIMITS.photos) {
    throw new ApiError(422, 'box_full', 'kotak sudah penuh')
  }
  return box
}

async function createLetter(request: Request) {
  const body = parseCreateRequest(await readJson(request))
  let replyToId: string | null = null
  if (body.replyTo != null) {
    replyToId = await letterIdOf(body.replyTo)
    if (!replyToId) throw new ApiError(422, 'reply_not_found', 'replyTo tidak ditemukan')
  }
  const box = body.box
    ? await boxForEntry(body.box.invite, body.photos.length + (body.cover ? 1 : 0))
    : null
  await takeRateLimit(request, box ? BOX_RATE_LIMIT : RATE_LIMIT)

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
    // Surat titipan tidak punya gambar OG.
    ...(body.og ? [asset('og', body.og)] : []),
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
      p_box_id: box?.id ?? null,
      p_from_name: body.box?.from ?? null,
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
      og: of('og')[0]?.target ?? null,
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

type Published = Pick<LetterRow, 'slug' | 'published_at' | 'expires_at' | 'box_id'>

/**
 * Respons publish. Untuk surat titipan, link-nya link titip kotak dan masa berlakunya ikut
 * kotak (bisa bergeser selama kotak belum dibuka), plus ringkasan kotaknya.
 */
async function published(request: Request, letter: Published) {
  const base = {
    slug: letter.slug,
    url: `${siteUrl(request)}/l/${letter.slug}`,
    publishedAt: new Date(letter.published_at!).toISOString(),
    expiresAt: new Date(letter.expires_at!).toISOString(),
  }
  if (!letter.box_id) return base
  const box = (check(
    await db().from('boxes').select('*').eq('id', letter.box_id).limit(1),
  ) as BoxRow[])[0]!
  return {
    ...base,
    url: inviteUrl(request, box),
    expiresAt: new Date(box.expires_at).toISOString(),
    box: boxReceipt(box),
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
  if (letter.status === 'sent') return json(request, 409, await published(request, letter))
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
      p_max_letters: BOX_LIMITS.letters,
      p_max_photos: BOX_LIMITS.photos,
    }).select('slug, published_at, expires_at, box_id')
    // Slug bentrok (sangat jarang): coba slug lain.
    if ((error as { code?: string } | null)?.code === '23505') continue
    // Kotak sudah terbuka atau penuh (dicek ulang dengan baris kotak terkunci).
    const rejected = boxError(error, 422)
    if (rejected) throw rejected
    const rows = check({ data, error }) as Published[]
    if (rows[0]) return json(request, 200, await published(request, rows[0]))
    // Publish lain menang duluan.
    const latest = await ownedLetter(request, id)
    if (latest.status === 'sent') return json(request, 409, await published(request, latest))
    throw notFound()
  }
  throw new Error('Gagal membuat slug unik')
}

async function deleteLetter(request: Request, id: string) {
  await ownedLetter(request, id)
  await deleteLetters([id])
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
