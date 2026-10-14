// Edit token, slug, dan kunci rate limit.

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(
    /=+$/,
    '',
  )
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Literal bytea untuk PostgREST, misalnya `\x0a1b…`. */
export function bytea(bytes: Uint8Array): string {
  return `\\x${hex(bytes)}`
}

/** Token acak 256 bit. Hanya dikirim sekali ke browser pengirim. */
export function newEditToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

/** Bandingkan hash token dengan `edit_token_hash` dari database tanpa bocor lewat waktu. */
export function sameHash(hash: Uint8Array, stored: string): boolean {
  const expected = bytea(hash)
  if (expected.length !== stored.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ stored.charCodeAt(i)
  return diff === 0
}

/** Kode base62 acak tanpa bias modulo (byte ≥ 248 dibuang). */
export function newCode(length: number): string {
  let code = ''
  while (code.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < 248 && code.length < length) code += BASE62[byte % 62]
    }
  }
  return code
}

/** Slug surat atau kotak: 10 karakter base62. */
export const newSlug = () => newCode(10)

/** Kode titip kotak bareng: 12 karakter base62. */
export const newInvite = () => newCode(12)

/**
 * Bagian IP yang dipakai untuk rate limit. IPv6 dipotong ke /64, karena satu perangkat
 * biasanya memegang satu /64 utuh dan bisa berganti alamat di dalamnya.
 */
export function ipPrefix(ip: string): string {
  if (!ip.includes(':')) return ip
  const [head, tail = ''] = ip.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = ip.includes('::')
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : left
  return groups.slice(0, 4).map((group) => parseInt(group || '0', 16).toString(16)).join(':') +
    '::/64'
}

/** HMAC dari IP, supaya tabel rate limit tidak menyimpan IP mentah. */
export async function rateKey(ip: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ipPrefix(ip)))
  return new Uint8Array(signature)
}
