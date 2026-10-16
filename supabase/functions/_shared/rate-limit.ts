// Rate limit per IP lewat public.take_rate_limit() (migrasi letter_api). Tabelnya hanya menyimpan
// HMAC dari IP (`rateKey`), bukan IP-nya.

import { check, clientIp, db, secretKey } from './db.ts'
import { ApiError } from './http.ts'
import { bytea, rateKey } from './token.ts'

export interface RateLimit {
  bucket: string
  limit: number
  window: string
  /** Pesan 429 untuk developer. */
  message: string
}

/** Hitung satu request dari IP ini, atau tolak dengan 429 dan `Retry-After` kalau jatahnya habis. */
export async function takeRateLimit(request: Request, rule: RateLimit): Promise<void> {
  const key = await rateKey(clientIp(request), secretKey())
  const retryAfter = check(
    await db().rpc('take_rate_limit', {
      p_bucket: rule.bucket,
      p_key: bytea(key),
      p_limit: rule.limit,
      p_window: rule.window,
    }),
  ) as number
  if (retryAfter > 0) {
    throw new ApiError(429, 'rate_limited', rule.message, undefined, {
      'retry-after': String(retryAfter),
    })
  }
}
