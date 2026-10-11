import { contentLimits, type LetterElement, type TextElement } from '@postpocket/presets'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Geser elemen sejauh `dx` kali lebar dan `dy` kali tinggi halaman; titik tengahnya tetap di halaman. */
export function moved(element: LetterElement, dx: number, dy: number) {
  return { x: clamp(element.x + dx, 0, 1), y: clamp(element.y + dy, 0, 1) }
}

/** Perbesar atau perkecil elemen. Blok teks ikut membesarkan hurufnya dengan faktor yang sama. */
export function scaled(element: LetterElement, factor: number): { width: number; size?: number } {
  const { width: range } = contentLimits
  const width = clamp(element.width * factor, range.min, range.max)
  if (element.kind !== 'text') return { width }
  const applied = width / element.width
  const size = clamp(element.size * applied, contentLimits.size.min, contentLimits.size.max)
  return { width, size }
}

/** Ubah ukuran huruf blok teks tanpa mengubah lebarnya. */
export function textSized(element: TextElement, factor: number): { size: number } {
  const { size: range } = contentLimits
  return { size: clamp(element.size * factor, range.min, range.max) }
}

/** Sudut dari titik tengah ke penunjuk, dalam derajat. */
export function pointerAngle(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI
}

/** Putaran dalam rentang -180 sampai 180, menempel ke kelipatan 90° kalau selisihnya kecil. */
export function snappedRotation(degrees: number, tolerance = 4): number {
  const normalized = ((((degrees + 180) % 360) + 360) % 360) - 180
  const nearest = Math.round(normalized / 90) * 90
  return Math.abs(normalized - nearest) <= tolerance ? nearest : normalized
}

/** Id baru yang belum dipakai, misalnya `s4k2x9`. */
export function uniqueId(prefix: string, taken: ReadonlySet<string>): string {
  for (;;) {
    const id = `${prefix}${Math.random().toString(36).slice(2, 8)}`
    if (!taken.has(id)) return id
  }
}
