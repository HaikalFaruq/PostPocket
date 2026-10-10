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
