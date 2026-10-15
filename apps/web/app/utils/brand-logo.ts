// Logo PostPocket, arah "P-amplop" (docs/desain.md bagian Logo): huruf P yang mangkuknya amplop,
// dengan tutup amplop emas sebagai lubangnya, plus wordmark dari Gantari ExtraBold (OFL) yang
// sudah dijadikan garis. Satu sumber untuk komponen BrandLogo, favicon, ikon PWA, gambar OG, dan
// master di docs/brand (scripts/brand.mjs). Kalau geometrinya diubah, jalankan ulang skrip itu,
// pwa-icons.mjs, dan og-images.mjs.

/** Tinta navy (--color-ink), emas foil di tutup amplop, dan kanvas Beranda sebagai latar ikon. */
export const BRAND_COLORS = { ink: '#18204a', gold: '#d9b45a', canvas: '#f1f4f8' } as const

/**
 * P-amplop di kotak 160 × 184: batang 44, mangkuk 160 × 120 bersudut kanan 36, sudut lain 8.
 * Tutup amplop 80 × 30 (sisi 3 : 4 : 5) mulai tepat di tepi dalam batang. `flapSmall` lebih dalam
 * dan lebar, untuk favicon dan ukuran di bawah 24 px.
 */
export const BRAND_SYMBOL = {
  width: 160,
  height: 184,
  outline:
    'M8 0H124A36 36 0 0 1 160 36V84A36 36 0 0 1 124 120H44V176A8 8 0 0 1 36 184H8A8 8 0 0 1 0 176V8A8 8 0 0 1 8 0Z',
  flap: 'M44 38H124L84 68Z',
  flapSmall: 'M44 34H130L87 70Z',
} as const

/**
 * "PostPocket" dalam Gantari ExtraBold, tracking −0,02 em dengan kern optis Po, tP, ck, dan ke.
 * Garis dasar di y = 0, jadi huruf kapitalnya di y = −92 dan lengkung o, c, e turun 1,4 di bawahnya.
 */
