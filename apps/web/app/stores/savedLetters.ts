import { contentPhotoKeys, type LetterContent, type LetterDesign } from '@postpocket/presets'
import { get, update } from 'idb-keyval'
import { defineStore } from 'pinia'
import { PHOTO_FRONT, type DraftPhoto } from '~/utils/letter-draft'
import { fetchPhoto, type RemotePhoto } from '~/utils/letter-photos'
import { dayKey } from '~/utils/memories'
import {
  SAVED_KEY,
  emptySaved,
  normalizeSaved,
  letterMoments,
  withFolderAlbum,
  withLetter,
  withoutFolder,
  withoutLetter,
  type SavedData,
  type SavedFolder,
  type SavedLetter,
} from '~/utils/saved-letters'

/** Surat yang mau disimpan, dari `GET /l/:slug` atau kotak bareng. */
export interface KeepSource {
  id: string
  slug: string | null
  from: string | null
  design: LetterDesign
  content: LetterContent
  cover: RemotePhoto | null
  photos: Record<string, RemotePhoto>
  /** Server sudah menghapus foto surat ini. */
  photosDeleted: boolean
  publishedAt: string
  /** Hari kantong foto-fotonya. Bawaannya tanggal surat dikirim. */
  day?: string
}

/** Folder tujuan, beserta judul dan emoji CD untuk foto-fotonya. */
export interface KeepFolder extends Pick<SavedFolder, 'id' | 'title' | 'art'> {
  cd: { title: string; emoji: string }
}

/**
 * Surat tersimpan di perangkat ini (Kotak surat). Fotonya disimpan sebagai momen di useMemories,
 * jadi sekalian masuk satu CD per folder dan tetap terbaca kalau surat aslinya sudah dihapus.
 */
