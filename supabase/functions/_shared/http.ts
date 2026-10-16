// Respons, CORS, dan pemeriksaan apikey yang sama untuk fungsi `letters`, `l`, `boxes`, `k`, dan
// `account`.
// Aturannya ada di docs/api/openapi.yaml bagian CORS dan Error.

import { logError, recordError, routePattern } from './errors.ts'

export type ErrorCode =
  | 'invalid_request'
  | 'invalid_design'
  | 'invalid_content'
  | 'photo_mismatch'
  | 'cover_mismatch'
  | 'reply_not_found'
  | 'upload_missing'
  | 'upload_invalid'
  | 'unauthorized'
  | 'not_found'
  | 'rate_limited'
  | 'internal'
  // Kontrak 0.3.0 (kotak bareng).
  | 'og_mismatch'
  | 'invalid_box'
  | 'box_not_found'
  | 'box_closed'
  | 'box_full'
  | 'box_not_open'

export interface ErrorDetail {
  path: string
  message: string
}

// Hanya domain produksi. Tanpa localhost: stack lokal (Kong) sudah menjawab
// `access-control-allow-origin: *`, jadi `pnpm dev` ke stack lokal tetap jalan. Tanpa preview
// Vercel: nama <proyek>.vercel.app bisa didaftarkan siapa saja, jadi pola preview bisa diklaim
// orang lain, dan preview cukup memakai mock API.
const ORIGINS = new Set(['https://postpocket.vercel.app'])

/** Origin frontend yang diizinkan, atau `null`. */
export function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  if (!origin) return null
  return ORIGINS.has(origin) ? origin : null
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({ vary: 'Origin' })
  const origin = allowedOrigin(request)
  if (origin) {
    headers.set('access-control-allow-origin', origin)
    // Supaya klien bisa membaca Retry-After dari respons 429.
    headers.set('access-control-expose-headers', 'retry-after')
  }
  return headers
}

function preflight(request: Request): Response {
  const headers = corsHeaders(request)
  headers.set('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  headers.set(
    'access-control-allow-headers',
    'apikey, authorization, content-type, x-client-info, x-edit-token',
  )
  headers.set('access-control-max-age', '86400')
  return new Response(null, { status: 204, headers })
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
    readonly headers?: Record<string, string>,
  ) {
    super(message)
  }
}

export function json(request: Request, status: number, body: unknown, extra?: HeadersInit) {
  const headers = corsHeaders(request)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  headers.set('x-content-type-options', 'nosniff')
  new Headers(extra).forEach((value, name) => headers.set(name, value))
  return new Response(JSON.stringify(body), { status, headers })
}

export function empty(request: Request, status: number) {
  const headers = corsHeaders(request)
  headers.set('cache-control', 'no-store')
  return new Response(null, { status, headers })
}

function errorResponse(request: Request, error: ApiError) {
  const body = error.details?.length
    ? { code: error.code, message: error.message, details: error.details }
    : { code: error.code, message: error.message }
  return json(request, error.status, { error: body }, error.headers)
}

/** Publishable key yang dipakai proyek ini, dari env yang disediakan Supabase. */
function publishableKeys(): string[] {
  const many = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (many) return Object.values(JSON.parse(many) as Record<string, string>)
  const one = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  return one ? [one] : []
}

/**
 * Bungkus handler: jawab preflight, tolak request tanpa publishable key yang benar, dan ubah
 * `ApiError` atau error tak terduga jadi respons dengan bentuk skema `Error`.
 */
export function serve(handler: (request: Request, path: string) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return preflight(request)
    // Di Supabase path-nya diawali nama fungsi, misalnya /letters/<id>/publish.
    const path = new URL(request.url).pathname.replace(/\/+$/, '')
    try {
      const apikey = request.headers.get('apikey')
      if (!apikey || !publishableKeys().includes(apikey)) {
        throw new ApiError(
          401,
          'unauthorized',
          'header apikey tidak ada atau bukan publishable key',
        )
      }
      return await handler(request, path)
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(request, error)
      logError(`kesalahan server di ${routePattern(path)}`, error)
      recordError(path, 500, error)
      return errorResponse(request, new ApiError(500, 'internal', 'kesalahan server'))
    }
  }
}

export function notFound(message = 'surat tidak ada'): ApiError {
  return new ApiError(404, 'not_found', message)
}

/**
 * Body JSON dengan batas ukuran. Isi surat paling banyak sekitar 25 KB. Body dibaca bertahap dan
 * dihentikan begitu lewat batas, supaya body raksasa tidak dimuat utuh ke memori worker.
 */
export async function readJson(request: Request, limit = 100_000): Promise<unknown> {
  const tooLarge = () => new ApiError(400, 'invalid_request', 'body terlalu besar')
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw tooLarge()
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request.body ?? []) {
    size += chunk.length
    if (size > limit) throw tooLarge()
    chunks.push(chunk)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  const text = new TextDecoder().decode(bytes)
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(400, 'invalid_request', 'body bukan JSON yang valid')
  }
}
