// Waktu di kotak bareng: jadwal buka, hitung mundur, dan nilai untuk input datetime-local.
// Halaman yang di-SSR menulis waktu dalam WIB dulu (sama di server dan browser), lalu beralih ke
// zona waktu HP setelah dimuat. Halaman yang hanya dirender di browser langsung memakai zona HP,
// sama dengan jam yang dipilih di input datetime-local.

export const WIB = 'Asia/Jakarta'
const ZONE_LABELS: Record<string, string> = {
  'Asia/Jakarta': 'WIB',
  'Asia/Pontianak': 'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Jayapura': 'WIT',
}
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Zona waktu perangkat, atau WIB kalau tidak terbaca. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || WIB
  } catch {
    return WIB
  }
}

/** Nama zona untuk pembaca Indonesia: WIB, WITA, WIT, atau singkatan bawaan browser. */
export function zoneLabel(timeZone: string, date: Date = new Date()): string {
  return (
    ZONE_LABELS[timeZone] ??
    new Intl.DateTimeFormat('id-ID', { timeZone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ??
    timeZone
  )
}

/** "20 Oktober, 19.00 WIB", atau dalam zona `timeZone`. */
export function formatWhen(value: string | number | Date, timeZone: string = WIB): string {
  const date = new Date(value)
  const day = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', timeZone })
  const time = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone })
  return `${day}, ${time} ${zoneLabel(timeZone, date)}`
}

/** "20 Okt", untuk cap tanggal dan daftar. */
export function formatDay(value: string | number | Date, timeZone: string = WIB): string {
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone })
}

/** Sisa waktu yang mudah dibaca, misalnya "2 hari 3 jam", "2 jam 15 menit", atau "5 menit". */
export function countdown(ms: number): string {
  if (ms < MINUTE) return 'kurang dari semenit'
  const days = Math.floor(ms / DAY)
  const hours = Math.floor((ms % DAY) / HOUR)
  const minutes = Math.floor((ms % HOUR) / MINUTE)
  if (days) return hours ? `${days} hari ${hours} jam` : `${days} hari`
  if (hours) return minutes ? `${hours} jam ${minutes} menit` : `${hours} jam`
  return `${minutes} menit`
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Nilai `<input type="datetime-local">` dalam waktu perangkat, tanpa detik. */
export function toLocalInput(value: number | Date): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Waktu dari `<input type="datetime-local">` (waktu perangkat), atau `null` kalau kosong. */
export function fromLocalInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Jadwal buka yang boleh dipilih: dari 10 menit lagi sampai 30 hari setelah kotak dibuat. */
export function scheduleRange(createdAt: number, now = Date.now()) {
  return { min: now + 10 * MINUTE, max: createdAt + 30 * DAY }
}
