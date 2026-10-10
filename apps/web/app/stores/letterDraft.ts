import { surprise, type LetterDesign } from '@postpocket/presets'
import { del, get, set } from 'idb-keyval'
import { defineStore } from 'pinia'
import {
  PHOTO_FRONT,
  emptyDraft,
  normalizeDraft,
  type DraftPhoto,
  type LetterDraft,
  type StoredPhoto,
} from '~/utils/letter-draft'

const DRAFT_KEY = 'postpocket:letter-draft'
// Foto disimpan terpisah, jadi mengetik isi surat tidak menulis ulang foto berukuran megabyte.
const PHOTO_KEY = 'postpocket:letter-draft-photo'

/**
 * Draf surat di editor Letter. Tersimpan otomatis di IndexedDB, jadi refresh tidak
 * menghilangkan isi, dan foto tetap di browser sampai user membuat link (PRD).
 */
export const useLetterDraft = defineStore('letterDraft', () => {
  const initial = emptyDraft()
  const design = ref<LetterDesign>(initial.design)
  const photo = shallowRef<DraftPhoto | null>(null)
  const message = ref('')
  const ready = ref(false)
  const saveFailed = ref(false)
  let photoDirty = false

  /** Gambar depan sedang memakai foto user, bukan ilustrasi. */
  const isPhotoFront = computed(() => design.value.illustration === PHOTO_FRONT && !!photo.value)

  const photoUrl = ref<string | null>(null)
  watch(photo, (next) => {
    photoDirty = true
    if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
    photoUrl.value = next ? URL.createObjectURL(next.blob) : null
  })

  async function load() {
    if (ready.value) return
    try {
      const [stored, storedPhoto] = await Promise.all([get(DRAFT_KEY), get(PHOTO_KEY)])
      const draft = normalizeDraft(
        stored && typeof stored === 'object' ? { ...stored, photo: storedPhoto } : undefined,
      )
      design.value = draft.design
      photo.value = draft.photo
      message.value = draft.message
      await nextTick()
      photoDirty = false
    } catch {
      // IndexedDB tidak tersedia: mulai dari draf kosong.
    }
    ready.value = true
  }

  async function save() {
    const draft: Omit<LetterDraft, 'photo'> = {
      version: 1,
      design: { ...design.value },
      message: message.value,
      updatedAt: Date.now(),
    }
    try {
      await set(DRAFT_KEY, draft)
      if (photoDirty) {
        const current = photo.value
        if (current) {
          const stored: StoredPhoto = {
            bytes: await current.blob.arrayBuffer(),
            type: current.blob.type,
            width: current.width,
            height: current.height,
          }
          await set(PHOTO_KEY, stored)
        } else {
          await del(PHOTO_KEY)
        }
        photoDirty = false
      }
      saveFailed.value = false
    } catch {
      saveFailed.value = true
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    [design, photo, message],
    () => {
      if (!ready.value) return
      clearTimeout(timer)
      timer = setTimeout(save, 250)
    },
    { deep: true },
  )

  /** Pilih gambar depan: id ilustrasi, atau foto user yang sudah di-upload. */
  function selectFront(id: string) {
    if (id === PHOTO_FRONT) {
      if (!photo.value) return
      design.value = {
        ...design.value,
        illustration: PHOTO_FRONT,
        foilMode: design.value.foilMode === 'design' ? 'detail' : design.value.foilMode,
      }
      return
    }
    design.value = { ...design.value, illustration: id }
  }

  function setPhoto(next: DraftPhoto) {
    photo.value = next
    selectFront(PHOTO_FRONT)
  }

  function surpriseMe(random: () => number = Math.random) {
    design.value = surprise(design.value, random, { keepIllustration: isPhotoFront.value })
  }

  async function reset() {
    clearTimeout(timer)
    const fresh = emptyDraft()
    design.value = fresh.design
    photo.value = null
    message.value = ''
    try {
      await Promise.all([del(DRAFT_KEY), del(PHOTO_KEY)])
    } catch {
      // Tidak ada yang perlu dihapus.
    }
  }

  return {
    design,
    photo,
    photoUrl,
    isPhotoFront,
    message,
    ready,
    saveFailed,
    load,
    save,
    setPhoto,
    selectFront,
    surpriseMe,
    reset,
  }
})
