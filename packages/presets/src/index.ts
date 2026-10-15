import kotakData from '../kotak.json'
import letterData from '../letter.json'
import pocketData from '../pocket.json'
import tvData from '../tv.json'

export * from './letter-content'
export * from './letter-template'

export interface Option {
  id: string
  label: string
}

/** Sepasang gambar sampul: yang dicetak biasa dan lapisan foilnya. */
export interface IllustrationArt {
  /** Gambar yang dicetak biasa (bukan foil). */
  art: string
  /** Lapisan foil bawaan desain, dipakai sebagai mask. */
  foil: string
}

export interface Illustration extends Option, IllustrationArt {
  /** Lebar dibagi tinggi `art` dan `foil`, juga rasio kartu berbentuk Asli. */
  ratio: number
  /**
   * Komposisi yang digambar ulang untuk bentuk kartu lain, dengan id bentuk sebagai kunci, supaya
   * desainnya pas di kartu itu dan tidak terpotong atau membesar. Rasionya sama dengan bentuknya.
   */
  variants: Record<string, IllustrationArt>
  /**
   * Belum ditawarkan di editor dan Surprise me, tapi surat yang memakainya tetap dirender. Untuk
   * desain baru selama Edge Function `letters` (yang memvalidasi id dari berkas ini) belum
   * di-deploy ulang, supaya surat berdesain baru tidak ditolak server.
   */
  hidden?: boolean
}

export interface Shape extends Option {
  /** Lebar dibagi tinggi. Kosong berarti mengikuti gambar depan. */
  ratio?: number
}

export interface FoilMode extends Option {
  hint: string
}

export interface FoilColor extends Option {
  base: string
  shade: string
  light: string
  /** Seberapa kuat kilau (0 sampai 1). */
  sheen: number
  iridescent?: boolean
  /** Warna pelangi untuk foil holografik. */
  spectrum?: string[]
}

export interface Paper extends Option {
  color: string
  textColor: string
}

/**
 * Satu kotak di tata letak template, dalam pecahan lebar (`x`, `width`) dan tinggi (`y`,
 * `height`) halaman. `size` teks adalah pecahan sisi pendek halaman. Bentuknya dicek
 * `normalizeContent()` waktu dipakai.
 */
export interface TemplateSlot {
  kind: string
  x: number
  y: number
  width: number
  /** Khusus foto. */
  height?: number
  /** Khusus teks. */
  size?: number
  align?: string
  rotation?: number
}

export interface Template extends Option {
  photos: number
  /** `tall` untuk halaman portrait sampai persegi, `wide` untuk halaman landscape. */
  layout: { tall: TemplateSlot[]; wide: TemplateSlot[] }
}

export interface Sticker extends Option {
  src: string
}

export interface SurpriseRule {
  paper: string
  excludeFoil: string[]
}

export interface LetterPresets {
  illustrations: Illustration[]
  shapes: Shape[]
  foilModes: FoilMode[]
  foilColors: FoilColor[]
  papers: Paper[]
  templates: Template[]
  stickers: Sticker[]
  surpriseRules: SurpriseRule[]
}

export interface PacketColor extends Option {
  /** Nama rasa untuk label kombinasi, contoh "BLUEBERRY / DAISY". */
  flavor: string
  color: string
}

export interface Frame extends Option {
  hint: string
}

export interface ColorOption extends Option {
  color: string
}

export interface PocketPresets {
  packetColors: PacketColor[]
  frames: Frame[]
  frameColors: ColorOption[]
}

export interface PhotoFilter extends Option {
  /** Nilai CSS `filter`, juga dipakai untuk `ctx.filter` saat ekspor ke kanvas. */
  css: string
  /** Efek tambahan di luar CSS filter. */
  effects: string[]
}

export interface TvPresets {
  filters: PhotoFilter[]
  clayColors: ColorOption[]
}

/**
 * Seni di panel belakang folder kaca (Kotak surat): bidang noise yang dilipat lalu diberi cahaya
 * seperti permukaan cairan, digambar di browser dari resep ini. Tidak ada berkas gambarnya.
 */
