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
