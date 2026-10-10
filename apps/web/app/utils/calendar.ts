import { dayKey, parseDay } from './memories'

export interface CalendarCell {
  /** Tanggal lokal `YYYY-MM-DD`. */
  day: string
  date: number
  inMonth: boolean
}

export const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

/**
 * Grid kalender Senin sampai Minggu untuk `month` (1–12) tahun `year`. Jumlah minggunya
 * secukupnya (4 sampai 6); tanggal di luar bulan ikut mengisi minggu pertama dan terakhir.
 */
export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(year, month, 0).getDate()
  const weeks = Math.ceil((offset + days) / 7)
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = new Date(year, month - 1, 1 - offset + i)
    return { day: dayKey(date), date: date.getDate(), inMonth: date.getMonth() === month - 1 }
  })
}

/** Bulan sebelum atau sesudahnya, menyeberang tahun kalau perlu. */
export function shiftMonth(year: number, month: number, step: number) {
  const date = new Date(year, month - 1 + step, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

/** Tanggal lengkap bahasa Indonesia, misalnya "Sabtu, 10 Oktober 2026". */
export function longDate(day: string): string {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(year, month - 1, date).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Tanggal `YYYY-MM-DD` yang benar-benar ada dan sudah lewat atau hari ini: bisa diisi di Pocket. */
export function isPocketDay(value: string, today = dayKey(new Date())): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dayKey(parseDay(value)) === value && value <= today
}