export interface FolderArt extends Option {
  /** `marble` melipat warna satu sama lain; `streak` menariknya jadi jejak panjang. */
  style: 'marble' | 'streak'
  /** Dua warna atau lebih, urut sepanjang bidangnya. */
  colors: string[]
  /** Ukuran bentuk: makin kecil makin besar dan tenang. */
  scale: number
  /** Seberapa kuat bidangnya terlipat. */
  warp: number
  /** Arah aliran, radian. */
  angle: number
  /** Kilau di permukaan cairan, 0 sampai 1. */
  gloss: number
  /** Urat gelap di sepanjang lipatan, 0 sampai 1. */
  veins: number
}

export interface KotakPresets {
  folders: FolderArt[]
}

export const letter: LetterPresets = letterData
export const pocket: PocketPresets = pocketData
export const tv: TvPresets = tvData
export const kotak: KotakPresets = kotakData as KotakPresets

export function byId<T extends Option>(list: readonly T[], id: string): T | undefined {
  return list.find((item) => item.id === id)
}

/** Ilustrasi yang ditawarkan di editor (tanpa yang `hidden`). */
export function offeredIllustrations(list: readonly Illustration[] = letter.illustrations) {
  return list.filter((item) => !item.hidden)
}

/** Gambar sampul ilustrasi untuk kartu berbentuk `shape`: komposisinya sendiri, atau yang asli. */
export function illustrationArt(illustration: Illustration, shape: string): IllustrationArt {
  return illustration.variants[shape] ?? { art: illustration.art, foil: illustration.foil }
}

/** Desain surat dalam bentuk id preset, seperti kolom `design` di tabel `letters`. */
export interface LetterDesign {
  illustration: string
  shape: string
  foilMode: string
  foilBorder: boolean
  foilColor: string
  paper: string
  template: string
}

function first<T extends Option>(list: readonly T[]): string {
  const item = list[0]
  if (!item) throw new Error('Daftar preset kosong')
  return item.id
}

export const defaultLetterDesign: LetterDesign = {
  illustration: first(letter.illustrations),
  shape: first(letter.shapes),
  foilMode: first(letter.foilModes),
  foilBorder: false,
  foilColor: first(letter.foilColors),
  paper: first(letter.papers),
  template: first(letter.templates),
}

/** Apakah pasangan kertas dan warna foil boleh dipakai menurut `surpriseRules`. */
export function isAllowed(
  design: Pick<LetterDesign, 'paper' | 'foilColor'>,
  rules: readonly SurpriseRule[] = letter.surpriseRules,
): boolean {
  return !rules.some(
    (rule) => rule.paper === design.paper && rule.excludeFoil.includes(design.foilColor),
  )
}

function pick<T extends Option>(list: readonly T[], random: () => number): string {
  const item = list[Math.floor(random() * list.length)] ?? list[0]
  if (!item) throw new Error('Daftar preset kosong')
  return item.id
}

/**
 * Acak ilustrasi, bagian foil, warna foil, kertas, dan template sekaligus (tombol Surprise me).
 * Hasilnya selalu lolos `surpriseRules` dan berbeda dari desain sekarang.
 * Foto milik user tidak pernah ikut diacak: pakai `keepIllustration` kalau gambar depan
 * adalah foto user.
 */
export function surprise(
  current: LetterDesign,
  random: () => number = Math.random,
  options: { keepIllustration?: boolean } = {},
): LetterDesign {
  // Foto user tidak punya lapisan foil bawaan, jadi "Sesuai desain" tidak berlaku.
  const modes = options.keepIllustration
    ? letter.foilModes.filter((mode) => mode.id !== 'design')
    : letter.foilModes
  for (let attempt = 0; attempt < 50; attempt++) {
    const next: LetterDesign = {
      ...current,
      illustration: options.keepIllustration
        ? current.illustration
        : pick(offeredIllustrations(), random),
      foilMode: pick(modes, random),
      foilColor: pick(letter.foilColors, random),
      paper: pick(letter.papers, random),
      template: pick(letter.templates, random),
    }
    const changed = next.foilColor !== current.foilColor || next.paper !== current.paper
    if (changed && isAllowed(next)) return next
  }
  // Praktis tidak pernah terjadi; tetap kembalikan kombinasi yang sah dan berbeda.
  for (const paper of letter.papers) {
    for (const foil of letter.foilColors) {
      const next = { ...current, paper: paper.id, foilColor: foil.id }
      if (paper.id !== current.paper && isAllowed(next)) return next
    }
  }
  return current
}
