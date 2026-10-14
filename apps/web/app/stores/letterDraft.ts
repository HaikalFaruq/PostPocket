import {
  applyTemplate,
  byId,
  contentLimits,
  contentPhotoKeys,
  fitPhoto,
  freeSpot,
  isFilledElement,
  letter,
  normalizeContent,
  surprise,
  tidyStickers as tidiedStickers,
  type LetterContent,
  type LetterDesign,
  type LetterElement,
  type TextElement,
} from '@postpocket/presets'
import { del, get, keys, set } from 'idb-keyval'
import { defineStore } from 'pinia'
import type { SentLetter } from '~/utils/letter-api'
import { uniqueId } from '~/utils/letter-gesture'
import { requestPersistentStorage } from '~/utils/pwa'
import {
  INVITE_PATTERN,
  PHOTO_FRONT,
  SLUG_PATTERN,
  cardRatio,
  emptyDraft,
  normalizeDraft,
  toStoredPhoto,
  type DraftPhoto,
  type TitipTarget,
} from '~/utils/letter-draft'

const DRAFT_KEY = 'postpocket:letter-draft'
// Foto disimpan terpisah, jadi mengetik isi surat tidak menulis ulang foto berukuran megabyte.
const PHOTO_KEY = 'postpocket:letter-draft-photo'
const CONTENT_PHOTO_PREFIX = 'postpocket:letter-draft-photo:'
// Surat yang sudah dibuat linknya dari draf ini, bersama sidik draf saat itu.
const SENT_KEY = 'postpocket:letter-draft-sent'

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
  /** Slug surat yang sedang dibalas. */
  const replyTo = ref<string | null>(null)
  /** Kotak bareng tujuan surat ini, kalau dititip (`/letter/new?titip=<kode>`). */
  const box = ref<TitipTarget | null>(null)
  /** Nama pengirim untuk surat titipan. */
  const from = ref('')
  const ready = ref(false)
  const saveFailed = ref(false)
  let photoDirty = false
  const dirtyPhotos = new Set<string>()
  let savedPhotoKeys = new Set<string>()

  /** Gambar depan sedang memakai foto user, bukan ilustrasi. */
  const isPhotoFront = computed(() => design.value.illustration === PHOTO_FRONT && !!photo.value)
  /** Rasio kartu, juga rasio halaman surat. */
  const ratio = computed(() => cardRatio(design.value, photo.value))
  /** Draf belum berisi apa pun yang bisa dikirim: tanpa isi surat dan tanpa foto depan. */
  const blank = computed(() => !isPhotoFront.value && !content.value.elements.some(isFilledElement))

  /** Potongan isi draf supaya user mengenalinya, misalnya di dialog "Masih ada draf surat". */
  const summary = computed(() => {
    const text = content.value.elements.find(
      (e): e is TextElement => e.kind === 'text' && !!e.text.trim(),
    )
    if (text) {
      const line = Array.from(text.text.trim().split('\n')[0]!)
      return line.length > 60 ? `${line.slice(0, 60).join('').trimEnd()}…` : line.join('')
    }
    const count = content.value.elements.filter((e) => e.kind === 'photo' && e.photo).length
    if (count) return `${count} foto, belum ada tulisan`
    return isPhotoFront.value ? 'Kartu bergambar foto, belum ada isinya' : 'Kartu tanpa tulisan'
  })
  /** Isi surat sudah berisi 4 foto tanpa slot kosong, jadi foto baru tidak bisa ditambahkan. */
  const photosFull = computed(() => {
    const photoSlots = content.value.elements.filter((e) => e.kind === 'photo')
    return photoSlots.length >= contentLimits.photo && photoSlots.every((e) => e.photo)
  })

  // Sidik draf: desain, isi, foto depan, dan kotak tujuannya. Berubah begitu user mengubah apa
  // pun, termasuk menitipkannya ke kotak lain atau mengganti nama pengirim.
  const signature = computed(() =>
    JSON.stringify([
      design.value,
      content.value,
      photo.value && [photo.value.blob.size, photo.value.width, photo.value.height],
      ...(box.value ? [box.value.invite, from.value.trim()] : []),
    ]),
  )
  const sentMark = shallowRef<{ signature: string; letter: SentLetter } | null>(null)
  /** Surat yang sudah dibuat linknya dari draf ini, selama drafnya belum diubah sejak itu. */
  const sent = computed(() =>
    sentMark.value?.signature === signature.value ? sentMark.value.letter : null,
  )

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
      replyTo.value = draft.replyTo
      box.value = draft.box
      from.value = draft.from
      savedPhotoKeys = new Set(Object.keys(draft.photos))
      const mark = (await get(SENT_KEY)) as { signature?: unknown; letter?: SentLetter } | undefined
      sentMark.value =
        typeof mark?.signature === 'string' && mark.letter?.url
          ? { signature: mark.signature, letter: mark.letter }
          : null
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
      replyTo: replyTo.value,
      box: box.value ? { ...box.value } : null,
      from: from.value,
      updatedAt: Date.now(),
    }
    try {
      // Foto ditulis dulu, baru isi draf yang menunjuknya. Kalau halaman ditinggal di tengah jalan,
      // draf lama tetap utuh dan tidak pernah menunjuk foto yang belum tersimpan (slotnya kosong).
      let wrotePhoto = false
      const current = photo.value
      const frontChanged = photoDirty
      if (frontChanged && current) {
        await set(PHOTO_KEY, await toStoredPhoto(current))
        wrotePhoto = true
      }
      for (const key of [...dirtyPhotos]) {
        const item = photos.value[key]
        if (item) {
          await set(CONTENT_PHOTO_PREFIX + key, await toStoredPhoto(item))
          savedPhotoKeys.add(key)
          wrotePhoto = true
        }
        dirtyPhotos.delete(key)
      }
      await set(DRAFT_KEY, draft)
      if (frontChanged) {
        if (!current) await del(PHOTO_KEY)
        photoDirty = false
      }
      // Draf berfoto ikut dijaga dari pembersihan penyimpanan browser.
      if (wrotePhoto) void requestPersistentStorage()
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
    [design, photo, content, photos, replyTo, box, from],
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

  /** Putaran acak kecil untuk elemen baru, supaya terlihat ditempel tangan. */
  function jitter(random: () => number, spread: number): number {
    return (random() - 0.5) * spread
  }

  // Elemen baru ditaruh di tempat yang paling kosong (`freeSpot`), supaya tidak menimpa tulisan.

  function addText(random: () => number = Math.random): string | null {
    if (count('text') >= contentLimits.text) return null
    const id = uniqueId('t', takenIds())
    const size = 0.06 * Math.min(1, 1 / ratio.value)
    const { x, y } = freeSpot(
      content.value,
      0.7,
      2 * size * 1.25 * ratio.value,
      ratio.value,
      random,
    )
    setContent({
      elements: [
        ...content.value.elements,
        { kind: 'text', id, x, y, width: 0.7, rotation: 0, text: '', size, align: 'center' },
      ],
    })
    return id
  }

  function addSticker(sticker: string, random: () => number = Math.random): string | null {
    if (count('sticker') >= contentLimits.sticker || !byId(letter.stickers, sticker)) return null
    const id = uniqueId('s', takenIds())
    const width = 0.22
    const { x, y } = freeSpot(content.value, width, width * ratio.value, ratio.value, random)
    const rotation = Math.round(jitter(random, 24))
    setContent({
      elements: [
        ...content.value.elements,
        { kind: 'sticker', id, x, y, width, rotation, sticker },
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
    // Foto baru diperkecil kalau perlu, supaya tidak menimpa tulisan, dan diletakkan di bawah
    // stiker supaya stiker yang sudah ada tidak tertutup.
    let place = { x: 0.5, y: 0.5, width: 0.55 }
    for (const width of [0.55, 0.45, 0.36, 0.28]) {
      const spot = freeSpot(
        content.value,
        width,
        (width / aspect) * ratio.value,
        ratio.value,
        random,
      )
      place = { x: spot.x, y: spot.y, width }
      if (!spot.coversText) break
    }
    const firstSticker = elements.findIndex((e) => e.kind === 'sticker')
    const at = firstSticker < 0 ? elements.length : firstSticker
    const element = { kind: 'photo', id, ...place, rotation, photo: key, aspect }
    setContent({ elements: [...elements.slice(0, at), element, ...elements.slice(at)] })
    return id
  }

  /**
   * Bingkai foto isi mengikuti bentuk fotonya, jadi foto dari Pocket atau Booth tampil utuh.
   * Tanpa `ids`, semua foto isi; `grow` lihat `fitPhoto()`.
   */
  function fitPhotos({ ids, grow }: { ids?: string[]; grow?: number } = {}) {
    setContent({
      elements: content.value.elements.map((element) => {
        if (element.kind !== 'photo' || !element.photo) return element
        if (ids && !ids.includes(element.id)) return element
        const item = photos.value[element.photo]
        return item ? fitPhoto(element, item.width / item.height, ratio.value, { grow }) : element
      }),
    })
  }

  /** Stiker yang menutupi teks atau foto dipindah ke tempat yang kosong. */
  function tidyStickers(random: () => number = Math.random) {
    setContent(tidiedStickers(content.value, ratio.value, random))
  }

  /**
   * Pakai template lain. Teks dan foto user tetap ada, hanya tata letaknya yang berubah; stiker
   * yang jadi menutupi tulisan atau foto dipindah ke tempat kosong.
   */
  function setTemplate(id: string) {
    const template = byId(letter.templates, id)
    if (!template) return
    design.value = { ...design.value, template: id }
    setContent(tidiedStickers(applyTemplate(content.value, template, ratio.value), ratio.value))
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
    if (template) {
      setContent(tidiedStickers(applyTemplate(content.value, template, ratio.value), ratio.value))
    }
  }

  /** Tandai draf ini sebagai balasan untuk surat `slug`, atau `null` untuk batal membalas. */
  function setReplyTo(slug: string | null) {
    replyTo.value = slug && SLUG_PATTERN.test(slug) ? slug : null
    // Surat titipan tidak bisa sekaligus jadi balasan (kontrak 0.3.0).
    if (replyTo.value) box.value = null
  }

  /** Titip draf ini ke kotak bareng `target`, atau `null` untuk batal menitip. */
  function setBox(target: TitipTarget | null) {
    box.value = target && INVITE_PATTERN.test(target.invite) ? { ...target } : null
    if (box.value) replyTo.value = null
  }

  /** Tandai draf ini sudah jadi link `letter`. Tanda hilang sendiri kalau drafnya diubah. */
  async function markSent(letter: SentLetter) {
    // Simpan draf saat itu juga, supaya draf yang tersimpan sama dengan yang ditandai terkirim.
    clearTimeout(timer)
    await save()
    sentMark.value = { signature: signature.value, letter: { ...letter } }
    try {
      await set(SENT_KEY, { signature: signature.value, letter: { ...letter } })
    } catch {
      // Tanpa IndexedDB tanda ini hanya bertahan sampai halaman ditutup.
    }
  }

  async function clearSent() {
    sentMark.value = null
    try {
      await del(SENT_KEY)
    } catch {
      // Tidak ada yang perlu dihapus.
    }
  }

  async function reset() {
    clearTimeout(timer)
    const fresh = emptyDraft()
    const stale = [...savedPhotoKeys]
    design.value = fresh.design
    photo.value = null
    content.value = fresh.content
    photos.value = {}
    replyTo.value = null
    box.value = null
    savedPhotoKeys = new Set()
    dirtyPhotos.clear()
    sentMark.value = null
    try {
      await Promise.all([
        del(DRAFT_KEY),
        del(SENT_KEY),
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
    blank,
    summary,
    photosFull,
    sent,
    markSent,
    clearSent,
    ratio,
    content,
    photos,
    photoUrls,
    replyTo,
    box,
    from,
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
    fitPhotos,
    tidyStickers,
    addSticker,
    addPhoto,
    setTemplate,
    setReplyTo,
    setBox,
    surpriseMe,
    reset,
  }
})
