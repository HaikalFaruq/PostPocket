import { byId, illustrationArt, letter, type LetterDesign } from '@postpocket/presets'
import type { Ref } from 'vue'
import { PHOTO_FRONT } from '~/utils/letter-draft'
import { foilMaskFor } from './useFoilMask'
import { printArtFor, type Front } from './usePrintArt'

/** Bahan sampul dari desain: gambar depannya, lapisan foil bawaannya, dan warna tintanya. */
function frontParts(design: LetterDesign, photoUrl: string | null | undefined) {
  const isPhoto = design.illustration === PHOTO_FRONT
  const illustration = byId(letter.illustrations, design.illustration) ?? letter.illustrations[0]!
  const illustrationFront = illustrationArt(illustration, design.shape)
  const paper = byId(letter.papers, design.paper) ?? letter.papers[0]!
  const source: Front | undefined = isPhoto
    ? photoUrl
      ? { art: photoUrl }
      : undefined
    : illustrationFront
  return {
    isPhoto,
    illustration,
    illustrationFront,
    paper,
    source,
    designMask: isPhoto ? undefined : illustrationFront.foil,
  }
}

/**
 * Sampul kartu dari desain surat: ilustrasi atau foto user, gambar cetak, dan mask foil.
 * Dipakai editor surat dan halaman penerima, jadi kartu yang dibuka penerima sama dengan yang
 * disusun pengirim. Ilustrasi memakai komposisi untuk bentuk kartunya, jadi tidak terpotong.
 * `photoUrl` adalah foto gambar depan; kosong kalau belum ada atau sudah dihapus, dan sampulnya
 * jadi polos.
 */
export function useCardFront(design: Ref<LetterDesign>, photoUrl: Ref<string | null | undefined>) {
  const parts = computed(() => frontParts(design.value, photoUrl.value))
  const isPhoto = computed(() => parts.value.isPhoto)
  const illustration = computed(() => parts.value.illustration)
  const foil = computed(
    () => byId(letter.foilColors, design.value.foilColor) ?? letter.foilColors[0]!,
  )
  const paper = computed(() => parts.value.paper)
  const source = computed(() => parts.value.source)
  const designMask = computed(() => parts.value.designMask)
  const foilMode = computed(() => design.value.foilMode)
  const ink = computed(() => paper.value.textColor)
  const art = usePrintArt(source, ink, foilMode)
  const { mask, busy: maskBusy } = useFoilMask(art, designMask, foilMode)
  return { isPhoto, illustration, foil, paper, art, mask, maskBusy }
}

/** Tunggu sampai browser senggang, supaya penyiapan kartu tidak mengganggu animasi dan ketukan. */
function idle(): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve())
    else setTimeout(resolve, 50)
  })
}

/**
 * Siapkan sampul kartu sebelum tampil: gambar cetak dan mask foil masuk cache, dan gambarnya
 * sudah diunduh dan didekode. Kartu yang lalu dipasang langsung tampil utuh, tidak dibangun
 * bertahap (gambar polos, lalu gambar cetak, lalu foil). Tiap langkah menunggu browser senggang
 * (peta foilnya sendiri dihitung di Web Worker), dan berhenti begitu `wanted()` bernilai false.
 * Kegagalan diabaikan: kartunya tetap menyiapkan sendiri seperti biasa.
 */
export async function warmCardFront(
  design: LetterDesign,
  photoUrl: string | null | undefined,
  wanted: () => boolean = () => true,
) {
  const parts = frontParts(design, photoUrl)
  try {
    await idle()
    if (!wanted()) return
    const art = await printArtFor(parts.source, parts.paper.textColor, design.foilMode)
    await idle()
    if (!wanted()) return
    const mask = await foilMaskFor(art, parts.designMask, design.foilMode)
    for (const url of [art, mask]) {
      if (!url) continue
      await idle()
      if (!wanted()) return
      // Sama dengan <img crossorigin> di FoilCard, supaya unduhannya dipakai ulang.
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = url
      await image.decode().catch(() => null)
    }
  } catch {
    // Kartunya menyiapkan sendiri saat tampil.
  }
}
