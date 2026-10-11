import { byId, letter, type LetterDesign } from '@postpocket/presets'
import type { Ref } from 'vue'
import { PHOTO_FRONT } from '~/utils/letter-draft'

/**
 * Sampul kartu dari desain surat: ilustrasi atau foto user, gambar cetak, dan mask foil.
 * Dipakai editor surat dan halaman penerima, jadi kartu yang dibuka penerima sama dengan yang
 * disusun pengirim. `photoUrl` adalah foto gambar depan; kosong kalau belum ada atau sudah
 * dihapus, dan sampulnya jadi polos.
 */
export function useCardFront(design: Ref<LetterDesign>, photoUrl: Ref<string | null | undefined>) {
  const isPhoto = computed(() => design.value.illustration === PHOTO_FRONT)
  const illustration = computed(
    () => byId(letter.illustrations, design.value.illustration) ?? letter.illustrations[0]!,
  )
  const foil = computed(
    () => byId(letter.foilColors, design.value.foilColor) ?? letter.foilColors[0]!,
  )
  const paper = computed(() => byId(letter.papers, design.value.paper) ?? letter.papers[0]!)
  const source = computed(() =>
    isPhoto.value
      ? photoUrl.value
        ? { art: photoUrl.value }
        : undefined
      : { art: illustration.value.art, foil: illustration.value.foil },
  )
  const designMask = computed(() => (isPhoto.value ? undefined : illustration.value.foil))
  const foilMode = computed(() => design.value.foilMode)
  const ink = computed(() => paper.value.textColor)
  const art = usePrintArt(source, ink, foilMode)
  const { mask, busy: maskBusy } = useFoilMask(art, designMask, foilMode)
  return { isPhoto, illustration, foil, paper, art, mask, maskBusy }
}
