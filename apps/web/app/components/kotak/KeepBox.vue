<script setup lang="ts">
import { contentPhotoKeys } from '@postpocket/presets'
import type { RecipientBox } from '~/utils/box-api'
import {
  PhotoFetchError,
  exportPhotos,
  fetchPhoto,
  photoFileName,
  sharesToPhotos,
  type RemotePhoto,
} from '~/utils/letter-photos'
import { dayKey } from '~/utils/memories'
import { isInAppBrowser } from '~/utils/pwa'

/**
 * "Simpan semua" di kotak bareng: semua surat titipan disimpan ke Kotak surat di perangkat ini,
 * satu folder dengan judul dan seni kotak itu, dan semua fotonya masuk satu CD di TV. Kotak dan
 * fotonya di server tidak disimpan selamanya, jadi ini cara menjadikannya kenangan.
 */
const props = defineProps<{ box: RecipientBox }>()
const saved = useSavedLetters()
const memories = useMemories()

const folderId = computed(() => `kotak-${props.box.slug}`)
const state = ref<'idle' | 'saving' | 'saved'>('idle')
const progress = ref({ done: 0, total: 0 })
const message = ref('')
const exporting = ref(false)
const inApp = ref(false)

const missing = computed(() => props.box.letters.filter((item) => !saved.has(item.id)))
const album = computed(() => {
  const id = saved.data.folders.find((folder) => folder.id === folderId.value)?.album
  return id ? memories.data.albums.find((item) => item.id === id && item.moments.length) : undefined
})

onMounted(async () => {
  inApp.value = isInAppBrowser(navigator.userAgent)
  await Promise.all([saved.load(), memories.load()])
  if (props.box.letters.length && !missing.value.length) state.value = 'saved'
})

async function keepAll() {
  if (state.value === 'saving') return
  state.value = 'saving'
  message.value = ''
  try {
    await saved.keep(
      props.box.letters.map((item) => ({
        id: item.id,
        slug: null,
        from: item.from,
        design: item.design,
        content: item.content,
        cover: item.cover,
        photos: item.photos,
        photosDeleted: !!props.box.photosDeletedAt,
        publishedAt: item.publishedAt,
        // Foto-fotonya kenangan hari kotak dibuka, misalnya hari ulang tahunnya.
        day: dayKey(new Date(props.box.opensAt)),
      })),
      {
        id: folderId.value,
        title: props.box.title,
        art: props.box.design,
        cd: { title: props.box.title, emoji: '🎁' },
      },
      (done, total) => (progress.value = { done, total }),
    )
    state.value = 'saved'
  } catch (problem) {
    state.value = missing.value.length ? 'idle' : 'saved'
    message.value =
      problem instanceof PhotoFetchError
        ? 'Sebagian foto gagal diunduh. Cek sinyal, lalu simpan lagi untuk melanjutkan.'
        : remotePhotos.value.length
          ? 'Surat tidak bisa disimpan di browser ini. Coba unduh fotonya saja.'
          : 'Surat tidak bisa disimpan di browser ini.'
  }
}

/** Semua foto di kotak: gambar depan dari foto user dulu, lalu foto isi, per surat. */
const remotePhotos = computed(() =>
  props.box.letters.flatMap((item) => {
    const list: { from: string; photo: RemotePhoto }[] = []
    if (item.cover) list.push({ from: item.from, photo: item.cover })
    for (const key of contentPhotoKeys(item.content)) {
      const photo = item.photos[key]
      if (photo) list.push({ from: item.from, photo })
    }
    return list
  }),
)

// Foto kotak bisa puluhan, jadi tidak diunduh sebelum diminta. Di iPhone lembar Bagikan butuh
// ketukan yang masih baru, jadi ketukan pertama menyiapkan fotonya dan ketukan kedua menyimpannya.
const prepared = shallowRef<File[] | null>(null)
const readyToShare = computed(() => !!prepared.value && sharesToPhotos(prepared.value))

