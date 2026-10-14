import { createBoxApi, type BoxApi } from '~/utils/box-api'

/** Klien API kotak bareng (kontrak 0.3.0), dengan alamat yang sama dengan API surat. */
export function useBoxApi(): BoxApi {
  return createBoxApi(useApiOptions())
}
