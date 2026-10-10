import { createLetterApi, type LetterApi } from '~/utils/letter-api'

/**
 * Klien API surat. Alamatnya diambil dari `NUXT_PUBLIC_API_BASE` kalau diisi (misalnya `/mock-api`
 * untuk mock lokal); kalau kosong, fungsi Supabase di `<supabaseUrl>/functions/v1`.
 */
export function useLetterApi(): LetterApi {
  const config = useRuntimeConfig().public
  const base = config.apiBase || `${config.supabaseUrl}/functions/v1`
  return createLetterApi({
    base: new URL(base, useRequestURL().origin).toString(),
    apiKey: config.supabasePublishableKey,
  })
}
