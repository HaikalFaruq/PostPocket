import { randomBytes, randomUUID } from 'node:crypto'
import {
  contentLimits,
  contentPhotoKeys,
  letter,
  type LetterContent,
  type LetterDesign,
} from '@postpocket/presets'
import type { H3Event } from 'h3'

// Mock API surat untuk development dan E2E, mengikuti docs/api/openapi.yaml. Hanya aktif kalau
// NUXT_MOCK_API=1. Datanya di memori proses, jadi hilang saat server dimatikan. Bentuk body
// diperiksa langsung dengan skema kontrak (lihat contract.ts); yang dicek di sini hanya isinya.

const DAY = 24 * 60 * 60 * 1000

interface FileMeta {
  type: string
  width: number
  height: number
  size: number
}

/** Body `POST /letters` yang sudah lolos skema `CreateLetterRequest`. */
interface CreateBody {
  design: LetterDesign
  content: LetterContent
  cover?: FileMeta | null
  photos: (FileMeta & { key: string })[]
  og?: FileMeta | null
  replyTo?: string | null
  /** Surat titipan kotak bareng (kontrak 0.3.0). */
  box?: { invite: string; from: string } | null
}

export interface MockFile {
  kind: 'cover' | 'photo' | 'og'
  key?: string
  path: string
  token: string
  type: string
  width: number
  height: number
  size: number
}

export interface MockLetter {
  id: string
  editToken: string
  slug: string | null
  design: LetterDesign
  content: LetterContent
  replyTo: string | null
  /** Kotak bareng tempat surat ini dititip, dan nama pengirimnya. */
  boxId: string | null
  from: string | null
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
export function fail(
  event: H3Event,
  status: number,
  code: string,
  message: string,
  details?: { path: string; message: string }[],
) {
  setResponseStatus(event, status)
  return { error: details?.length ? { code, message, details } : { code, message } }
}

function slugOf(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(randomBytes(10), (byte) => alphabet[byte % alphabet.length]).join('')
}

const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString())

function validDesign(design: LetterDesign): boolean {
  const has = (list: readonly { id: string }[], id: string) => list.some((item) => item.id === id)
  const upload = design.illustration === 'upload'
  return (
    (upload || has(letter.illustrations, design.illustration)) &&
    has(letter.shapes, design.shape) &&
    has(letter.foilModes, design.foilMode) &&
    !(upload && design.foilMode === 'design') &&
    has(letter.foilColors, design.foilColor) &&
    has(letter.papers, design.paper) &&
    has(letter.templates, design.template)
  )
}

/** Aturan isi di deskripsi kontrak yang tidak bisa ditulis sebagai skema. */
function validContent(content: LetterContent): boolean {
  const ids = new Set(content.elements.map((element) => element.id))
  const counts = { text: 0, photo: 0, sticker: 0 }
  for (const element of content.elements) counts[element.kind]++
  const photos = contentPhotoKeys(content)
  return (
    ids.size === content.elements.length &&
    new Set(photos).size === photos.length &&
    counts.text <= contentLimits.text &&
    counts.photo <= contentLimits.photo &&
    counts.sticker <= contentLimits.sticker &&
    content.elements.every((element) => element.kind !== 'text' || element.text.trim() !== '') &&
    content.elements.every(
      (element) =>
        element.kind !== 'sticker' || letter.stickers.some((item) => item.id === element.sticker),
    )
  )
}

/** Foto dan cover di surat, yang dihitung ke batas foto kotak bareng. */
export function photoCount(item: { cover?: unknown; photos: unknown[] }): number {
  return item.photos.length + (item.cover ? 1 : 0)
}

/** Body yang bentuknya sudah sesuai skema tapi isinya ditolak (422). */
function unprocessable(body: CreateBody): [string, string] | null {
  if (!validDesign(body.design)) return ['invalid_design', 'design tidak sesuai preset']
  if (!validContent(body.content)) return ['invalid_content', 'content melanggar batas isi surat']
  const keys = body.photos.map((photo) => photo.key)
  const wanted = contentPhotoKeys(body.content)
  const sameKeys =
    new Set(keys).size === keys.length &&
    keys.length === wanted.length &&
    wanted.every((key) => keys.includes(key))
  if (!sameKeys) return ['photo_mismatch', 'photos[].key tidak sama dengan content']
  if ((body.design.illustration === 'upload') !== (body.cover != null)) {
    return ['cover_mismatch', 'cover wajib hanya kalau illustration = upload']
  }
  if (body.box) {
    if (body.og != null) return ['og_mismatch', 'surat titipan tidak punya og']
    if (body.replyTo != null) return ['invalid_box', 'surat titipan tidak bisa jadi balasan']
    return boxEntryProblem(body.box.invite, photoCount(body))
  }
  if (body.og == null) return ['og_mismatch', 'og wajib untuk surat biasa']
  // Slug surat titipan dianggap tidak ada, sama seperti di GET /l/{slug}.
  if (body.replyTo != null && !sentLetter(body.replyTo)) {
    return ['reply_not_found', 'replyTo tidak ditemukan']
  }
  return null
}

