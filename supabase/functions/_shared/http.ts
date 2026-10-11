// Respons, CORS, dan pemeriksaan apikey yang sama untuk fungsi `letters` dan `l`.
// Aturannya ada di docs/api/openapi.yaml bagian CORS dan Error.

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

export interface ErrorDetail {
  path: string
  message: string
}

const ORIGINS = new Set(['https://postpocket.vercel.app', 'http://localhost:3000'])
const PREVIEW = /^https:\/\/postpocket-[a-z0-9-]+-haikalfaruqs-projects\.vercel\.app$/

/** Origin frontend yang diizinkan, atau `null`. */
export function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  if (!origin) return null
  return ORIGINS.has(origin) || PREVIEW.test(origin) ? origin : null
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

export function preflight(request: Request): Response {
  const headers = corsHeaders(request)
  headers.set('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS')
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
    try {
      const apikey = request.headers.get('apikey')
      if (!apikey || !publishableKeys().includes(apikey)) {
        throw new ApiError(
          401,
          'unauthorized',
          'header apikey tidak ada atau bukan publishable key',
        )
      }
      // Di Supabase path-nya diawali nama fungsi, misalnya /letters/<id>/publish.
      const path = new URL(request.url).pathname.replace(/\/+$/, '')
      return await handler(request, path)
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(request, error)
      console.error(error)
      return errorResponse(request, new ApiError(500, 'internal', 'kesalahan server'))
    }
  }
}

export function notFound(message = 'surat tidak ada'): ApiError {
  return new ApiError(404, 'not_found', message)
}

/** Body JSON dengan batas ukuran. Isi surat paling banyak sekitar 25 KB. */
export async function readJson(request: Request, limit = 100_000): Promise<unknown> {
  const text = await request.text()
  if (text.length > limit) throw new ApiError(400, 'invalid_request', 'body terlalu besar')
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(400, 'invalid_request', 'body bukan JSON yang valid')
  }
}
