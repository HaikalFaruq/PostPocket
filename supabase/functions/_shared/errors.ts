// Catatan error 5xx ke tabel function_errors (docs/backend.md, bagian Analitik dan monitoring
// error). Hanya pola route, nama, dan kode error: pesan error bisa membawa URL berisi slug
// (`fetch` di Deno) atau nilai input (Postgres), jadi tidak pernah disimpan.

import { db } from './db.ts'

const FUNCTIONS = new Set(['letters', 'l', 'cleanup', 'boxes', 'k', 'account'])
const SAFE_NAME = /^[A-Za-z0-9_]{1,60}$/
const SAFE_CODE = /^[A-Za-z0-9_]{1,20}$/

/** Pola route dari path fungsi, tanpa id atau slug. Path lain jadi `/:other`. */
export function routePattern(path: string): string {
  const [name, id, action, ...rest] = path.split('/').filter(Boolean)
  if (!rest.length) {
    if (name === 'cleanup' && !id) return '/cleanup'
    if (name === 'account' && !id) return '/account'
    if (name === 'letters' && !id) return '/letters'
    if (name === 'letters' && !action) return '/letters/:id'
    if (name === 'letters' && action === 'publish') return '/letters/:id/publish'
    if (name === 'l' && id && !action) return '/l/:slug'
    if (name === 'l' && id && action === 'open') return '/l/:slug/open'
    if (name === 'boxes' && !id) return '/boxes'
    if (name === 'boxes' && id === 'invite' && action) return '/boxes/invite/:invite'
    if (name === 'boxes' && id && !action) return '/boxes/:id'
    if (name === 'k' && id && !action) return '/k/:slug'
    if (name === 'k' && id && action === 'open') return '/k/:slug/open'
  }
  if (name === 'boxes' && id && action === 'letters' && rest.length === 1) {
    return '/boxes/:id/letters/:letterId'
  }
  return '/:other'
}

/** Nama dan kode error yang aman disimpan, atau `null` kalau bentuknya tidak cocok pola. */
export function errorFields(
  error: unknown,
): { error_name: string | null; error_code: string | null } {
  const value = (typeof error === 'object' && error !== null ? error : {}) as Record<
    string,
    unknown
  >
  const name = typeof value.name === 'string'
    ? value.name
    : error instanceof Error
    ? error.constructor.name
    : null
  const code = [value.code, value.statusCode, value.status].find(
    (item) => typeof item === 'string' || typeof item === 'number',
  )
  return {
    error_name: name && SAFE_NAME.test(name) ? name : null,
    error_code: code !== undefined && SAFE_CODE.test(String(code)) ? String(code) : null,
  }
}

/**
 * Tulis error tak terduga ke log fungsi tanpa pesannya, dengan aturan yang sama seperti
 * function_errors: pesan Postgres bisa membawa isi baris ("Failing row contains …") dan pesan
 * `fetch` membawa URL berisi slug. Yang ditulis hanya nama, kode, dan baris stack-nya.
 */
export function logError(label: string, error: unknown): void {
  const stack = error instanceof Error
    ? (error.stack ?? '').split('\n').map((line) => line.trim())
      .filter((line) => line.startsWith('at ')).slice(0, 8)
    : []
  console.error(label, JSON.stringify({ ...errorFields(error), stack }))
}

interface Runtime {
  waitUntil(promise: Promise<unknown>): void
}

/**
 * Catat satu error 5xx, best effort: respons tidak menunggu insert-nya, dan kalau insert gagal
 * (biasanya justru saat DB bermasalah) cukup ditulis ke log.
 */
export function recordError(path: string, status: number, error: unknown): void {
  const name = path.split('/').filter(Boolean)[0] ?? ''
  if (!FUNCTIONS.has(name)) return
  const row = { function: name, route: routePattern(path), status, ...errorFields(error) }
  const task = (async () => {
    try {
      const { error: failed } = await db().from('function_errors').insert(row)
      if (failed) console.error('function_errors gagal dicatat', failed.code)
    } catch (failed) {
      console.error('function_errors gagal dicatat', errorFields(failed).error_name)
    }
  })()
  ;(globalThis as { EdgeRuntime?: Runtime }).EdgeRuntime?.waitUntil(task)
}
