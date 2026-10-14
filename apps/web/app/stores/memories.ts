import { del, get, keys, set } from 'idb-keyval'
import { defineStore } from 'pinia'
import { toStoredPhoto, type DraftPhoto, type StoredPhoto } from '~/utils/letter-draft'
import { requestPersistentStorage } from '~/utils/pwa'
import type { UploadImage } from '~/utils/letter-api'
import { compressPhoto } from '~/utils/upload-image'
import {
  SPINE_COLORS,
  albumShelf,
  emptyMemories,
  hasLegacyIds,
  normalizeMemories,
  withPending,
  withUuids,
  withoutMoments,
  type Album,
  type MemoryData,
  type Moment,
  type PocketDay,
} from '~/utils/memories'

const DATA_KEY = 'postpocket:memories'
// Foto disimpan per momen sebagai byte (Safari Private Browsing menolak Blob di IndexedDB).
const PHOTO_PREFIX = 'postpocket:moment:'

/**
 * Kenangan di perangkat ini: momen (foto), hari Pocket, dan album CD. Dipakai Pocket, TV, dan
 * Booth. Sumber utamanya tetap IndexedDB; setelah login, `useSync` mencadangkan dan
 * menyinkronkannya ke akun (fase 2). Setiap perubahan dicatat di `data.pending` dalam tulisan yang
 * sama, dan setiap perubahan data dibaca lalu ditulis tanpa jeda `await`, supaya sinkron yang
 * berjalan di belakang tidak menimpa perubahan user.
 */
