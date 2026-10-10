// Hitungan gerak kartu foil, tanpa DOM supaya bisa diuji dengan unit test.
// Sudut dalam derajat; rotateY 0 = sampul depan menghadap layar, 180 = sampul belakang.

const DEG = Math.PI / 180

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Gerakan pointer pendek dan cepat dianggap tap (buka/tutup), bukan drag. */
export function isTap(dx: number, dy: number, ms: number): boolean {
  return Math.hypot(dx, dy) < 8 && ms < 350
}

/**
 * Sudut Y tempat kartu berhenti setelah dilepas: muka terdekat (kelipatan 180),
 * dengan memperhitungkan lemparan. `velocity` dalam derajat per milidetik.
 */
export function restAngle(ry: number, velocity = 0, flingMs = 160): number {
  return Math.round((ry + velocity * flingMs) / 180) * 180
}

/** Kelipatan 360 terdekat, yaitu posisi sampul depan. */
export function frontAngle(ry: number): number {
  return Math.round(ry / 360) * 360
}

/** Kemiringan kecil mengikuti posisi mouse (0–1) saat kartu tidak di-drag. */
export function hoverTilt(px: number, py: number): { rx: number; ry: number } {
  return { rx: (0.5 - clamp(py, 0, 1)) * 14, ry: (clamp(px, 0, 1) - 0.5) * 18 }
}

/** Geseran gradien foil dan posisi pantulan cahaya (persen) dari sudut kartu. */
export function sheen(rx: number, ry: number) {
  const sx = Math.sin(ry * DEG)
  const sy = Math.sin(rx * DEG)
  return { metalX: -sx * 22, metalY: sy * 16, glareX: sx * 48, glareY: -sy * 48 }
}

/** Satu langkah pegas (Euler semi-implisit). `dt` dalam detik, `velocity` dalam derajat per detik. */
export function springStep(
  value: number,
  velocity: number,
  target: number,
  dt: number,
  stiffness = 170,
  damping = 22,
): [number, number] {
  const acceleration = stiffness * (target - value) - damping * velocity
  const next = velocity + acceleration * dt
  return [value + next * dt, next]
}

export interface FrameStats {
  /** Rata-rata frame per detik. */
  fps: number
  /** Durasi frame persentil 95 (ms). */
  p95: number
  /** Porsi frame yang lebih lama dari 20 ms (di bawah 50 fps). */
  slowShare: number
  frames: number
}

/** Ringkas durasi antar-frame (ms) jadi statistik untuk spike performa. */
export function frameStats(deltas: readonly number[]): FrameStats {
  if (deltas.length === 0) return { fps: 0, p95: 0, slowShare: 0, frames: 0 }
  const sorted = [...deltas].sort((a, b) => a - b)
  const average = sorted.reduce((sum, d) => sum + d, 0) / sorted.length
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0
  return {
    fps: Math.round((1000 / average) * 10) / 10,
    p95: Math.round(p95 * 10) / 10,
    slowShare: Math.round((deltas.filter((d) => d > 20).length / deltas.length) * 1000) / 1000,
    frames: deltas.length,
  }
}
