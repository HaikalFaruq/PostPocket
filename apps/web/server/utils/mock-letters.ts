import { randomBytes, randomUUID } from 'node:crypto'
import {
  contentLimits,
  contentPhotoKeys,
  letter,
  normalizeContent,
  type LetterContent,
  type LetterDesign,
} from '@postpocket/presets'
import type { H3Event } from 'h3'

// Mock API surat untuk development dan E2E, mengikuti docs/api/openapi.yaml. Hanya aktif kalau
// NUXT_MOCK_API=1. Datanya di memori proses, jadi hilang saat server dimatikan.

const DAY = 24 * 60 * 60 * 1000

interface MockFile {
  kind: 'cover' | 'photo' | 'og'
  key?: string
  path: string
  token: string
  type: string
  width: number
  height: number
  size: number
}

interface MockLetter {
  id: string
  editToken: string
  slug: string | null
  design: LetterDesign
  content: LetterContent
  replyTo: string | null
  files: MockFile[]
  draftExpiresAt: number
  publishedAt: number | null
  openedAt: number | null
  photosDeletedAt: number | null
}

const letters = new Map<string, MockLetter>()
const slugs = new Map<string, string>()
const blobs = new Map<string, { type: string; bytes: Buffer }>()

export function assertMockEnabled(event: H3Event) {
  if (!useRuntimeConfig(event).mockApi) throw createError({ statusCode: 404 })
}

/** Respons error dengan bentuk skema `Error` di kontrak. */
export function fail(event: H3Event, status: number, code: string, message: string) {
  setResponseStatus(event, status)
  return { error: { code, message } }
}

function slugOf(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(randomBytes(10), (byte) => alphabet[byte % alphabet.length]).join('')
}

const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString())

function isImageMeta(value: unknown, types: string[], maxSide: number, maxSize: number) {
  if (!value || typeof value !== 'object') return false
  const meta = value as Record<string, unknown>
  return (
    types.includes(meta.type as string) &&
    Number.isInteger(meta.width) &&
    Number.isInteger(meta.height) &&
    Number.isInteger(meta.size) &&
    (meta.width as number) >= 1 &&
    (meta.height as number) >= 1 &&
    (meta.width as number) <= maxSide &&
    (meta.height as number) <= maxSide &&
    (meta.size as number) >= 1 &&
    (meta.size as number) <= maxSize
  )
}

function validDesign(value: unknown): value is LetterDesign {
  if (!value || typeof value !== 'object') return false
  const design = value as Record<string, unknown>
  const has = (list: readonly { id: string }[], id: unknown) =>
    typeof id === 'string' && list.some((item) => item.id === id)
  const upload = design.illustration === 'upload'
  return (
    (upload || has(letter.illustrations, design.illustration)) &&
    has(letter.shapes, design.shape) &&
    has(letter.foilModes, design.foilMode) &&
    !(upload && design.foilMode === 'design') &&
    typeof design.foilBorder === 'boolean' &&
    has(letter.foilColors, design.foilColor) &&
    has(letter.papers, design.paper) &&
    has(letter.templates, design.template)
  )
}

