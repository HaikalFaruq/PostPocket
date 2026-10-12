/**
 * Fisika tali foto Pocket: foto dijepit di tali yang melengkung, tali bisa diseret, dan tiap foto
 * berayun di jepitannya mengikuti kecepatan geserannya. Semua jarak dalam px dan waktu dalam detik,
 * kecuali yang disebut lain.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Tinggi tali yang melengkung sedalam `sag` di tengah, antara (0, y0) dan (w, y0), di titik x. */
export function stringY(x: number, w: number, y0: number, sag: number): number {
  const t = clamp(x / w, 0, 1)
  return y0 + 4 * sag * t * (1 - t)
}

/** Satu langkah pegas teredam kritis menuju `target`: sampai tanpa memantul berkali-kali. */
export function lineSpring(
  x: number,
  v: number,
  target: number,
  dt: number,
  k = 70,
): [number, number] {
  const c = 2 * Math.sqrt(k)
  const nv = v + (k * (target - x) - c * v) * dt
  return [x + nv * dt, nv]
}

/**
 * Satu langkah ayunan foto. `lineVel` kecepatan foto di layar (px/detik, positif ke kanan): foto
 * tertinggal dari gerakan, ditarik balik gravitasi, lalu teredam. Sudut dalam radian.
 */
export function swingStep(
  angle: number,
  spin: number,
  lineVel: number,
  dt: number,
  gain: number,
): [number, number] {
  const next = spin + (-38 * angle - 4.2 * spin + lineVel * 0.0034 * gain) * dt
  return [clamp(angle + next * dt, -0.6, 0.6), next]
}

/** Foto yang paling dekat ke tengah untuk geseran tali `offset`. */
export function nearestAt(offset: number, spacing: number, count: number): number {
  return clamp(Math.round(offset / spacing), 0, Math.max(0, count - 1))
}

/**
 * Foto tujuan setelah tali dilepas. `pointerVel` kecepatan jari saat dilepas (px/ms, positif ke
 * kanan): lemparan cepat meluncur melewati beberapa foto.
 */
export function flingTarget(
  offset: number,
  pointerVel: number,
  spacing: number,
  count: number,
): number {
  return nearestAt(offset - pointerVel * 180, spacing, count)
}

/** Lebar foto mengikuti tempatnya: di HP mengecil supaya tetangganya tetap kelihatan di tepi. */
export function printWidth(width: number, height: number, max: number): number {
  return Math.round(Math.max(120, Math.min(max, width * 0.42, height * 0.42)))
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Lengkung keluar foto dari kantong: cepat di awal, melambat, sedikit melewati lalu kembali. */
export function easeOutBack(t: number): number {
  const c = 1.4
  const u = clamp(t, 0, 1) - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}
