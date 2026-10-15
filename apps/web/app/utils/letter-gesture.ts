import {
  PAGE_MARGIN,
  contentLimits,
  elementBounds,
  type LetterElement,
  type TextElement,
} from '@postpocket/presets'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Geser elemen sejauh `dx` kali lebar dan `dy` kali tinggi halaman; titik tengahnya tetap di halaman. */
export function moved(element: LetterElement, dx: number, dy: number) {
  return { x: clamp(element.x + dx, 0, 1), y: clamp(element.y + dy, 0, 1) }
}

/**
 * Titik tengah yang menjaga seluruh elemen, setelah diputar, tetap di dalam halaman. Tinggi teks
 * bergantung pada huruf, jadi diambil dari `textHeight` (pecahan tinggi halaman) hasil ukur layar.
 * Teks juga dijaga sejauh `PAGE_MARGIN` dari tepi atas dan bawah, batas yang sama dengan ruangnya
 * (`textRooms()`); tanpa itu, teks yang didorong ke tepi terus mengecil.
 */
export function keptInPage(
  element: LetterElement,
  pageRatio: number,
  textHeight?: number,
): { x: number; y: number } {
  const box = elementBounds(element, pageRatio, textHeight)
  const within = (value: number, half: number) => (half >= 0.5 ? 0.5 : clamp(value, half, 1 - half))
  const margin = element.kind === 'text' ? PAGE_MARGIN : 0
  return {
    x: within(element.x, (box.right - box.left) / 2),
    y: within(element.y, (box.bottom - box.top) / 2 + margin),
  }
}

/** Lebar terbesar foto atau stiker yang, setelah diputar, masih muat di halaman berasio `pageRatio`. */
function widestInPage(element: LetterElement, pageRatio: number): number {
  if (element.kind === 'text') return contentLimits.width.max
  const aspect = element.kind === 'photo' ? element.aspect : 1
  const angle = (Math.abs(element.rotation) * Math.PI) / 180
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  return Math.min(1 / (cos + sin / aspect), 1 / (pageRatio * (sin + cos / aspect)))
}

/**
 * Perbesar atau perkecil elemen. Blok teks ikut membesarkan hurufnya dengan faktor yang sama.
 * Dengan `pageRatio`, foto dan stiker berhenti membesar begitu menyentuh tepi halaman.
 */
export function scaled(
  element: LetterElement,
  factor: number,
  pageRatio?: number,
): { width: number; size?: number } {
  const { width: range } = contentLimits
  const widest = pageRatio ? Math.max(range.min, widestInPage(element, pageRatio)) : range.max
  const width = clamp(element.width * factor, range.min, Math.min(range.max, widest))
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

/**
 * Cubit dua jari: rasio jarak antarjari mengubah ukuran, perubahan sudutnya memutar, dan
 * pergeseran titik tengahnya memindah elemen. `dx` dan `dy` adalah pecahan lebar dan tinggi
 * halaman; putarannya tetap menempel ke kelipatan 90°.
 */
export function pinched(
  start: LetterElement,
  pinch: { factor: number; turn: number; dx: number; dy: number },
  pageRatio?: number,
) {
  return {
    ...scaled(start, pinch.factor, pageRatio),
    rotation: snappedRotation(start.rotation + pinch.turn),
    ...moved(start, pinch.dx, pinch.dy),
  }
}

/** Id baru yang belum dipakai, misalnya `s4k2x9`. */
export function uniqueId(prefix: string, taken: ReadonlySet<string>): string {
  for (;;) {
    const id = `${prefix}${Math.random().toString(36).slice(2, 8)}`
    if (!taken.has(id)) return id
  }
}