/** Validasi `POST /letters`. Mengembalikan kode error kontrak, atau `null` kalau lolos. */
function invalid(body: Record<string, unknown>): [string, string] | null {
  if (!validDesign(body.design)) return ['invalid_design', 'design tidak sesuai preset']
  const content = normalizeContent(body.content)
  const exact = JSON.stringify(content) === JSON.stringify(body.content)
  const filled = content.elements.every((element) =>
    element.kind === 'photo'
      ? element.photo !== null
      : element.kind !== 'text' || element.text.trim() !== '',
  )
  if (!exact || !filled) return ['invalid_content', 'content tidak sesuai skema']
  const photos = Array.isArray(body.photos) ? (body.photos as Record<string, unknown>[]) : null
  if (!photos || photos.length > contentLimits.photo) return ['invalid_request', 'photos']
  const keys = photos.map((photo) => photo.key)
  const wanted = contentPhotoKeys(content)
  const sameKeys =
    new Set(keys).size === keys.length &&
    keys.length === wanted.length &&
    wanted.every((key) => keys.includes(key))
  if (!sameKeys) return ['photo_mismatch', 'photos[].key tidak sama dengan content']
  const photoTypes = ['image/jpeg', 'image/webp']
  if (!photos.every((photo) => isImageMeta(photo, photoTypes, 2048, 500_000))) {
    return ['invalid_request', 'metadata foto']
  }
  const needsCover = (body.design as LetterDesign).illustration === 'upload'
  if (needsCover !== (body.cover !== null && body.cover !== undefined)) {
    return ['cover_mismatch', 'cover wajib hanya kalau illustration = upload']
  }
  if (needsCover && !isImageMeta(body.cover, photoTypes, 2048, 500_000)) {
    return ['invalid_request', 'metadata cover']
  }
  const og = body.og as Record<string, unknown> | undefined
  const ogOk =
    isImageMeta(og, ['image/jpeg', 'image/png'], 1200, 300_000) &&
    og?.width === 1200 &&
    og?.height === 630
  if (!ogOk) return ['invalid_request', 'metadata og']
  const reply = body.replyTo
  if (reply !== null && reply !== undefined && !(typeof reply === 'string' && slugs.has(reply))) {
    return ['reply_not_found', 'replyTo tidak ditemukan']
  }
  return null
}

export function createMockLetter(event: H3Event, body: Record<string, unknown>) {
  const problem = invalid(body)
  if (problem) return fail(event, 422, problem[0], problem[1])
  const id = randomUUID()
  const origin = getRequestURL(event).origin
  const target = (file: Omit<MockFile, 'path' | 'token'>): MockFile => ({
    ...file,
    path: `${id}/${randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`,
    token: randomBytes(12).toString('hex'),
  })
  const files: MockFile[] = []
  if (body.cover)
    files.push(
      target({ kind: 'cover', ...(body.cover as Omit<MockFile, 'kind' | 'path' | 'token'>) }),
    )
  for (const photo of body.photos as (Omit<MockFile, 'kind' | 'path' | 'token'> & {
    key: string
  })[]) {
    files.push(target({ ...photo, kind: 'photo' }))
  }
  files.push(target({ kind: 'og', ...(body.og as Omit<MockFile, 'kind' | 'path' | 'token'>) }))
  const draft: MockLetter = {
    id,
    editToken: randomBytes(24).toString('base64url'),
    slug: null,
    design: body.design as LetterDesign,
    content: body.content as LetterContent,
    replyTo: (body.replyTo as string | null | undefined) ?? null,
    files,
    draftExpiresAt: Date.now() + DAY,
    publishedAt: null,
    openedAt: null,
    photosDeletedAt: null,
  }
  letters.set(id, draft)
  const uploadTarget = (file: MockFile) => ({
    path: file.path,
    token: file.token,
    signedUrl: `${origin}/mock-api/upload/${file.path}?token=${file.token}`,
  })
  const cover = files.find((file) => file.kind === 'cover')
  setResponseStatus(event, 201)
  return {
    id,
    editToken: draft.editToken,
    draftExpiresAt: iso(draft.draftExpiresAt),
    uploads: {
      cover: cover ? uploadTarget(cover) : null,
      photos: Object.fromEntries(
        files.filter((file) => file.kind === 'photo').map((file) => [file.key, uploadTarget(file)]),
      ),
      og: uploadTarget(files.find((file) => file.kind === 'og')!),
    },
  }
}

export function storeMockUpload(path: string, token: string, type: string, bytes: Buffer) {
  const file = [...letters.values()].flatMap((item) => item.files).find((f) => f.path === path)
  if (!file || file.token !== token) return false
  blobs.set(path, { type, bytes })
  return true
}

export function readMockUpload(path: string) {
  return blobs.get(path)
}

function editable(event: H3Event, id: string): MockLetter | { error: unknown } {
  const found = letters.get(id)
  if (!found) return { error: fail(event, 404, 'not_found', 'surat tidak ada') }
  if (getHeader(event, 'x-edit-token') !== found.editToken) {
    return { error: fail(event, 401, 'unauthorized', 'X-Edit-Token tidak cocok') }
  }
  return found
}