export async function createMockLetter(event: H3Event, raw: unknown) {
  const validate = (await useContract())('CreateLetterRequest')
  if (!validate(raw)) {
    const details = contractDetails(validate.errors)
    const where = details[0]?.path ?? ''
    const code = where.startsWith('design')
      ? 'invalid_design'
      : where.startsWith('content')
        ? 'invalid_content'
        : 'invalid_request'
    return fail(event, 400, code, 'body tidak sesuai skema CreateLetterRequest', details)
  }
  const body = raw as CreateBody
  const problem = unprocessable(body)
  if (problem) return fail(event, 422, problem[0], problem[1])
  const id = randomUUID()
  const origin = getRequestURL(event).origin
  const target = (file: Omit<MockFile, 'path' | 'token'>): MockFile => ({
    ...file,
    path: `${id}/${randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`,
    token: randomBytes(12).toString('hex'),
  })
  const files: MockFile[] = []
  if (body.cover) files.push(target({ kind: 'cover', ...body.cover }))
  for (const photo of body.photos) files.push(target({ kind: 'photo', ...photo }))
  if (body.og) files.push(target({ kind: 'og', ...body.og }))
  const draft: MockLetter = {
    id,
    editToken: randomBytes(24).toString('base64url'),
    slug: null,
    design: body.design,
    content: body.content,
    replyTo: body.replyTo ?? null,
    boxId: body.box ? boxIdForInvite(body.box.invite) : null,
    from: body.box ? body.box.from.trim() : null,
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
  const og = files.find((file) => file.kind === 'og')
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
      og: og ? uploadTarget(og) : null,
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
  if (item.boxId) {
    // Surat titipan: link-nya link titip kotak, dan masa berlakunya ikut kotak.
    const box = boxReceipt(item.boxId, origin)
    return {
      slug: item.slug,
      url: box.inviteUrl,
      publishedAt: iso(item.publishedAt),
      expiresAt: box.expiresAt,
      box: box.receipt,
    }
  }
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
  if (found.boxId) {
    const problem = boxPublishProblem(found.boxId, photoCount(filesAsBody(found)))
    if (problem) return fail(event, 422, problem[0], problem[1])
  }
  found.slug = slugOf()
  found.publishedAt = Date.now()
  slugs.set(found.slug, found.id)
  return published(found, origin)
}

export function deleteMockLetter(event: H3Event, id: string) {
  const found = editable(event, id)
  if ('error' in found) return found.error
  removeMockLetter(id)
  setResponseStatus(event, 204)
  return null
}

/** Hapus surat beserta berkasnya, tanpa cek token. Dipakai juga kotak bareng. */
export function removeMockLetter(id: string) {
  const found = letters.get(id)
  if (!found) return
  for (const file of found.files) blobs.delete(file.path)
  if (found.slug) slugs.delete(found.slug)
  letters.delete(id)
}

/** Berkas surat dalam bentuk yang dihitung `photoCount()`. */
function filesAsBody(item: MockLetter) {
  return {
    cover: item.files.find((file) => file.kind === 'cover'),
    photos: item.files.filter((file) => file.kind === 'photo'),
  }
}

/** Semua surat titipan kotak bareng, termasuk draf yang belum terbit. */
export function boxLettersWithDrafts(boxId: string): MockLetter[] {
  return [...letters.values()].filter((item) => item.boxId === boxId)
}

/** Surat titipan kotak bareng yang sudah terbit, urut waktu terbit. */
export function boxLetters(boxId: string): MockLetter[] {
  return [...letters.values()]
    .filter((item) => item.boxId === boxId && item.publishedAt)
    .sort((a, b) => a.publishedAt! - b.publishedAt!)
}

/** Foto dan cover di surat titipan yang sudah terbit. */
export function boxLetterPhotos(item: MockLetter): number {
  return photoCount(filesAsBody(item))
}

/** URL publik berkas yang masih ada, seperti URL publik bucket `letter-assets`. */
export function mockAsset(file: MockFile | undefined, origin: string) {
  return file && blobs.has(file.path)
    ? { url: `${origin}/mock-api/assets/${file.path}`, width: file.width, height: file.height }
    : null
}

/** Hapus foto dan cover dari foto user, seperti job pembersihan 7 hari setelah dibuka. */
export function dropMockPhotos(item: MockLetter) {
  const withCover = item.design.illustration === 'upload'
  for (const file of item.files) {
    if (file.kind === 'photo' || withCover) blobs.delete(file.path)
  }
}

// Surat titipan hanya dibaca lewat kotaknya (GET /k/{slug}), jadi 404 di /l/{slug}.
function sentLetter(slug: string): MockLetter | undefined {
  const found = letters.get(slugs.get(slug) ?? '')
  if (!found?.publishedAt || found.boxId || Date.now() > found.publishedAt + 30 * DAY) {
    return undefined
  }
  return found
}

export function getMockLetter(event: H3Event, slug: string) {
  const found = sentLetter(slug)
  if (!found) return fail(event, 404, 'not_found', 'surat tidak ada atau sudah kedaluwarsa')
  const origin = getRequestURL(event).origin
  const asset = (file?: MockFile) => mockAsset(file, origin)
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
    replyTo: found.replyTo && sentLetter(found.replyTo) ? found.replyTo : null,
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
  dropMockPhotos(found)
  found.photosDeletedAt = Date.now()
  return { photosDeletedAt: iso(found.photosDeletedAt) }
}
