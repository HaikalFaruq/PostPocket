import { del, get, set } from 'idb-keyval'
import { defineStore } from 'pinia'
import { toStoredPhoto, type DraftPhoto, type StoredPhoto } from '~/utils/letter-draft'
import { uniqueId } from '~/utils/letter-gesture'
import {
  SPINE_COLORS,
  albumShelf,
  emptyMemories,
  normalizeMemories,
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
 * Booth. Rilis 1 hanya di IndexedDB (PRD), jadi data tidak pindah ke perangkat lain.
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
    } catch {
      // IndexedDB tidak tersedia: mulai kosong.
    }
    ready.value = true
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
      const stored = (await get(PHOTO_PREFIX + id)) as StoredPhoto | undefined
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
    const moments = { ...data.value.moments }
    const taken = new Set(Object.keys(moments))
    const ids: string[] = []
    for (const item of photos) {
      const id = uniqueId('m', taken)
      taken.add(id)
      await set(PHOTO_PREFIX + id, await toStoredPhoto(item.photo))
      moments[id] = {
        id,
        day: options.day,
        takenAt: item.takenAt ?? new Date().toISOString(),
        source: options.source,
        width: item.photo.width,
        height: item.photo.height,
      }
      ids.push(id)
    }
    await persist({ ...data.value, moments })
    return ids
  }

  /** Simpan atau ganti desain kantong satu hari. */
  async function saveDay(day: PocketDay) {
    await persist({ ...data.value, days: { ...data.value.days, [day.day]: day } })
  }

  async function createAlbum(title: string, emoji = '📀', moments: string[] = []): Promise<Album> {
    const album: Album = {
      id: uniqueId('a', new Set(data.value.albums.map((item) => item.id))),
      title: title.trim().slice(0, 40) || 'Album baru',
      emoji,
      color: SPINE_COLORS[data.value.albums.length % SPINE_COLORS.length]!,
      moments,
      createdAt: new Date().toISOString(),
    }
    await persist({ ...data.value, albums: [...data.value.albums, album] })
    return album
  }

  async function updateAlbum(id: string, patch: Partial<Pick<Album, 'title' | 'emoji' | 'color'>>) {
    await persist({
      ...data.value,
      albums: data.value.albums.map((album) => (album.id === id ? { ...album, ...patch } : album)),
    })
  }

  async function addToAlbum(id: string, moments: string[]) {
    await persist({
      ...data.value,
      albums: data.value.albums.map((album) =>
        album.id === id
          ? {
              ...album,
              moments: [...album.moments, ...moments.filter((m) => !album.moments.includes(m))],
            }
          : album,
      ),
    })
  }

  async function deleteAlbum(id: string) {
    await persist({ ...data.value, albums: data.value.albums.filter((album) => album.id !== id) })
  }

  /** Hapus momen dari semua hari dan album, beserta fotonya. */
  async function deleteMoment(id: string) {
    const moments = Object.fromEntries(
      Object.entries(data.value.moments).filter(([key]) => key !== id),
    )
    const days = Object.fromEntries(
      Object.entries(data.value.days).map(([key, day]) => [
        key,
        { ...day, moments: day.moments.filter((m) => m !== id) },
      ]),
    )
    const albums = data.value.albums.map((album) => ({
      ...album,
      moments: album.moments.filter((m) => m !== id),
    }))
    await persist({ ...data.value, moments, days, albums })
    const url = urls.get(id)
    urls.delete(id)
    url?.then((value) => value && URL.revokeObjectURL(value))
    try {
      await del(PHOTO_PREFIX + id)
    } catch {
      // Tidak ada yang perlu dihapus.
    }
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
  }
})
