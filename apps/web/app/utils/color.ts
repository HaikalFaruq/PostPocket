/** Ubah warna hex 6 digit (#rrggbb) jadi komponen RGB 0–255. */
export function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match?.[1]) throw new Error(`Warna hex tidak valid: ${hex}`)
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Luminans relatif WCAG (0 = hitam, 1 = putih). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Warna gelap butuh teks terang di atasnya. */
export function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.18
}

const toHex = (rgb: number[]) =>
  `#${rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

/**
 * Nada foil kantong dari satu warna preset. `deep` adalah warna yang dikalikan dirinya sendiri
 * (seperti blend multiply): lebih gelap tapi tetap pekat dan senada, tidak keabu-abuan seperti
 * dicampur hitam. `deeper` sekali lagi, `light` kebalikannya (screen), dan `soft` di antara warna
 * dasar dan `light`. Bayangan dan kilau kantong memakai nada ini, jadi warna apa pun tetap hidup.
 */
export function packetTones(hex: string) {
  const c = hexToRgb(hex).map((v) => v / 255)
  const light = c.map((v) => 1 - (1 - v) * (1 - v))
  return {
    base: toHex(c.map((v) => v * 255)),
    deep: toHex(c.map((v) => v * v * 255)),
    deeper: toHex(c.map((v) => v * v * v * 255)),
    light: toHex(light.map((v) => v * 255)),
    soft: toHex(c.map((v, i) => ((v + light[i]!) / 2) * 255)),
  }
}
