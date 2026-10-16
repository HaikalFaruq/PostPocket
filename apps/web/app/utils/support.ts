// Dukungan untuk PostPocket lewat Sociabuzz. Pembayarannya diurus Sociabuzz sepenuhnya: PostPocket
// hanya membuka halamannya di tab baru, tanpa mengirim data apa pun.

/** Halaman dukungan PostPocket di Sociabuzz. */
export const SUPPORT_URL = 'https://sociabuzz.com/byhund/tribe'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']

/** Tanggal di cap pos perangko, seperti cap kantor pos: `16 OKT 2026`, waktu Jakarta. */
export function postmarkDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  const part = (type: string) => Number(parts.find((item) => item.type === type)!.value)
  return `${part('day')} ${MONTHS[part('month') - 1]} ${part('year')}`
}

/**
 * Kunci localStorage untuk ajakan Traktir kecil sesudah kirim surat dan Booth. Isinya waktu
 * (ISO) ajakan itu terakhir ditutup atau ditekan.
 */
export const SUPPORT_NUDGE_KEY = 'postpocket:support-nudge'

/** Lama ajakan kecil tidak muncul lagi setelah ditutup atau ditekan. */
export const SUPPORT_NUDGE_REST_DAYS = 30

/** Ajakan kecil tampil kalau belum pernah ditutup, atau sudah lewat masa istirahatnya. */
export function supportNudgeVisible(stored: string | null, now: Date): boolean {
  if (!stored) return true
  const at = Date.parse(stored)
  if (Number.isNaN(at)) return true
  return now.getTime() - at >= SUPPORT_NUDGE_REST_DAYS * 24 * 60 * 60 * 1000
}
