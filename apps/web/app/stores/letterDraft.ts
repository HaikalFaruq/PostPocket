import {
  applyTemplate,
  byId,
  contentLimits,
  contentPhotoKeys,
  letter,
  normalizeContent,
  surprise,
  type LetterContent,
  type LetterDesign,
  type LetterElement,
  type TextElement,
} from '@postpocket/presets'
import { del, get, keys, set } from 'idb-keyval'
import { defineStore } from 'pinia'
import { uniqueId } from '~/utils/letter-gesture'
import {
  PHOTO_FRONT,
  cardRatio,
  emptyDraft,
  normalizeDraft,
  toStoredPhoto,
  type DraftPhoto,
} from '~/utils/letter-draft'

const DRAFT_KEY = 'postpocket:letter-draft'
// Foto disimpan terpisah, jadi mengetik isi surat tidak menulis ulang foto berukuran megabyte.
const PHOTO_KEY = 'postpocket:letter-draft-photo'
const CONTENT_PHOTO_PREFIX = 'postpocket:letter-draft-photo:'

type ElementKind = LetterElement['kind']

/**
 * Draf surat di editor Letter. Tersimpan otomatis di IndexedDB, jadi refresh tidak
 * menghilangkan isi, dan foto tetap di browser sampai user membuat link (PRD).
 */
