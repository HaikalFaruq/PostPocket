import type { LetterElement } from '@postpocket/presets'

/**
 * Posisi elemen di halaman surat. Persen mengikuti kotak halaman, jadi halaman harus
 * `position: relative` (atau absolut) dengan `container-type` supaya ukuran `cqw` di dalam
 * elemen juga mengikuti lebar halaman.
 */
export function elementStyle(element: LetterElement): Record<string, string> {
  return {
    left: `${element.x * 100}%`,
    top: `${element.y * 100}%`,
    width: `${element.width * 100}%`,
    transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
  }
}

/** Label singkat elemen untuk pembaca layar dan tombol di editor. */
export function describeElement(element: LetterElement, stickerLabel?: string): string {
  switch (element.kind) {
    case 'text':
      return element.text.trim() ? `Teks: ${element.text.trim().slice(0, 40)}` : 'Teks kosong'
    case 'photo':
      return element.photo ? 'Foto' : 'Slot foto kosong'
    case 'sticker':
      return `Stiker ${stickerLabel ?? element.sticker}`
  }
}

/** Skala huruf terkecil untuk tulisan yang diperkecil supaya muat, supaya tetap terbaca. */
export const MIN_TEXT_SCALE = 0.4

/**
 * Skala huruf terbesar, dari `MIN_TEXT_SCALE` sampai 1, yang membuat tulisan setinggi `maxHeight`
 * atau kurang. `heightAt(scale)` mengukur tinggi tulisan di skala itu. Dicari dengan bagi dua
 * sebanyak tujuh langkah, jadi selisihnya di bawah 1 persen.
 */
export function fittedScale(maxHeight: number, heightAt: (scale: number) => number): number {
  const fits = (scale: number) => heightAt(scale) <= maxHeight + 0.5
  if (fits(1)) return 1
  if (!fits(MIN_TEXT_SCALE)) return MIN_TEXT_SCALE
  let low = MIN_TEXT_SCALE
  let high = 1
  for (let step = 0; step < 7; step++) {
    const middle = (low + high) / 2
    if (fits(middle)) low = middle
    else high = middle
  }
  return Math.floor(low * 1000) / 1000
}