export const useSavedLetters = defineStore('savedLetters', () => {
  const data = shallowRef<SavedData>(emptySaved())
  const ready = ref(false)
  const saveFailed = ref(false)
  const memories = useMemories()

  async function load() {
    if (ready.value) return
    try {
      data.value = normalizeSaved(await get(SAVED_KEY))
    } catch {
      // IndexedDB tidak tersedia: mulai kosong.
    }
    ready.value = true
  }

  /**
   * Ubah data tersimpan. Perubahannya diterapkan ke isi IndexedDB saat itu dalam satu transaksi
   * (`update`), jadi tab atau jendela PWA lain yang ikut menyimpan surat tidak tertimpa salinan
   * lama. Data di layar baru berubah setelah tulisannya berhasil, supaya kegagalan tidak pernah
   * terlihat seperti "Tersimpan".
   */
  async function mutate(change: (current: SavedData) => SavedData): Promise<SavedData> {
    let next = data.value
    try {
      await update(SAVED_KEY, (stored) => {
        next = change(stored === undefined ? emptySaved() : normalizeSaved(stored))
        return JSON.parse(JSON.stringify(next))
      })
    } catch (problem) {
      saveFailed.value = true
      throw new Error('Surat tidak bisa disimpan di browser ini', { cause: problem })
    }
    data.value = next
    saveFailed.value = false
    return next
  }

  function has(id: string): boolean {
    return !!data.value.letters[id]
  }

  /**
   * Simpan surat-surat ini ke folder `folder`, satu per satu. Foto tiap surat diunduh dulu dan
   * disimpan sebagai momen; baru setelah itu suratnya dicatat, jadi surat tersimpan tidak pernah
   * menunjuk foto yang belum ada. Foto yang sudah dihapus server jadi placeholder. Gangguan
   * koneksi menghentikan proses: surat yang sudah tersimpan tetap ada, dan sisanya bisa diulang.
   */
  async function keep(
    sources: readonly KeepSource[],
    folder: KeepFolder,
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ saved: number; album: string | null }> {
    await Promise.all([load(), memories.load()])
    // Baca ulang dari IndexedDB: surat yang baru disimpan di tab lain tidak disimpan dua kali.
    try {
      data.value = normalizeSaved(await get(SAVED_KEY))
    } catch {
      // Tetap memakai data di layar.
    }
    const fresh = sources.filter((source) => !has(source.id))
    let done = 0
    onProgress?.(done, fresh.length)
    try {
      for (const source of fresh) {
        await keepOne(source, folder)
        onProgress?.(++done, fresh.length)
      }
    } finally {
      // Juga setelah gagal di tengah: surat yang sudah tersimpan tetap masuk CD-nya.
      await fileInCd(folder).catch(() => null)
    }
    const album = data.value.folders.find((entry) => entry.id === folder.id)?.album ?? null
    return { saved: done, album }
  }

  async function keepOne(source: KeepSource, folder: KeepFolder) {
    const wanted = contentPhotoKeys(source.content)
    const keys = wanted.filter((key) => source.photos[key])
    const [cover, ...photos] = await Promise.all([
      source.cover ? fetchPhoto(source.cover) : Promise.resolve(null),
      ...keys.map((key) => fetchPhoto(source.photos[key]!)),
    ])
    const found: { key: string | null; photo: DraftPhoto }[] = []
    if (cover) found.push({ key: null, photo: cover })
    keys.forEach((key, index) => {
      const photo = photos[index]
      if (photo) found.push({ key, photo })
    })
    const ids = found.length
      ? await memories.addMoments(
          found.map((item) => ({ photo: item.photo, takenAt: source.publishedAt })),
          { day: source.day ?? dayKey(new Date(source.publishedAt)), source: 'upload' },
        )
      : []
    const coverIndex = found.findIndex((item) => item.key === null)
    const item: SavedLetter = {
      id: source.id,
      folder: folder.id,
      slug: source.slug,
      from: source.from,
      design: source.design,
      content: source.content,
      cover:
        coverIndex >= 0 && source.cover
          ? { moment: ids[coverIndex]!, width: source.cover.width, height: source.cover.height }
          : null,
      photos: Object.fromEntries(
        found.flatMap((entry, index) => (entry.key ? [[entry.key, ids[index]!]] : [])),
      ),
      // Foto isi atau gambar depan dari foto user yang tidak ikut tersimpan.
      photosMissing:
        source.photosDeleted ||
        found.length < wanted.length + (source.design.illustration === PHOTO_FRONT ? 1 : 0),
      publishedAt: source.publishedAt,
      savedAt: new Date().toISOString(),
    }
    await mutate((current) => withLetter(current, item, folder))
  }

  /**
   * Pastikan semua foto surat di folder itu ada di CD-nya, termasuk dari penyimpanan sebelumnya
   * yang terputus. CD-nya dibuat kalau belum ada atau sudah dihapus user di TV.
   */
  async function fileInCd(folder: KeepFolder) {
    const current = data.value.folders.find((entry) => entry.id === folder.id)
    if (!current) return
    const moments = letterMoments(
      current.letters.map((id) => data.value.letters[id]!).filter(Boolean),
    ).filter((id) => memories.data.moments[id])
    const existing = current.album
      ? memories.data.albums.find((album) => album.id === current.album)
      : undefined
    if (existing) {
      const missing = moments.filter((id) => !existing.moments.includes(id))
      if (missing.length) await memories.addToAlbum(existing.id, missing)
      return
    }
    if (!moments.length) return
    const album = await memories.createAlbum(folder.cd.title, folder.cd.emoji, moments)
    await mutate((current) => withFolderAlbum(current, folder.id, album.id))
  }

  /** Hapus surat dari perangkat ini. Fotonya tetap di CD, karena sudah jadi kenangan sendiri. */
  async function remove(id: string) {
    await load()
    await mutate((current) => withoutLetter(current, id))
  }

  async function removeFolder(id: string) {
    await load()
    await mutate((current) => withoutFolder(current, id))
  }

  /** Folder beserta suratnya, urut baca. */
  const folders = computed(() =>
    data.value.folders.map((folder) => ({
      ...folder,
      items: folder.letters.map((id) => data.value.letters[id]!).filter(Boolean),
    })),
  )
  const count = computed(() => Object.keys(data.value.letters).length)

  return { data, ready, saveFailed, folders, count, load, has, keep, remove, removeFolder }
})
