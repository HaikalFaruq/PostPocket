import type { FoilColor } from '@postpocket/presets'

/**
 * Gradien logam untuk lapisan foil. Pita terang dan gelap bergantian supaya kilaunya
 * bergeser saat kartu dimiringkan. Foil holografik memakai warna `spectrum` dari preset.
 */
export function metalGradient(foil: FoilColor): string {
  const { base, shade, light } = foil
  const spectrum = foil.iridescent ? (foil.spectrum ?? []) : []
  if (spectrum.length >= 3) {
    const at = (i: number) => spectrum[i % spectrum.length]
    return `linear-gradient(115deg, ${shade} 0%, ${at(0)} 12%, ${light} 18%, ${at(1)} 26%, ${at(2)} 36%, ${at(3)} 46%, ${at(0)} 56%, ${light} 62%, ${at(1)} 72%, ${at(4)} 84%, ${shade} 100%)`
  }
  return `linear-gradient(115deg, ${shade} 0%, ${base} 14%, ${light} 22%, ${base} 30%, ${shade} 42%, ${base} 54%, ${light} 62%, ${base} 70%, ${shade} 84%, ${base} 100%)`
}
