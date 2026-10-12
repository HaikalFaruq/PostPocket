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

/**
 * Batas geseran tali `[lo, hi]` untuk `count` foto selebar `print` di tali selebar `width`:
 * - semua foto muat: kelompoknya di tengah dan tali tidak bergeser;
 * - layar lebar: tali tidak pernah menyisakan separuh tali kosong di ujung;
 * - layar sempit: foto yang dilihat selalu di tengah.
 */
export function offsetRange(
  count: number,
  spacing: number,
  width: number,
  print: number,
  pad = 16,
): [number, number] {
  const span = Math.max(0, count - 1) * spacing
  if (span <= width - print - 2 * pad) return [span / 2, span / 2]
  if (width >= 3 * spacing) return [width / 2 - print / 2 - pad, span - width / 2 + print / 2 + pad]
  return [0, span]
}

/** Geseran tali yang menampilkan foto ke-`i`. */
export function offsetFor(i: number, spacing: number, range: [number, number]): number {
  return clamp(i * spacing, range[0], range[1])
}

/**
 * Foto yang dilihat setelah tali dilepas. Tali yang diseret sejauh satu foto berpindah satu foto,
 * dan lemparan cepat (`pointerVel`, px/ms, positif ke kanan) meluncur lebih jauh.
 */
export function releaseIndex(
  active: number,
  startOffset: number,
  offset: number,
  pointerVel: number,
  spacing: number,
  count: number,
): number {
  const projected = offset - pointerVel * 180
  return clamp(active + Math.round((projected - startOffset) / spacing), 0, Math.max(0, count - 1))
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
