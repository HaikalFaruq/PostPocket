import letterData from '../letter.json'
import pocketData from '../pocket.json'
import tvData from '../tv.json'

export interface Option {
  id: string
  label: string
}

export interface Illustration extends Option {
  /** Gambar yang dicetak biasa (bukan foil). */
  art: string
  /** Lapisan foil bawaan desain, dipakai sebagai mask. */
  foil: string
  /** Lebar dibagi tinggi. */
  ratio: number
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

export interface Template extends Option {
  photos: number
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

export const letter: LetterPresets = letterData
export const pocket: PocketPresets = pocketData
export const tv: TvPresets = tvData

export function byId<T extends Option>(list: readonly T[], id: string): T | undefined {
  return list.find((item) => item.id === id)
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
        : pick(letter.illustrations, random),
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
