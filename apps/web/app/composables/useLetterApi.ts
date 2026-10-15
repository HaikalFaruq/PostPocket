import { createLetterApi, type ApiOptions, type LetterApi } from '~/utils/letter-api'

/**
 * Region DB dan Storage Supabase (Sydney). Tanpa ini fungsi jalan di region terdekat dengan
 * pemanggil (Singapura) dan setiap query bolak-balik ke Sydney (kontrak 0.2.2).
 */
const FUNCTION_REGION = 'ap-southeast-2'

/**
 * Alamat dan kunci API. Alamatnya diambil dari `NUXT_PUBLIC_API_BASE` kalau diisi (misalnya
 * `/mock-api` untuk mock lokal); kalau kosong, fungsi Supabase di `<supabaseUrl>/functions/v1`,
 * dipanggil di region DB-nya. Berlaku juga untuk SSR halaman surat dan kotak bareng.
 */
export function useApiOptions(): ApiOptions {
  const config = useRuntimeConfig().public
  const base = config.apiBase || `${config.supabaseUrl}/functions/v1`
  return {
    base: new URL(base, useRequestURL().origin).toString(),
    apiKey: config.supabasePublishableKey,
    region: config.apiBase ? undefined : FUNCTION_REGION,
  }
}

/**
 * Alamat fungsi yang memakai sesi login (`DELETE /account`). Selalu fungsi Supabase, juga saat
 * `NUXT_PUBLIC_API_BASE` diisi: mock lokal hanya meniru endpoint surat dan kotak, sedangkan sesinya
 * milik Supabase.
 */
export function useAccountApiOptions(): ApiOptions {
  const config = useRuntimeConfig().public
  return {
    base: `${config.supabaseUrl}/functions/v1`,
    apiKey: config.supabasePublishableKey,
    region: FUNCTION_REGION,
  }
}

/** Klien API surat. */
export function useLetterApi(): LetterApi {
  return createLetterApi(useApiOptions())
}
