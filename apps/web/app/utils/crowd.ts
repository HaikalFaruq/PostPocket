// Kerumunan Open Peeps di Beranda (components/beranda/CrowdStreet.vue): ukuran dan kepadatannya.
// Lebih tenang dari Skiper 39 yang jadi dasarnya: orangnya lebih sedikit, lebih kecil, dan
// jalannya pelan, supaya tidak mengalahkan isi halaman di atasnya.

/** Lembar orang dari scripts/peeps.mjs: 9 × 4 sel 180 × 243 px. */
export const PEEPS = { src: '/peeps/open-peeps.webp', cols: 9, rows: 4, cell: [180, 243] } as const

/** Tinggi satu orang di pita setinggi `band` px: 70%, antara 96 dan 176 px. */
export function peepHeight(band: number): number {
  return Math.round(Math.min(176, Math.max(96, band * 0.7)))
}

/** Lebar satu orang setinggi `height`, sesuai perbandingan selnya. */
export function peepWidth(height: number): number {
  return (height * PEEPS.cell[0]) / PEEPS.cell[1]
}

/** Banyaknya orang yang berjalan sekaligus di pita selebar `width`: renggang, 4 sampai 14. */
export function crowdSize(width: number, peep: number): number {
  return Math.round(Math.min(14, Math.max(4, width / (peep * 0.9))))
}

/** Kecepatan jalan untuk acakan `r` di 0..1: pelan, 22 sampai 38 px per detik. */
export function walkSpeed(r: number): number {
  return 22 + 16 * Math.min(1, Math.max(0, r))
}

/**
 * Sel orang berikutnya: acak dari yang belum tampil, jadi tidak ada orang yang sama dua kali
 * di layar. `r` di 0..1.
 */
export function nextPeep(shown: Iterable<number>, r: number): number {
  const used = new Set(shown)
  const free = Array.from({ length: PEEPS.cols * PEEPS.rows }, (_, i) => i).filter(
    (i) => !used.has(i),
  )
  return free[Math.min(free.length - 1, Math.floor(r * free.length))] ?? 0
}

/**
 * Posisi x orang-orang saat kerumunannya diam (gerakan dikurangi atau tanpa GPU): berjajar rata
 * selebar pita, tidak ada yang bertumpuk, dan tidak ada yang keluar dari pita.
 */
export function calmSpots(count: number, width: number, peep: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    Math.min(width - peep, Math.max(0, ((i + 0.5) * width) / count - peep / 2)),
  )
}
