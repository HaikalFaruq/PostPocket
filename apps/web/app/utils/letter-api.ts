import {
  contentPhotoKeys,
  publishableContent,
  type LetterContent,
  type LetterDesign,
} from '@postpocket/presets'

// Bentuk data sesuai docs/api/openapi.yaml (PR #6).

export interface ImageMeta {
  type: 'image/jpeg' | 'image/webp'
  width: number
  height: number
  size: number
}

export interface PhotoMeta extends ImageMeta {
  key: string
}

export interface OgMeta {
  type: 'image/jpeg' | 'image/png'
  width: number
  height: number
  size: number
}

/** Kotak bareng tujuan surat titipan (kontrak 0.3.0). */
export interface BoxEntry {
  /** Kode titip, 12 karakter base62. */
  invite: string
  /** Nama pengirim. */
  from: string
}

export interface CreateLetterRequest {
  design: LetterDesign
  content: LetterContent
  cover: ImageMeta | null
  photos: PhotoMeta[]
  /** Gambar OG; `null` untuk surat titipan. */
  og: OgMeta | null
  replyTo: string | null
  /**
   * Hanya ada untuk surat titipan. Surat biasa tidak mengirim field ini sama sekali, karena backend
   * kontrak 0.2.3 menolak field yang tidak dikenalnya (`additionalProperties: false`).
   */
  box?: BoxEntry
}

export interface UploadTarget {
  path: string
  token: string
  signedUrl: string
}

export interface CreateLetterResponse {
  id: string
  editToken: string
  draftExpiresAt: string
  uploads: {
    cover: UploadTarget | null
    photos: Record<string, UploadTarget>
    og: UploadTarget | null
  }
}

/** Ringkasan kotak untuk pengirim surat titipan. */
export interface BoxReceipt {
  title: string
  to: string
  opensAt: string
  scheduled: boolean
}

export interface PublishLetterResponse {
  slug: string
  /** Link surat, atau link titip kotaknya untuk surat titipan. */
  url: string
  publishedAt: string
  expiresAt: string
  box?: BoxReceipt
}

export interface Asset {
  url: string
  width: number
  height: number
}

export interface Letter {
  slug: string
  design: LetterDesign
  content: LetterContent
  cover: Asset | null
  photos: Record<string, Asset>
  og: Asset | null
  replyTo: string | null
  publishedAt: string
  expiresAt: string
  openedAt: string | null
  photosExpireAt: string | null
  photosDeletedAt: string | null
}

export interface OpenLetterResponse {
  openedAt: string
  photosExpireAt: string
}

export type ApiErrorCode =
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
  | 'og_mismatch'
  | 'invalid_box'
  | 'box_not_found'
  | 'box_closed'
  | 'box_full'
  | 'box_not_open'

/** Berkas siap unggah: foto yang sudah dikompres atau gambar OG yang sudah dirender. */
export interface UploadImage {
  blob: Blob
  type: string
  width: number
  height: number
  size: number
}

export class LetterApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | 'network',
    message: string,
    readonly status?: number,
    /** Detik sampai boleh mencoba lagi, dari header `Retry-After`. */
    readonly retryAfter?: number,
  ) {
    super(message)
  }
}

/** Pesan untuk user. Pesan dari server hanya untuk developer, jadi tidak ditampilkan. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof LetterApiError)) return 'Surat gagal dikirim. Coba lagi.'
  switch (error.code) {
    case 'network':
      return 'Koneksi terputus. Cek sinyal, lalu coba lagi.'
    case 'rate_limited': {
      const minutes = error.retryAfter ? Math.max(1, Math.ceil(error.retryAfter / 60)) : null
      return minutes
        ? `Terlalu banyak surat dari jaringan ini. Coba lagi dalam ${minutes} menit.`
        : 'Terlalu banyak surat dari jaringan ini. Coba lagi sebentar lagi.'
    }
    case 'upload_missing':
    case 'upload_invalid':
      return 'Foto gagal terunggah. Coba lagi.'
    case 'reply_not_found':
      return 'Surat yang mau dibalas sudah tidak tersedia.'
    case 'not_found':
      return 'Surat ini sudah tidak tersedia.'
    case 'box_not_found':
      return 'Kotak ini sudah tidak ada.'
    case 'box_closed':
      return 'Kotak ini sudah ditutup, jadi tidak bisa menerima titipan lagi.'
    case 'box_full':
      return 'Kotak ini sudah penuh: paling banyak 20 surat dan 40 foto. Kalau suratnya masih muat, kurangi fotomu.'
    case 'box_not_open':
      return 'Kotak ini belum bisa dibuka.'
    case 'invalid_box':
      return 'Isian kotak ditolak server. Cek jadwal bukanya, lalu coba lagi.'
    case 'unauthorized':
      return 'Izin mengubah surat ini sudah tidak berlaku.'
    case 'internal':
      return 'Server sedang bermasalah. Coba lagi sebentar lagi.'
    default:
      return 'Isi surat ditolak server. Coba muat ulang halaman, lalu kirim lagi.'
  }
}

export interface SendInput {
  design: LetterDesign
  content: LetterContent
  /** Wajib kalau gambar depannya foto user, selain itu `null`. */
  cover: UploadImage | null
  /** Foto isi per kunci; hanya yang dipakai `content` yang dikirim. */
  photos: Record<string, UploadImage>
  /** Gambar OG; `null` untuk surat titipan, yang tidak punya link sendiri. */
  og: UploadImage | null
  replyTo?: string | null
  /** Titip ke kotak bareng, bukan jadi link sendiri. */
  box?: BoxEntry | null
}