async function download() {
  if (exporting.value) return
  exporting.value = true
  message.value = ''
  try {
    if (!prepared.value) {
      prepared.value = await prepareFiles()
      if (!prepared.value.length) {
        prepared.value = null
        message.value = 'Fotonya sudah dihapus dari server.'
        return
      }
      if (readyToShare.value) {
        message.value = `${prepared.value.length} foto siap. Ketuk Simpan ke Foto untuk menyimpannya.`
        return
      }
    }
    const result = await exportPhotos(prepared.value)
    if (result === 'downloaded') {
      message.value = `${prepared.value.length} foto diunduh ke perangkatmu.`
    }
  } catch {
    message.value = 'Foto gagal diunduh. Cek sinyal, lalu coba lagi.'
  } finally {
    exporting.value = false
  }
}

async function prepareFiles(): Promise<File[]> {
  const photos = await Promise.all(remotePhotos.value.map((item) => fetchPhoto(item.photo)))
  return photos.flatMap((photo, index) =>
    photo
      ? [
          new File(
            [photo.blob],
            photoFileName(
              `${props.box.title} ${remotePhotos.value[index]!.from}`,
              index,
              photo.blob.type,
            ),
            { type: photo.blob.type || 'image/jpeg' },
          ),
        ]
      : [],
  )
}
</script>

<template>
  <section
    class="w-full max-w-md rounded-[20px] bg-surface p-4 shadow-raised"
    aria-labelledby="keep-box-title"
    data-testid="keep-box"
    :data-state="state"
  >
    <template v-if="state === 'saved'">
      <h2 id="keep-box-title" class="flex items-center gap-2 text-body font-semibold">
        <Icon name="check" :size="16" /> Semua surat tersimpan di HP ini
      </h2>
      <p class="mt-1 text-caption text-ink-muted">
        Buka lagi kapan saja dari Kotak surat, folder "{{ box.title }}", walau kotak ini sudah
        dihapus<template v-if="album">. Fotonya juga jadi CD "{{ album.title }}" di TV</template>.
      </p>
    </template>
    <template v-else>
      <h2 id="keep-box-title" class="text-body font-semibold">Simpan semua jadi kenangan</h2>
      <p class="mt-1 text-caption text-ink-muted">
        Kotak ini tidak disimpan selamanya. Simpan semua suratnya di HP ini<template
          v-if="remotePhotos.length"
          >, dan fotonya sekalian jadi satu CD di TV</template
        >.
      </p>
      <p v-if="inApp" class="mt-2 text-caption text-ink-muted">
        Link ini terbuka di dalam aplikasi lain. Supaya ketemu lagi nanti, buka link-nya di Chrome
        atau Safari dulu, baru simpan.
      </p>
    </template>

    <div class="mt-3 flex flex-wrap gap-2">
      <template v-if="state === 'saved'">
        <NuxtLink
          v-if="album"
          :to="`/tv?album=${album.id}`"
          class="inline-flex h-11 items-center gap-2 rounded-control bg-ink px-4 text-body font-semibold text-white hover:bg-ink/90"
          data-testid="keep-box-tv"
        >
          <Icon name="play" :size="14" /> Putar di TV
        </NuxtLink>
        <NuxtLink
          to="/kotak"
          class="inline-flex h-11 items-center rounded-control px-4 text-body font-semibold inset-ring inset-ring-line hover:bg-panel"
          data-testid="keep-box-open"
        >
          Buka Kotak surat
        </NuxtLink>
      </template>
      <button
        v-else
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-control bg-ink px-4 text-body font-semibold text-white hover:bg-ink/90 disabled:opacity-70"
        :disabled="state === 'saving'"
        data-testid="keep-box-save"
        @click="keepAll"
      >
        <span
          v-if="state === 'saving'"
          class="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
        <template v-if="state === 'saving'">
          Menyimpan {{ Math.min(progress.done + 1, progress.total || 1) }} dari
          {{ progress.total || box.letters.length }}…
        </template>
        <template v-else>Simpan semua ({{ box.letters.length }} surat)</template>
      </button>
      <button
        v-if="remotePhotos.length"
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-control px-4 text-body font-semibold inset-ring inset-ring-line hover:bg-panel disabled:opacity-70"
        :disabled="exporting"
        data-testid="keep-box-download"
        @click="download"
      >
        <Icon name="download" :size="15" />
        {{
          exporting
            ? 'Mengunduh…'
            : readyToShare
              ? `Simpan ke Foto (${prepared?.length})`
              : `Unduh semua foto (${remotePhotos.length})`
        }}
      </button>
    </div>
    <p v-if="message" role="status" class="mt-2 text-caption text-ink-muted">{{ message }}</p>
  </section>
</template>