export const useLetterDraft = defineStore('letterDraft', () => {
  const initial = emptyDraft()
  const design = ref<LetterDesign>(initial.design)
  /** Foto gambar depan. */
  const photo = shallowRef<DraftPhoto | null>(null)
  const content = ref<LetterContent>(initial.content)
  /** Foto isi surat per kunci. */
  const photos = shallowRef<Record<string, DraftPhoto>>({})
  const ready = ref(false)
  const saveFailed = ref(false)
  let photoDirty = false
  const dirtyPhotos = new Set<string>()
  let savedPhotoKeys = new Set<string>()

  /** Gambar depan sedang memakai foto user, bukan ilustrasi. */
  const isPhotoFront = computed(() => design.value.illustration === PHOTO_FRONT && !!photo.value)
  /** Rasio kartu, juga rasio halaman surat. */
  const ratio = computed(() => cardRatio(design.value, photo.value))

  const photoUrl = ref<string | null>(null)
  watch(photo, (next) => {
    photoDirty = true
    if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
    photoUrl.value = next ? URL.createObjectURL(next.blob) : null
  })

  /** URL foto isi surat per kunci. */
  const photoUrls = shallowRef<Record<string, string>>({})
  watch(photos, (next) => {
    const urls: Record<string, string> = {}
    for (const [key, url] of Object.entries(photoUrls.value)) {
      if (next[key]) urls[key] = url
      else URL.revokeObjectURL(url)
    }
    for (const [key, item] of Object.entries(next)) {
      urls[key] ??= URL.createObjectURL(item.blob)
    }
    photoUrls.value = urls
  })

  async function load() {
    if (ready.value) return
    try {
      const [stored, storedPhoto] = await Promise.all([get(DRAFT_KEY), get(PHOTO_KEY)])
      const record =
        stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : null
      const wanted = record?.content ? contentPhotoKeys(normalizeContent(record.content)) : []
      const storedPhotos = Object.fromEntries(
        await Promise.all(wanted.map(async (key) => [key, await get(CONTENT_PHOTO_PREFIX + key)])),
      )
      const draft = normalizeDraft(
        record ? { ...record, photo: storedPhoto, photos: storedPhotos } : undefined,
      )
      design.value = draft.design
      photo.value = draft.photo
      content.value = draft.content
      photos.value = draft.photos
      savedPhotoKeys = new Set(Object.keys(draft.photos))
      await nextTick()
      photoDirty = false
      dirtyPhotos.clear()
      // Foto isi yang sudah tidak dipakai draf mana pun dibuang dari IndexedDB.
      const orphans = (await keys()).filter(
        (key): key is string =>
          typeof key === 'string' &&
          key.startsWith(CONTENT_PHOTO_PREFIX) &&
          !savedPhotoKeys.has(key.slice(CONTENT_PHOTO_PREFIX.length)),
      )
      await Promise.all(orphans.map((key) => del(key)))
    } catch {
      // IndexedDB tidak tersedia: mulai dari draf kosong.
    }
    ready.value = true
  }

  async function save() {
    const draft = {
      version: 2,
      design: { ...design.value },
      // Salinan biasa: proxy Vue tidak bisa disimpan di IndexedDB.
      content: JSON.parse(JSON.stringify(content.value)) as LetterContent,
      updatedAt: Date.now(),
    }
    try {
      await set(DRAFT_KEY, draft)
      if (photoDirty) {
        const current = photo.value
        if (current) await set(PHOTO_KEY, await toStoredPhoto(current))
        else await del(PHOTO_KEY)
        photoDirty = false
      }
      for (const key of [...dirtyPhotos]) {
        const item = photos.value[key]
        if (item) {
          await set(CONTENT_PHOTO_PREFIX + key, await toStoredPhoto(item))
          savedPhotoKeys.add(key)
        }
        dirtyPhotos.delete(key)
      }
      for (const key of [...savedPhotoKeys]) {
        if (photos.value[key]) continue
        await del(CONTENT_PHOTO_PREFIX + key)
        savedPhotoKeys.delete(key)
      }
      saveFailed.value = false
    } catch {
      saveFailed.value = true
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    [design, photo, content, photos],
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

  /** Ganti isi surat lewat `normalizeContent`, lalu buang foto isi yang tidak dipakai lagi. */
  function setContent(next: LetterContent | { elements: unknown[] }) {
    content.value = normalizeContent(next)
    const used = new Set(contentPhotoKeys(content.value))
    if (Object.keys(photos.value).some((key) => !used.has(key))) {
      photos.value = Object.fromEntries(
        Object.entries(photos.value).filter(([key]) => used.has(key)),
      )
    }
  }

  function count(kind: ElementKind): number {
    return content.value.elements.filter((element) => element.kind === kind).length
  }

  function takenIds(): Set<string> {
    return new Set(content.value.elements.map((element) => element.id))
  }

  function updateElement(id: string, patch: Record<string, unknown>) {
    setContent({
      elements: content.value.elements.map((element) =>
        element.id === id ? { ...element, ...patch } : element,
      ),
    })
  }

  function removeElement(id: string) {
    setContent({ elements: content.value.elements.filter((element) => element.id !== id) })
  }

  /** Pindahkan elemen ke tumpukan paling atas. */
  function bringToFront(id: string) {
    const element = content.value.elements.find((item) => item.id === id)
    if (!element) return
    setContent({ elements: [...content.value.elements.filter((item) => item.id !== id), element] })
  }

  /** Sedikit acak supaya elemen baru tidak menumpuk persis di tengah. */
  function jitter(random: () => number, spread: number): number {
    return (random() - 0.5) * spread
  }

  function addText(random: () => number = Math.random): string | null {
    if (count('text') >= contentLimits.text) return null
    const id = uniqueId('t', takenIds())
    const size = 0.06 * Math.min(1, 1 / ratio.value)
    const element = { kind: 'text', id, x: 0.5, y: 0.5 + jitter(random, 0.1), width: 0.7 }
    setContent({
      elements: [
        ...content.value.elements,
        { ...element, rotation: 0, text: '', size, align: 'center' },
      ],
    })
    return id
  }

  function addSticker(sticker: string, random: () => number = Math.random): string | null {
    if (count('sticker') >= contentLimits.sticker || !byId(letter.stickers, sticker)) return null
    const id = uniqueId('s', takenIds())
    const x = 0.5 + jitter(random, 0.3)
    const y = 0.5 + jitter(random, 0.3)
    const rotation = Math.round(jitter(random, 24))
    setContent({
      elements: [
        ...content.value.elements,
        { kind: 'sticker', id, x, y, width: 0.22, rotation, sticker },
      ],
    })
    return id
  }

  /**
   * Tambah foto isi surat ke slot `slotId`, ke slot kosong pertama, atau sebagai elemen foto
   * baru selama belum 4 foto. Mengembalikan id elemennya, atau `null` kalau sudah penuh.
   */
  function addPhoto(
    next: DraftPhoto,
    slotId?: string,
    random: () => number = Math.random,
  ): string | null {
    const elements = content.value.elements
    const slot =
      elements.find((e) => e.kind === 'photo' && e.id === slotId) ??
      elements.find((e) => e.kind === 'photo' && e.photo === null)
    if (!slot && count('photo') >= contentLimits.photo) return null
    const key = uniqueId('f', new Set(Object.keys(photos.value)))
    photos.value = { ...photos.value, [key]: next }
    dirtyPhotos.add(key)
    if (slot) {
      updateElement(slot.id, { photo: key })
      return slot.id
    }
    const id = uniqueId('p', takenIds())
    const rotation = Math.round(jitter(random, 8))
    const aspect = next.width / next.height
    setContent({
      elements: [
        ...elements,
        { kind: 'photo', id, x: 0.5, y: 0.45, width: 0.55, rotation, photo: key, aspect },
      ],
    })
    return id
  }

  /** Pakai template lain. Teks dan foto user tetap ada, hanya tata letaknya yang berubah. */
  function setTemplate(id: string) {
    const template = byId(letter.templates, id)
    if (!template) return
    design.value = { ...design.value, template: id }
    setContent(applyTemplate(content.value, template, ratio.value))
  }

  /** Blok teks pertama, yang ditulis langsung dari kolom isi surat di langkah 5. */
  const firstText = () => content.value.elements.find((e): e is TextElement => e.kind === 'text')
  const message = computed({
    get: () => firstText()?.text ?? '',
    set: (value: string) => {
      const first = firstText()
      const id = first?.id ?? addText()
      if (id) updateElement(id, { text: value })
    },
  })

  function surpriseMe(random: () => number = Math.random) {
    const next = surprise(design.value, random, { keepIllustration: isPhotoFront.value })
    design.value = next
    const template = byId(letter.templates, next.template)
    if (template) setContent(applyTemplate(content.value, template, ratio.value))
  }

  async function reset() {
    clearTimeout(timer)
    const fresh = emptyDraft()
    const stale = [...savedPhotoKeys]
    design.value = fresh.design
    photo.value = null
    content.value = fresh.content
    photos.value = {}
    savedPhotoKeys = new Set()
    dirtyPhotos.clear()
    try {
      await Promise.all([
        del(DRAFT_KEY),
        del(PHOTO_KEY),
        ...stale.map((key) => del(CONTENT_PHOTO_PREFIX + key)),
      ])
    } catch {
      // Tidak ada yang perlu dihapus.
    }
  }

  return {
    design,
    photo,
    photoUrl,
    isPhotoFront,
    ratio,
    content,
    photos,
    photoUrls,
    message,
    ready,
    saveFailed,
    load,
    save,
    setPhoto,
    selectFront,
    setContent,
    updateElement,
    removeElement,
    bringToFront,
    addText,
    addSticker,
    addPhoto,
    setTemplate,
    surpriseMe,
    reset,
  }
})
