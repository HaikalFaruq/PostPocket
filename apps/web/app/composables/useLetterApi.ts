import { createLetterApi, type LetterApi } from '~/utils/letter-api'

/**
 * Region DB dan Storage Supabase (Sydney). Tanpa ini fungsi jalan di region terdekat dengan
 * pemanggil (Singapura) dan setiap query bolak-balik ke Sydney (kontrak 0.2.2).
 */
const FUNCTION_REGION = 'ap-southeast-2'

/**
 * Klien API surat. Alamatnya diambil dari `NUXT_PUBLIC_API_BASE` kalau diisi (misalnya `/mock-api`
 * untuk mock lokal); kalau kosong, fungsi Supabase di `<supabaseUrl>/functions/v1`, dipanggil di
 * region DB-nya. Berlaku juga untuk SSR halaman surat.
 */
export function useLetterApi(): LetterApi {
  const config = useRuntimeConfig().public
  const base = config.apiBase || `${config.supabaseUrl}/functions/v1`
  return createLetterApi({
    base: new URL(base, useRequestURL().origin).toString(),
    apiKey: config.supabasePublishableKey,
    region: config.apiBase ? undefined : FUNCTION_REGION,
  })
}