export const BRAND_WORDMARK = {
  width: 704.7,
  cap: 92,
  descent: 1.4,
  d: 'M0 0L0 -92L40.9 -92Q59.2 -92 68 -83.9Q76.8 -75.8 76.8 -61.3Q76.8 -46.7 68 -38.6Q59.2 -30.4 40.9 -30.4L23.7 -30.4L23.7 0ZM23.7 -49L37.2 -49Q44.8 -49 48.8 -51.9Q52.9 -54.7 52.9 -61.3Q52.9 -67.8 48.8 -70.6Q44.8 -73.4 37.2 -73.4L23.7 -73.4ZM117.3 1.4Q106.9 1.4 98.6 -2.8Q90.3 -7 85.7 -14.7Q81 -22.3 81 -32.4Q81 -42.6 85.7 -50.1Q90.3 -57.7 98.5 -61.9Q106.7 -66.1 117.3 -66.1Q127.9 -66.1 136.1 -61.9Q144.3 -57.7 149 -50.1Q153.7 -42.6 153.7 -32.4Q153.7 -22.3 149 -14.7Q144.3 -7 136.1 -2.8Q127.9 1.4 117.3 1.4ZM117.3 -17.9Q121.5 -17.9 124.6 -19.6Q127.7 -21.4 129.4 -24.6Q131.1 -27.8 131.1 -32.4Q131.1 -36.9 129.4 -40.1Q127.7 -43.4 124.6 -45.1Q121.5 -46.8 117.3 -46.8Q113.3 -46.8 110.2 -45.1Q107 -43.4 105.3 -40.1Q103.6 -36.9 103.6 -32.4Q103.6 -27.8 105.3 -24.6Q107 -21.4 110.2 -19.6Q113.3 -17.9 117.3 -17.9ZM187.7 1.4Q180.3 1.4 173.1 -0.7Q166 -2.8 159.5 -6.8L166.7 -22.3Q173.4 -18.3 178.9 -16.5Q184.4 -14.7 188.1 -14.7Q191.8 -14.7 193.8 -15.8Q195.8 -16.8 195.8 -18.9Q195.8 -20.5 194.3 -21.5Q192.8 -22.4 189.2 -23.1L182.1 -24.4Q171.9 -26.3 166.7 -30.9Q161.5 -35.4 161.5 -43.1Q161.5 -49.4 164.5 -54.6Q167.5 -59.8 173.7 -62.9Q180 -66.1 190.2 -66.1Q197.2 -66.1 203.8 -64.2Q210.4 -62.4 216.4 -59.1L209.5 -44.2Q205.1 -46.5 200 -48.3Q195 -50 191 -50Q187.7 -50 185.9 -49Q184.1 -48.1 184.1 -46.3Q184.1 -45 185.3 -44.2Q186.5 -43.4 190.1 -42.7L197.2 -41.5Q207.5 -39.5 213 -34.6Q218.4 -29.6 218.4 -21.6Q218.4 -11.7 210.7 -5.2Q203 1.4 187.7 1.4ZM259.1 0.8Q246.1 0.8 240.5 -4.7Q235 -10.2 235 -21.5L235 -46.7L222.4 -46.7L222.4 -64.7L235 -64.7L235 -83.2L257.3 -83.2L257.3 -64.7L272.4 -64.7L272.4 -46.7L257.3 -46.7L257.3 -23.7Q257.3 -20.7 258.9 -18.9Q260.6 -17.2 264.4 -17.2Q266.1 -17.2 268.6 -17.4Q271 -17.5 272.4 -17.8L272.4 -0.7Q270.1 0 266.4 0.4Q262.8 0.8 259.1 0.8ZM283.6 0L283.6 -92L324.5 -92Q342.8 -92 351.6 -83.9Q360.4 -75.8 360.4 -61.3Q360.4 -46.7 351.6 -38.6Q342.8 -30.4 324.5 -30.4L307.3 -30.4L307.3 0ZM307.3 -49L320.8 -49Q328.3 -49 332.4 -51.9Q336.5 -54.7 336.5 -61.3Q336.5 -67.8 332.4 -70.6Q328.3 -73.4 320.8 -73.4L307.3 -73.4ZM400.9 1.4Q390.5 1.4 382.2 -2.8Q373.9 -7 369.2 -14.7Q364.6 -22.3 364.6 -32.4Q364.6 -42.6 369.2 -50.1Q373.9 -57.7 382.1 -61.9Q390.3 -66.1 400.9 -66.1Q411.5 -66.1 419.7 -61.9Q427.9 -57.7 432.6 -50.1Q437.3 -42.6 437.3 -32.4Q437.3 -22.3 432.6 -14.7Q427.9 -7 419.7 -2.8Q411.5 1.4 400.9 1.4ZM400.9 -17.9Q405.1 -17.9 408.2 -19.6Q411.2 -21.4 413 -24.6Q414.7 -27.8 414.7 -32.4Q414.7 -36.9 413 -40.1Q411.2 -43.4 408.2 -45.1Q405.1 -46.8 400.9 -46.8Q396.9 -46.8 393.8 -45.1Q390.6 -43.4 388.9 -40.1Q387.1 -36.9 387.1 -32.4Q387.1 -27.8 388.9 -24.6Q390.6 -21.4 393.8 -19.6Q396.9 -17.9 400.9 -17.9ZM479.4 1.4Q469 1.4 460.7 -2.8Q452.4 -7 447.7 -14.7Q443.1 -22.3 443.1 -32.4Q443.1 -42.6 447.7 -50.1Q452.4 -57.7 460.7 -61.9Q469 -66.1 479.4 -66.1Q486.2 -66.1 492.2 -64.3Q498.3 -62.5 503.5 -58.8L496.1 -42.1Q491.4 -44.6 487.6 -45.7Q483.8 -46.8 479.4 -46.8Q475.4 -46.8 472.3 -45.1Q469.1 -43.4 467.4 -40.1Q465.7 -36.9 465.7 -32.4Q465.7 -27.8 467.4 -24.6Q469.1 -21.4 472.3 -19.6Q475.4 -17.9 479.4 -17.9Q483.8 -17.9 487.6 -19Q491.4 -20.1 496.1 -22.6L503.5 -5.9Q498.3 -2.2 492.2 -0.4Q486.2 1.4 479.4 1.4ZM510.7 0L510.7 -92L533.1 -92L533.1 -42.6L553.5 -64.7L578.7 -64.7L554.5 -38.8L580.1 0L554.3 0L539.6 -23L533.1 -16.1L533.1 0ZM619.6 1.4Q609.6 1.4 601 -2.3Q592.4 -6.1 587.3 -13.6Q582.2 -21.1 582.2 -32.4Q582.2 -42.7 586.8 -50.3Q591.4 -57.8 599.3 -62Q607.2 -66.1 617.1 -66.1Q627.1 -66.1 634.6 -62.5Q642.2 -59 646.5 -52.6Q650.8 -46.3 650.8 -37.9Q650.8 -35.3 650.1 -32.2Q649.4 -29.1 648.3 -26.7L604.8 -26.7Q605.4 -23.3 607.6 -20.9Q609.7 -18.6 613.4 -17.5Q617.1 -16.4 622.1 -16.4Q627.3 -16.4 632.4 -18Q637.4 -19.6 641.7 -22L648 -6.9Q641.9 -2.9 634.8 -0.8Q627.6 1.4 619.6 1.4ZM604.8 -40.5L627.9 -40.5Q628 -40.9 628.1 -41.2Q628.2 -41.6 628.2 -41.9Q628.2 -44.1 627.1 -45.7Q626 -47.4 623.6 -48.4Q621.3 -49.4 617.7 -49.4Q614.2 -49.4 611.5 -48.3Q608.7 -47.2 607 -45.2Q605.3 -43.1 604.8 -40.5ZM691.4 0.8Q678.4 0.8 672.9 -4.7Q667.3 -10.2 667.3 -21.5L667.3 -46.7L654.7 -46.7L654.7 -64.7L667.3 -64.7L667.3 -83.2L689.6 -83.2L689.6 -64.7L704.7 -64.7L704.7 -46.7L689.6 -46.7L689.6 -23.7Q689.6 -20.7 691.2 -18.9Q692.9 -17.2 696.8 -17.2Q698.4 -17.2 700.9 -17.4Q703.4 -17.5 704.7 -17.8L704.7 -0.7Q702.4 0 698.8 0.4Q695.1 0.8 691.4 0.8Z',
} as const