function published(item: MockLetter, origin: string) {
  return {
    slug: item.slug,
    url: `${origin}/l/${item.slug}`,
    publishedAt: iso(item.publishedAt),
    expiresAt: iso(item.publishedAt! + 30 * DAY),
  }
}

export function publishMockLetter(event: H3Event, id: string) {
  const found = editable(event, id)
  if ('error' in found) return found.error
  const origin = getRequestURL(event).origin
  if (found.slug) {
    setResponseStatus(event, 409)
    return published(found, origin)
  }
  for (const file of found.files) {
    const stored = blobs.get(file.path)
    if (!stored) return fail(event, 422, 'upload_missing', `${file.kind} belum diunggah`)
    if (stored.bytes.length !== file.size) {
      return fail(event, 422, 'upload_invalid', `${file.kind} tidak sesuai metadata`)
    }
  }
  found.slug = slugOf()
  found.publishedAt = Date.now()
  slugs.set(found.slug, found.id)
  return published(found, origin)
}

export function deleteMockLetter(event: H3Event, id: string) {
  const found = editable(event, id)
  if ('error' in found) return found.error
  for (const file of found.files) blobs.delete(file.path)
  if (found.slug) slugs.delete(found.slug)
  letters.delete(id)
  setResponseStatus(event, 204)
  return null
}

function sentLetter(slug: string): MockLetter | undefined {
  const found = letters.get(slugs.get(slug) ?? '')
  if (!found?.publishedAt || Date.now() > found.publishedAt + 30 * DAY) return undefined
  return found
}

export function getMockLetter(event: H3Event, slug: string) {
  const found = sentLetter(slug)
  if (!found) return fail(event, 404, 'not_found', 'surat tidak ada atau sudah kedaluwarsa')
  const origin = getRequestURL(event).origin
  const asset = (file?: MockFile) =>
    file && blobs.has(file.path)
      ? { url: `${origin}/mock-api/assets/${file.path}`, width: file.width, height: file.height }
      : null
  const photos = found.files.filter((file) => file.kind === 'photo' && blobs.has(file.path))
  const expireAt = found.openedAt
    ? Math.min(found.openedAt + 7 * DAY, found.publishedAt! + 30 * DAY)
    : null
  return {
    slug: found.slug,
    design: found.design,
    content: found.content,
    cover: asset(found.files.find((file) => file.kind === 'cover')),
    photos: Object.fromEntries(photos.map((file) => [file.key, asset(file)])),
    og: asset(found.files.find((file) => file.kind === 'og')),
    replyTo: found.replyTo && slugs.has(found.replyTo) ? found.replyTo : null,
    publishedAt: iso(found.publishedAt),
    expiresAt: iso(found.publishedAt! + 30 * DAY),
    openedAt: iso(found.openedAt),
    photosExpireAt: iso(expireAt),
    photosDeletedAt: iso(found.photosDeletedAt),
  }
}

export function openMockLetter(event: H3Event, slug: string) {
  const found = sentLetter(slug)
  if (!found) return fail(event, 404, 'not_found', 'surat tidak ada atau sudah kedaluwarsa')
  found.openedAt ??= Date.now()
  const expireAt = Math.min(found.openedAt + 7 * DAY, found.publishedAt! + 30 * DAY)
  return { openedAt: iso(found.openedAt), photosExpireAt: iso(expireAt) }
}

/**
 * Khusus uji: jalankan pembersihan "7 hari setelah dibuka" sekarang juga. Foto isi selalu
 * dihapus; cover dan gambar OG ikut dihapus kalau gambar depannya foto user.
 */
export function deleteMockPhotos(event: H3Event, slug: string) {
  const found = sentLetter(slug)
  if (!found) return fail(event, 404, 'not_found', 'surat tidak ada atau sudah kedaluwarsa')
  const withCover = found.design.illustration === 'upload'
  for (const file of found.files) {
    if (file.kind === 'photo' || withCover) blobs.delete(file.path)
  }
  found.photosDeletedAt = Date.now()
  return { photosDeletedAt: iso(found.photosDeletedAt) }
}
