/**
 * Geometri rak CD (PRD modul 3, referensi Memory TV): deretan punggung CD, satu case terbuka di
 * tengah, dan piringan yang bisa digeser keluar lalu diterbangkan ke slot TV. Semua angka px.
 */

export interface ShelfMetrics {
  /** Lebar punggung CD. */
  spine: number
  /** Sisi muka case (persegi). */
  face: number
  /** Jarak antar CD yang tertutup, dihitung dari punggung ke punggung. */
  step: number
  /** Ruang tambahan di kiri dan kanan case yang terbuka. */
  breathe: number
  /** Seberapa jauh piringan keluar ke kanan dari case. */
  discOut: number
}

/** Ukuran rak mengikuti lebar tempatnya: di HP case lebih kecil supaya tetangganya kelihatan. */
export function shelfMetrics(width: number): ShelfMetrics {
  if (width < 520) return { spine: 26, face: 148, step: 44, breathe: 6, discOut: 84 }
  return { spine: 34, face: 200, step: 62, breathe: 12, discOut: 118 }
}

/**
 * Posisi kiri tiap CD, relatif terhadap tengah rak. CD terpilih (punggung dan muka case) ada di
 * tengah; kalau piringannya keluar, case dan piringannya bersama-sama yang di tengah, dan
 * tetangga di kanan ikut bergeser memberi ruang.
 */
export function shelfPositions(
  count: number,
  index: number,
  open: boolean,
  m: ShelfMetrics,
): number[] {
  const selectedWidth = m.spine + m.face + (open ? m.discOut : 0)
  const selectedLeft = -selectedWidth / 2
  return Array.from({ length: count }, (_, i) => {
    if (i === index) return selectedLeft
    if (i < index) return selectedLeft - m.breathe - (index - i) * m.step
    return selectedLeft + selectedWidth + m.breathe + (i - index - 1) * m.step
  })
}

/** CD yang masih kelihatan di rak selebar `width` (sisanya disembunyikan dan tidak bisa diklik). */
export function shelfVisible(left: number, itemWidth: number, width: number): boolean {
  return left + itemWidth > -width / 2 - 4 && left < width / 2 + 4
}