export const useMemories = defineStore('memories', () => {
  const data = shallowRef<MemoryData>(emptyMemories())
  const ready = ref(false)
  const saveFailed = ref(false)
  const urls = new Map<string, Promise<string | null>>()

  async function load() {
    if (ready.value) return
    try {
      data.value = normalizeMemories(await get(DATA_KEY))
      // Id lama diganti UUID sekali, dalam satu tulisan: fotonya tetap di kunci lama
      // (`photoKey`), jadi kalau terputus di tengah, data lama masih utuh dan diulang nanti.
      if (hasLegacyIds(data.value)) await persist(withUuids(data.value))
    } catch {
      // IndexedDB tidak tersedia: mulai kosong.
    }
    ready.value = true
  }

  /** Kunci foto momen di IndexedDB. Momen dari sebelum UUID memakai id lamanya. */
  function photoKey(id: string): string {
    return PHOTO_PREFIX + (data.value.moments[id]?.photoKey ?? id)
  }

  async function persist(next: MemoryData) {
    data.value = next
    try {
      await set(DATA_KEY, JSON.parse(JSON.stringify(next)))
      saveFailed.value = false
    } catch {
      saveFailed.value = true
    }
  }

  /** Foto momen dari IndexedDB, atau `null` kalau sudah tidak ada. */
  async function photo(id: string): Promise<DraftPhoto | null> {
    try {
      const stored = (await get(photoKey(id))) as StoredPhoto | undefined
      if (!stored?.bytes) return null
      return {
        blob: new Blob([stored.bytes], { type: stored.type || 'image/jpeg' }),
        width: stored.width,
        height: stored.height,
      }
    } catch {
      return null
    }
  }

  /** URL gambar momen. Dibuat sekali per momen lalu dipakai ulang. */
  function photoUrl(id: string): Promise<string | null> {
    let url = urls.get(id)
    if (!url) {
      url = photo(id).then((item) => (item ? URL.createObjectURL(item.blob) : null))
      urls.set(id, url)
    }
    return url
  }

  /** Simpan foto sebagai momen baru di hari `day`. Mengembalikan id momennya. */
  async function addMoments(
    photos: { photo: DraftPhoto; takenAt?: string }[],
    options: { day: string; source: Moment['source'] },
  ): Promise<string[]> {
    // Foto ditulis dulu, baru datanya, supaya momen tidak pernah menunjuk foto yang belum ada.
    const added: Moment[] = []
    for (const item of photos) {
      const id = crypto.randomUUID()
      await set(PHOTO_PREFIX + id, await toStoredPhoto(item.photo))
      added.push({
        id,
        day: options.day,
        takenAt: item.takenAt ?? new Date().toISOString(),
        source: options.source,
        width: item.photo.width,
        height: item.photo.height,
      })
    }
    const ids = added.map((moment) => moment.id)
    const moments = { ...data.value.moments }
    for (const moment of added) moments[moment.id] = moment
    await persist(withPending({ ...data.value, moments }, { moments: ids }))
    // Foto kenangan tidak boleh ikut terhapus saat browser membersihkan penyimpanan (PRD Risiko).
    void requestPersistentStorage()
    return ids
  }

  /** Simpan atau ganti desain kantong satu hari. */
  async function saveDay(day: PocketDay) {
    await persist(
      withPending(
        { ...data.value, days: { ...data.value.days, [day.day]: day } },
        { days: [day.day] },
      ),
    )
  }

  async function createAlbum(title: string, emoji = '📀', moments: string[] = []): Promise<Album> {
    const album: Album = {
      id: crypto.randomUUID(),
      title: title.trim().slice(0, 40) || 'Album baru',
      emoji,
      color: SPINE_COLORS[data.value.albums.length % SPINE_COLORS.length]!,
      moments,
      createdAt: new Date().toISOString(),
    }
    await persist(
      withPending({ ...data.value, albums: [...data.value.albums, album] }, { albums: [album.id] }),
    )
    return album
  }

  async function updateAlbum(id: string, patch: Partial<Pick<Album, 'title' | 'emoji' | 'color'>>) {
    await persist(
      withPending(
        {
          ...data.value,
          albums: data.value.albums.map((album) =>
            album.id === id ? { ...album, ...patch } : album,
          ),
        },
        { albums: [id] },
      ),
    )
  }

  async function addToAlbum(id: string, moments: string[]) {
    await persist(
      withPending(
        {
          ...data.value,
          albums: data.value.albums.map((album) =>
            album.id === id
              ? {
                  ...album,
                  moments: [...album.moments, ...moments.filter((m) => !album.moments.includes(m))],
                }
              : album,
          ),
        },
        { albums: [id] },
      ),
    )
  }

  async function deleteAlbum(id: string) {
    await persist(
      withPending(
        { ...data.value, albums: data.value.albums.filter((album) => album.id !== id) },
        { albums: [id] },
      ),
    )
  }

  /** Hapus momen-momen ini beserta fotonya, dari kantong dan album CD. */
  async function deleteMoments(ids: string[], dropDay?: string) {
    const gone = new Set(ids)
    const touches = (list: string[]) => list.some((id) => gone.has(id))
    const current = data.value
    // Kantong dan album yang isinya berubah ikut dicatat, supaya urutan barunya ikut tersinkron.
    const days = Object.values(current.days)
      .filter((day) => day.day === dropDay || touches(day.moments))
      .map((day) => day.day)
    const albums = current.albums.filter((album) => touches(album.moments)).map((album) => album.id)
    // Kunci fotonya diambil sebelum momennya hilang dari data (momen lama memakai `photoKey`).
    const photoKeys = ids.map(photoKey)
    await persist(
      withPending(withoutMoments(current, ids, dropDay), { moments: ids, days, albums }),
    )
    await forgetPhotos(ids, photoKeys)
  }

  async function forgetPhotos(ids: string[], photoKeys: string[]) {
    for (const [index, id] of ids.entries()) {
      const url = urls.get(id)
      urls.delete(id)
      url?.then((value) => value && URL.revokeObjectURL(value))
      try {
        await del(photoKeys[index]!)
      } catch {
        // Tidak ada yang perlu dihapus.
      }
    }
  }

  /**
   * Terapkan perubahan dari sinkron ke data terbaru. `update` dijalankan tanpa jeda `await`
   * terhadap data saat itu, jadi perubahan user yang terjadi selama sinkron tidak tertimpa. Foto
   * momen yang hilang dari data ikut dihapus.
   */
  async function applyRemote(update: (current: MemoryData) => MemoryData) {
    const current = data.value
    const next = update(current)
    // Dibandingkan per kunci foto, bukan per id: momen yang hanya berganti id (withNewIds) tetap
    // memakai fotonya.
    const keyOf = (moment: Moment) => moment.photoKey ?? moment.id
    const kept = new Set(Object.values(next.moments).map(keyOf))
    const removed = Object.values(current.moments).filter((moment) => !kept.has(keyOf(moment)))
    await persist(next)
    await forgetPhotos(
      removed.map((moment) => moment.id),
      removed.map((moment) => PHOTO_PREFIX + keyOf(moment)),
    )
  }

  /** Id momen yang fotonya ada di perangkat ini. */
  async function photosHere(): Promise<Set<string>> {
    const stored = new Set((await keys()).map(String))
    return new Set(Object.keys(data.value.moments).filter((id) => stored.has(photoKey(id))))
  }

  /** Simpan foto momen yang datang dari cadangan. */
  async function savePhoto(id: string, blob: Blob, width: number, height: number) {
    await set(PHOTO_PREFIX + id, await toStoredPhoto({ blob, width, height }))
    urls.delete(id)
  }

  /** Versi foto yang diunggah ke cadangan: JPEG ≤ 500.000 byte, sisi panjang ≤ 2048 px. */
  async function uploadVersion(id: string): Promise<UploadImage | null> {
    const item = await photo(id)
    return item ? compressPhoto(item) : null
  }

  function deleteMoment(id: string) {
    return deleteMoments([id])
  }

  /** Hapus satu kantong beserta semua fotonya. */
  function deleteDay(day: string) {
    return deleteMoments(data.value.days[day]?.moments ?? [], day)
  }

  /** Rak CD: album bulanan otomatis lalu album buatan user. */
  const shelf = computed(() => albumShelf(data.value))
  /** Jumlah hari yang sudah disimpan di Pocket. */
  const savedDays = computed(() => Object.keys(data.value.days).length)

  return {
    data,
    ready,
    saveFailed,
    shelf,
    savedDays,
    load,
    photo,
    photoUrl,
    addMoments,
    saveDay,
    createAlbum,
    updateAlbum,
    addToAlbum,
    deleteAlbum,
    deleteMoment,
    deleteMoments,
    deleteDay,
    applyRemote,
    photosHere,
    savePhoto,
    uploadVersion,
  }
})
