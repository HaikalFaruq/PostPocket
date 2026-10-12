import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js'
import letter from '../../../packages/presets/letter.json' with { type: 'json' }
import { contentLimits } from '../../../packages/presets/src/letter-content.ts'
import spec from './openapi.json' with { type: 'json' }
import { ApiError, type ErrorDetail } from './http.ts'

// Validasi body `POST /letters`. Bentuknya dicek langsung dengan skema dari
// docs/api/openapi.yaml (dibundel jadi openapi.json oleh `scripts/bundle-contract.sh`), lalu
// aturan isi yang tidak bisa ditulis sebagai skema dicek di bawah dengan preset yang sama
// dengan frontend.

export interface FileMeta {
  type: string
  width: number
  height: number
  size: number
}

export interface CreateLetterRequest {
  design: {
    illustration: string
    shape: string
    foilMode: string
    foilBorder: boolean
    foilColor: string
    paper: string
    template: string
  }
  content: {
    version: 1
    elements: (
      | { kind: 'text'; id: string; text: string }
      | { kind: 'photo'; id: string; photo: string }
      | { kind: 'sticker'; id: string; sticker: string }
    )[]
  }
  cover?: FileMeta | null
  photos: (FileMeta & { key: string })[]
  og: FileMeta
  replyTo?: string | null
}

const ajv = new Ajv2020({ allErrors: true, strict: false, verbose: true })
ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
ajv.addFormat('date-time', (value: string) => !Number.isNaN(Date.parse(value)))
ajv.addFormat('uri', (value: string) => URL.canParse(value))
ajv.addSchema({ $id: 'openapi', components: { schemas: spec.components.schemas } })
const validateCreate = ajv.getSchema('openapi#/components/schemas/CreateLetterRequest')!

interface KindSchema {
  const?: unknown
  properties?: { kind?: { const?: unknown } }
  allOf?: KindSchema[]
}

/** Error dari cabang `oneOf` untuk `kind` lain, misalnya cabang foto saat elemennya teks. */
function fromOtherKind(error: ErrorObject): boolean {
  const schema = error.parentSchema as KindSchema | undefined
  const onKind = error.instancePath.endsWith('/kind')
  const branch = onKind ? schema?.const : (schema?.properties?.kind?.const ??
    schema?.allOf?.find((part) => part.properties?.kind)?.properties?.kind?.const)
  if (branch === undefined) return false
  const actual = onKind ? error.data : (error.data as { kind?: unknown } | undefined)?.kind
  return actual !== branch
}

/**
 * Error ajv sebagai `details`, dengan path seperti `content.elements[2].size`. Sama dengan
 * `contractDetails()` di mock frontend, supaya pesan error mock dan backend asli serupa.
 */
export function contractDetails(errors: ErrorObject[] | null | undefined): ErrorDetail[] {
  const details = new Map<string, ErrorDetail>()
  for (const error of errors ?? []) {
    if (fromOtherKind(error)) continue
    const params = error.params as { additionalProperty?: string; unevaluatedProperty?: string }
    const extra = params.additionalProperty ?? params.unevaluatedProperty
    const parts = [...error.instancePath.split('/').slice(1), ...(extra ? [extra] : [])]
    const path = parts
      .map((part, i) => (/^\d+$/.test(part) ? `[${part}]` : `${i ? '.' : ''}${part}`))
      .join('') || '(body)'
    const message = error.message ?? 'tidak sesuai skema'
    details.set(`${path} ${message}`, { path, message })
  }
  return [...details.values()].slice(0, 10)
}

const has = (list: readonly { id: string }[], id: string) => list.some((item) => item.id === id)

function validDesign(design: CreateLetterRequest['design']): boolean {
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

/** Teks yang tidak bisa disimpan di `jsonb`: NUL atau surrogate yang terputus. */
function storable(text: string): boolean {
  return !text.includes('\u0000') && text.isWellFormed()
}

function contentProblem(content: CreateLetterRequest['content']): string | null {
  const ids = new Set<string>()
  const photos = new Set<string>()
  const counts = { text: 0, photo: 0, sticker: 0 }
  for (const element of content.elements) {
    if (ids.has(element.id)) return `id elemen ${element.id} dipakai lebih dari sekali`
    ids.add(element.id)
    counts[element.kind]++
    if (element.kind === 'text') {
      if (element.text.trim() === '') return `teks ${element.id} kosong`
      if (!storable(element.text)) return `teks ${element.id} memuat karakter yang tidak valid`
    }
    if (element.kind === 'photo') {
      if (photos.has(element.photo)) return `foto ${element.photo} dipakai lebih dari sekali`
      photos.add(element.photo)
    }
    if (element.kind === 'sticker' && !has(letter.stickers, element.sticker)) {
      return `stiker ${element.sticker} tidak ada di preset`
    }
  }
  for (const kind of ['text', 'photo', 'sticker'] as const) {
    if (counts[kind] > contentLimits[kind]) return `${kind} lebih dari ${contentLimits[kind]}`
  }
  return null
}

/** Kunci foto di `content`, sesuai urutan. */
export function photoKeys(content: CreateLetterRequest['content']): string[] {
  return content.elements.flatMap((element) => element.kind === 'photo' ? [element.photo] : [])
}

/**
 * Body `POST /letters` yang sudah lolos skema dan aturan isi. Bentuk salah jadi 400, isi
 * ditolak jadi 422. `replyTo` dicek terpisah karena butuh database.
 */
export function parseCreateRequest(raw: unknown): CreateLetterRequest {
  if (!validateCreate(raw)) {
    const details = contractDetails(validateCreate.errors)
    const where = details[0]?.path ?? ''
    const code = where.startsWith('design')
      ? 'invalid_design'
      : where.startsWith('content')
      ? 'invalid_content'
      : 'invalid_request'
    throw new ApiError(400, code, 'body tidak sesuai skema CreateLetterRequest', details)
  }
  const body = raw as CreateLetterRequest
  if (!validDesign(body.design)) {
    throw new ApiError(422, 'invalid_design', 'design tidak sesuai preset')
  }
  const problem = contentProblem(body.content)
  if (problem) throw new ApiError(422, 'invalid_content', problem)
  const keys = body.photos.map((photo) => photo.key)
  const wanted = photoKeys(body.content)
  const sameKeys = new Set(keys).size === keys.length && keys.length === wanted.length &&
    wanted.every((key) => keys.includes(key))
  if (!sameKeys) {
    throw new ApiError(422, 'photo_mismatch', 'photos[].key tidak sama dengan foto di content')
  }
  if ((body.design.illustration === 'upload') !== (body.cover != null)) {
    throw new ApiError(422, 'cover_mismatch', 'cover wajib hanya kalau illustration = upload')
  }
  return body
}