/** Lockup horizontal: huruf kapital rata atas dengan P, berjarak 40 dari mangkuknya. */
export const BRAND_LOCKUP = {
  gap: 40,
  width: BRAND_SYMBOL.width + 40 + BRAND_WORDMARK.width,
  height: BRAND_SYMBOL.height,
} as const

interface Paint {
  ink?: string
  /** Warna tutup amplop. Tanpa ini tutupnya tetap lubang (versi satu warna). */
  gold?: string
  small?: boolean
}

const fmt = (n: number) => String(Math.round(n * 100) / 100)

/** Path simbol di kotak 160 × 184, digeser ke (x, y) dan diskalakan. */
export function brandSymbolPaths(
  { ink = BRAND_COLORS.ink, gold, small = false }: Paint = {},
  x = 0,
  y = 0,
  scale = 1,
): string {
  const flap = small ? BRAND_SYMBOL.flapSmall : BRAND_SYMBOL.flap
  const body = `<path fill="${ink}" fill-rule="evenodd" d="${BRAND_SYMBOL.outline} ${flap}"/>`
  const lining = gold ? `<path fill="${gold}" d="${flap}"/>` : ''
  return `<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})">${body}${lining}</g>`
}

/** Path wordmark dengan garis dasar di (x, y). */
export function brandWordmarkPath(ink: string = BRAND_COLORS.ink, x = 0, y = 0, scale = 1): string {
  return `<path fill="${ink}" transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})" d="${BRAND_WORDMARK.d}"/>`
}

const svg = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" role="img" aria-label="PostPocket">${body}</svg>`

/** SVG simbol saja, tanpa ruang kosong di sekelilingnya. */
export function brandSymbolSvg(paint: Paint = { gold: BRAND_COLORS.gold }): string {
  return svg(BRAND_SYMBOL.width, BRAND_SYMBOL.height, brandSymbolPaths(paint))
}

/** SVG lockup horizontal (simbol dan wordmark), tingginya sama dengan P. */
export function brandLockupSvg(paint: Paint = { gold: BRAND_COLORS.gold }): string {
  const x = BRAND_SYMBOL.width + BRAND_LOCKUP.gap
  const height = BRAND_LOCKUP.height
  return svg(
    BRAND_LOCKUP.width,
    height,
    brandSymbolPaths(paint) + brandWordmarkPath(paint.ink, x, BRAND_WORDMARK.cap),
  )
}

/**
 * Ikon persegi: P-amplop di tengah latar kanvas Beranda. `fill` adalah tinggi P terhadap sisi
 * ikon, `radius` sudut latarnya terhadap sisi (0 untuk ikon yang dipotong sendiri oleh sistem).
 */
export function brandIconSvg(
  size: number,
  { fill = 0.6, radius = 0, small = false, background = BRAND_COLORS.canvas as string } = {},
): string {
  const scale = (fill * size) / BRAND_SYMBOL.height
  // Pusat kotak P sedikit ke kanan dan ke atas: batang di kiri dan mangkuk di atas membuat titik
  // beratnya di kiri atas, jadi tanpa geseran ini P tampak terlalu ke kiri.
  const x = (size - BRAND_SYMBOL.width * scale) / 2 + 0.01 * size
  const y = (size - BRAND_SYMBOL.height * scale) / 2 - 0.01 * size
  const tile = `<rect width="${size}" height="${size}" rx="${fmt(radius * size)}" fill="${background}"/>`
  return svg(size, size, tile + brandSymbolPaths({ gold: BRAND_COLORS.gold, small }, x, y, scale))
}