function imageMeta(image: UploadImage): ImageMeta {
  return {
    type: image.type === 'image/webp' ? 'image/webp' : 'image/jpeg',
    width: image.width,
    height: image.height,
    size: image.size,
  }
}

/** Body `POST /letters`: slot kosong dibuang dan daftar foto mengikuti kunci di `content`. */
export function buildCreateRequest(input: SendInput): CreateLetterRequest {
  const content = publishableContent(input.content)
  const photos = contentPhotoKeys(content).map((key) => {
    const image = input.photos[key]
    if (!image) throw new LetterApiError('photo_mismatch', `Foto ${key} tidak ada di draf`)
    return { key, ...imageMeta(image) }
  })
  const box = input.box ?? null
  if (!box && !input.og) throw new LetterApiError('og_mismatch', 'Gambar OG belum dibuat')
  return {
    design: input.design,
    content,
    cover: input.cover ? imageMeta(input.cover) : null,
    photos,
    og:
      box || !input.og
        ? null
        : {
            type: input.og.type === 'image/png' ? 'image/png' : 'image/jpeg',
            width: input.og.width,
            height: input.og.height,
            size: input.og.size,
          },
    // Surat titipan tidak bisa sekaligus jadi balasan (kontrak 0.3.0).
    replyTo: box ? null : (input.replyTo ?? null),
    ...(box ? { box: { invite: box.invite, from: box.from.trim() } } : {}),
  }
}

export interface LetterApi {
  create(body: CreateLetterRequest): Promise<CreateLetterResponse>
  upload(target: UploadTarget, file: Blob): Promise<void>
  publish(id: string, editToken: string): Promise<PublishLetterResponse>
  get(slug: string): Promise<Letter>
  open(slug: string): Promise<OpenLetterResponse>
  remove(id: string, editToken: string): Promise<void>
}

export interface SentLetter extends PublishLetterResponse {
  id: string
  editToken: string
}

/**
 * Kirim surat: buat draf, unggah semua berkas langsung ke Storage, lalu terbitkan.
 * `onUpload` dipanggil tiap satu berkas selesai, untuk progres di layar.
 */
export async function sendLetter(
  api: LetterApi,
  input: SendInput,
  onUpload?: (done: number, total: number) => void,
): Promise<SentLetter> {
  const request = buildCreateRequest(input)
  const created = await api.create(request)
  const files: { target: UploadTarget | null | undefined; blob: Blob }[] = request.photos.map(
    ({ key }) => ({
      target: created.uploads.photos[key],
      blob: input.photos[key]!.blob,
    }),
  )
  if (request.og && input.og) files.push({ target: created.uploads.og, blob: input.og.blob })
  if (input.cover) files.unshift({ target: created.uploads.cover, blob: input.cover.blob })
  let done = 0
  await Promise.all(
    files.map(async ({ target, blob }) => {
      if (!target) throw new LetterApiError('upload_missing', 'Tujuan upload tidak ada')
      await api.upload(target, blob)
      onUpload?.(++done, files.length)
    }),
  )
  const published = await api.publish(created.id, created.editToken)
  return { id: created.id, editToken: created.editToken, ...published }
}

/** Ubah respons gagal jadi `LetterApiError` dengan kode dari skema `Error`. */
async function failure(response: Response): Promise<LetterApiError> {
  const body = await response.json().catch(() => null)
  const error = (body as { error?: { code?: string; message?: string } } | null)?.error
  const retry = Number(response.headers.get('retry-after'))
  return new LetterApiError(
    (error?.code as ApiErrorCode | undefined) ??
      (response.status >= 500 ? 'internal' : 'invalid_request'),
    error?.message ?? `HTTP ${response.status}`,
    response.status,
    Number.isFinite(retry) && retry > 0 ? retry : undefined,
  )
}

