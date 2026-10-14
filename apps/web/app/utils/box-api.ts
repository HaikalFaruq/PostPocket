import type { LetterContent, LetterDesign } from '@postpocket/presets'
import {
  createApiCall,
  getWithRetry,
  type ApiOptions,
  type Asset,
  type LetterApiError,
  type OpenLetterResponse,
} from './letter-api'

// Bentuk data kotak bareng sesuai docs/api/openapi.yaml (kontrak 0.3.0). Error-nya
// `LetterApiError` yang sama dengan API surat, dengan kode `box_*`.

export interface BoxLimits {
  letters: number
  photos: number
}

export type BoxUsage = BoxLimits

export interface CreateBoxRequest {
  title: string
  to: string
  /** Id `kotak.folders`. */
  design: string
  /** Waktu kotak terbuka, atau `null` untuk dibuka manual. */
  opensAt: string | null
}

/** Ubahan kotak. `openNow` membuka kotak menurut jam server; tidak boleh bersama `opensAt`. */
export type UpdateBoxRequest = Partial<CreateBoxRequest> & { openNow?: true }

/** Titipan di kotak, untuk pembuatnya: tanpa isi surat. */
export interface BoxEntryLine {
  id: string
  from: string
  publishedAt: string
  photos: number
}

export interface OrganizerBox {
  id: string
  slug: string
  /** Link buka untuk penerima. */
  url: string
  invite: string
  /** Link titip untuk teman-teman. */
  inviteUrl: string
  title: string
  to: string
  design: string
  createdAt: string
  opensAt: string
  scheduled: boolean
  /** Sudah terbuka untuk penerima menurut jam server. */
  openable: boolean
  expiresAt: string
  openedAt: string | null
  photosExpireAt: string | null
  photosDeletedAt: string | null
  limits: BoxLimits
  usage: BoxUsage
  letters: BoxEntryLine[]
}

export interface CreatedBox extends OrganizerBox {
  editToken: string
}

export interface BoxInvite {
  title: string
  to: string
  design: string
  opensAt: string
  scheduled: boolean
  closed: boolean
  limits: BoxLimits
  usage: BoxUsage
}

export interface BoxLetter {
  id: string
  from: string
  design: LetterDesign
  content: LetterContent
  cover: Asset | null
  photos: Record<string, Asset>
  publishedAt: string
}

export interface RecipientBox {
  slug: string
  title: string
  to: string
  design: string
  opensAt: string
  scheduled: boolean
  openable: boolean
  letterCount: number
  letters: BoxLetter[]
  openedAt: string | null
  photosExpireAt: string | null
  photosDeletedAt: string | null
  expiresAt: string
}

/**
 * Kotak tidak ada, sudah dihapus, atau sudah lewat masa berlakunya. Kontraknya `box_not_found`;
 * `not_found` ikut diterima supaya 404 umum dari gateway atau fungsi tidak terbaca sebagai error.
 */
export function missingBox(problem: LetterApiError): boolean {
  return problem.code === 'box_not_found' || problem.code === 'not_found'
}

export interface BoxApi {
  create(body: CreateBoxRequest): Promise<CreatedBox>
  get(id: string, editToken: string): Promise<OrganizerBox>
  update(id: string, editToken: string, patch: UpdateBoxRequest): Promise<OrganizerBox>
  remove(id: string, editToken: string): Promise<void>
  removeLetter(id: string, editToken: string, letterId: string): Promise<void>
  invite(code: string): Promise<BoxInvite>
  forRecipient(slug: string): Promise<RecipientBox>
  open(slug: string): Promise<OpenLetterResponse>
}

/** Klien endpoint kotak bareng: `/boxes/…` untuk pembuat dan pengirim, `/k/…` untuk penerima. */
export function createBoxApi(options: ApiOptions): BoxApi {
  const call = createApiCall(options)
  const box = (id: string) => `/boxes/${encodeURIComponent(id)}`
  return {
    create: (body) => call('POST', '/boxes', { body }),
    get: (id, editToken) => call('GET', box(id), { editToken }),
    update: (id, editToken, patch) => call('PATCH', box(id), { body: patch, editToken }),
    remove: (id, editToken) => call('DELETE', box(id), { editToken }),
    removeLetter: (id, editToken, letterId) =>
      call('DELETE', `${box(id)}/letters/${encodeURIComponent(letterId)}`, { editToken }),
    // Dibaca SSR untuk preview WhatsApp, jadi diulang sekali seperti GET surat.
    invite: (code) =>
      getWithRetry<BoxInvite>(
        call,
        `/boxes/invite/${encodeURIComponent(code)}`,
        options.retryDelay,
      ),
    forRecipient: (slug) =>
      getWithRetry<RecipientBox>(call, `/k/${encodeURIComponent(slug)}`, options.retryDelay),
    open: (slug) => call('POST', `/k/${encodeURIComponent(slug)}/open`),
  }
}
