import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { allowedOrigin } from './http.ts'

export const BUCKET = 'letter-assets'

/** URL proyek yang disediakan Supabase. Di lokal ini alamat internal Docker. */
const internalUrl = () => Deno.env.get('SUPABASE_URL')!

/**
 * URL proyek yang bisa dibuka browser. Di proyek Supabase sama dengan `SUPABASE_URL`; di lokal
 * diisi `PUBLIC_API_URL` dari `[edge_runtime.secrets]` di supabase/config.toml.
 */
export const publicUrl = () => Deno.env.get('PUBLIC_API_URL') ?? internalUrl()

/** Secret key dari env yang disediakan Supabase, tidak pernah diset manual. */
export function secretKey(): string {
  const many = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (many) {
    const keys = JSON.parse(many) as Record<string, string>
    const key = keys.default ?? Object.values(keys)[0]
    if (key) return key
  }
  const one = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!one) throw new Error('Secret key Supabase tidak ada di env')
  return one
}

let admin: SupabaseClient | undefined

/** Klien dengan secret key: melewati RLS. Hanya dipakai di Edge Function. */
export function db(): SupabaseClient {
  admin ??= createClient(internalUrl(), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return admin
}

/** Ganti origin URL buatan Storage (alamat internal di lokal) dengan URL publik. */
export function toPublic(url: string): string {
  const internal = new URL(internalUrl())
  const parsed = new URL(url, internal)
  const target = new URL(publicUrl())
  parsed.protocol = target.protocol
  parsed.host = target.host
  return parsed.toString()
}

export function assetUrl(path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${publicUrl()}/storage/v1/object/public/${BUCKET}/${encoded}`
}

/** Origin link surat: origin frontend yang memanggil, atau situs produksi. */
export function siteUrl(request: Request): string {
  return allowedOrigin(request) ?? Deno.env.get('SITE_URL') ?? 'https://postpocket.vercel.app'
}

/**
 * IP pengirim. Di Supabase request lewat Cloudflare: `cf-connecting-ip` berisi IP asli dan tidak
 * bisa dipalsukan (Cloudflare menolak request yang mengirim header itu sendiri), sedangkan
 * `x-forwarded-for` dari klien ditimpa. `x-forwarded-for` hanya dipakai di stack lokal.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return request.headers.get('cf-connecting-ip') ?? forwarded ?? 'unknown'
}

/** Baris tabel `letters` yang dipakai fungsi. */
export interface LetterRow {
  id: string
  slug: string | null
  design: Record<string, unknown>
  content: Record<string, unknown>
  status: 'draft' | 'sent'
  edit_token_hash: string
  reply_to_id: string | null
  draft_expires_at: string
  published_at: string | null
  expires_at: string | null
  opened_at: string | null
  photos_expire_at: string | null
  photos_deleted_at: string | null
  /** Kotak bareng tujuan surat titipan (kontrak 0.3.0), `null` untuk surat biasa. */
  box_id: string | null
  from_name: string | null
}

/** Baris tabel `boxes` (kotak bareng). `recipient` adalah `to` di kontrak. */
export interface BoxRow {
  id: string
  slug: string
  invite: string
  edit_token_hash: string
  title: string
  recipient: string
  design: string
  scheduled: boolean
  created_at: string
  opens_at: string
  expires_at: string
  opened_at: string | null
  photos_expire_at: string | null
  photos_deleted_at: string | null
}

export interface AssetRow {
  id: string
  kind: 'photo' | 'cover' | 'og'
  key: string | null
  storage_path: string
  mime: 'image/jpeg' | 'image/webp' | 'image/png'
  size: number
  width: number
  height: number
  uploaded_at: string | null
}

/** Gagal di database atau Storage: dicatat di log, ke klien jadi 500. */
export function check<T>(result: { data: T | null; error: unknown }): T {
  if (result.error || result.data === null) throw result.error ?? new Error('Data kosong')
  return result.data
}

/** Seperti `check()`, untuk operasi yang tidak mengembalikan data (misalnya delete). */
export function ok(result: { error: unknown }): void {
  if (result.error) throw result.error
}