/** Gangguan yang biasanya hilang sendiri: koneksi yang diputus atau error server (5xx). */
export const transient = (problem: unknown) =>
  problem instanceof LetterApiError && (problem.code === 'network' || (problem.status ?? 0) >= 500)

export interface ApiOptions {
  base: string
  apiKey: string
  fetch?: typeof globalThis.fetch
  /** Jeda sebelum GET dicoba sekali lagi, dalam milidetik. */
  retryDelay?: number
  /**
   * Region tempat fungsi dijalankan (kontrak 0.2.2, `forceFunctionRegion`). Tidak berlaku untuk
   * unggahan ke `signedUrl`, yang langsung ke Storage.
   */
  region?: string
}

export type ApiCall = <T>(
  method: string,
  path: string,
  init?: { body?: unknown; editToken?: string; alsoOk?: number },
) => Promise<T>

/**
 * Pemanggil fungsi Supabase (atau mock) sesuai kontrak: `base` adalah URL absolut fungsinya, dan
 * setiap request membawa publishable key di header `apikey`. Dipakai klien surat dan kotak bareng.
 * `alsoOk`: satu status selain 2xx yang di kontrak membawa body sukses.
 */
export function createApiCall(options: ApiOptions): ApiCall {
  const base = options.base.replace(/\/$/, '')
  const run = options.fetch ?? globalThis.fetch.bind(globalThis)
  const query = options.region ? `?forceFunctionRegion=${encodeURIComponent(options.region)}` : ''
  return async function call<T>(
    method: string,
    path: string,
    init: { body?: unknown; editToken?: string; alsoOk?: number } = {},
  ) {
    const headers: Record<string, string> = { apikey: options.apiKey }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    if (init.editToken) headers['x-edit-token'] = init.editToken
    let response: Response
    try {
      response = await run(`${base}${path}${query}`, {
        method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      })
    } catch {
      throw new LetterApiError('network', `${method} ${path} gagal tersambung`)
    }
    if (!response.ok && response.status !== init.alsoOk) throw await failure(response)
    return (response.status === 204 ? undefined : await response.json()) as T
  }
}

/** GET yang aman diulang: dicoba sekali lagi setelah gangguan sesaat. */
export async function getWithRetry<T>(call: ApiCall, path: string, delay = 400): Promise<T> {
  try {
    return await call<T>('GET', path)
  } catch (problem) {
    if (!transient(problem)) throw problem
    await new Promise((resolve) => setTimeout(resolve, delay))
    return call<T>('GET', path)
  }
}

/**
 * Klien lima endpoint surat. `base` adalah URL absolut fungsi Supabase (atau mock), dan setiap
 * request membawa publishable key di header `apikey`. Unggahan memakai `signedUrl` apa adanya.
 */
export function createLetterApi(options: ApiOptions): LetterApi {
  const run = options.fetch ?? globalThis.fetch.bind(globalThis)
  const call = createApiCall(options)

  return {
    create: (body) => call('POST', '/letters', { body }),
    // 409: surat sudah pernah terbit dan body-nya slug serta link yang sama, jadi publish yang
    // diulang (misalnya setelah koneksi putus) tetap berhasil. Endpoint lain tidak punya 409.
    publish: (id, editToken) =>
      call('POST', `/letters/${encodeURIComponent(id)}/publish`, { editToken, alsoOk: 409 }),
    // Penerima jangan sampai melihat "Surat belum bisa dimuat" (atau WhatsApp gagal membaca
    // preview) karena satu gangguan sesaat, misalnya koneksi lama yang sudah diputus server saat
    // halaman di-SSR. Membaca surat aman diulang, jadi GET dicoba sekali lagi.
    get: (slug) => getWithRetry<Letter>(call, `/l/${encodeURIComponent(slug)}`, options.retryDelay),
    open: (slug) => call('POST', `/l/${encodeURIComponent(slug)}/open`),
    remove: (id, editToken) => call('DELETE', `/letters/${encodeURIComponent(id)}`, { editToken }),
    async upload(target, file) {
      let response: Response
      try {
        response = await run(target.signedUrl, {
          method: 'PUT',
          // Tanpa cache-control, Storage menyajikan berkasnya dengan `no-cache`, jadi gambar surat
          // diunduh ulang setiap dibuka (kontrak 0.2.1). Berkas surat tidak berubah setelah terbit.
          headers: {
            'content-type': file.type,
            'x-upsert': 'false',
            'cache-control': 'max-age=3600',
          },
          body: file,
        })
      } catch {
        throw new LetterApiError('network', 'Upload gagal tersambung')
      }
      if (!response.ok) throw new LetterApiError('upload_invalid', `Upload HTTP ${response.status}`)
    },
  }
}
