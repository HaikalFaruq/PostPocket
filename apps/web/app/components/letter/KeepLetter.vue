<script setup lang="ts">
import { contentPhotoKeys } from '@postpocket/presets'
import type { Letter } from '~/utils/letter-api'
import {
  PhotoFetchError,
  exportPhotos,
  fetchPhoto,
  photoFileName,
  sharesToPhotos,
  type RemotePhoto,
} from '~/utils/letter-photos'
import { isInAppBrowser } from '~/utils/pwa'
import { LETTERS_FOLDER } from '~/utils/saved-letters'

/**
 * "Simpan surat ini" di halaman penerima. Surat dari link hilang 30 hari setelah dikirim dan
 * fotonya 7 hari setelah dibuka, jadi penerima bisa menyimpannya ke Kotak surat di perangkat ini
 * (fotonya sekalian masuk CD "Surat untukmu" di TV), atau mengunduh fotonya ke galeri.
 */
const props = defineProps<{ letter: Letter }>()
const saved = useSavedLetters()

const state = ref<'idle' | 'saving' | 'saved'>('idle')
const message = ref('')
const exporting = ref(false)
// Browser bawaan aplikasi lain (Instagram, LINE, …) menyimpan datanya terpisah dari Chrome atau
// Safari, jadi surat yang disimpan di sana tidak ketemu lagi dari browser biasa.
const inApp = ref(false)

onMounted(async () => {
  inApp.value = isInAppBrowser(navigator.userAgent)
  await saved.load()
  if (saved.has(props.letter.slug)) state.value = 'saved'
})

/** Foto yang masih ada di server: gambar depan dari foto user dulu, lalu foto isi. */
const remotePhotos = computed<RemotePhoto[]>(() => {
  const list: RemotePhoto[] = []
  if (props.letter.cover) list.push(props.letter.cover)
  for (const key of contentPhotoKeys(props.letter.content)) {
    const photo = props.letter.photos[key]
    if (photo) list.push(photo)
  }
  return list
})

async function keep() {
  if (state.value !== 'idle') return
  state.value = 'saving'
  message.value = ''
  try {
    await saved.keep(
      [
        {
          id: props.letter.slug,
          slug: props.letter.slug,
          from: null,
          design: props.letter.design,
          content: props.letter.content,
          cover: props.letter.cover,
          photos: props.letter.photos,
          photosDeleted: !!props.letter.photosDeletedAt,
          publishedAt: props.letter.publishedAt,
        },
      ],
      {
        id: LETTERS_FOLDER,
        title: 'Surat untukmu',
        art: 'par-avion',
        cd: { title: 'Surat untukmu', emoji: '💌' },
      },
    )
    state.value = 'saved'
  } catch (problem) {
    state.value = 'idle'
    message.value =
      problem instanceof PhotoFetchError
        ? 'Foto suratnya gagal diunduh. Cek sinyal, lalu coba lagi.'
        : 'Surat tidak bisa disimpan di browser ini. Coba unduh fotonya saja.'
  }
}

// Foto diunduh lebih dulu begitu bagian ini tampil (gambarnya biasanya sudah ada di cache), supaya
// lembar Bagikan di iPhone langsung terbuka dari ketukan. Safari menolaknya kalau ketukannya
// sudah lama berlalu.
const files = shallowRef<File[] | null>(null)
// Unduhan yang sedang berjalan dipakai bersama, supaya ketukan selama foto disiapkan tidak
// mengunduh semuanya lagi.
let preparing: Promise<File[]> | null = null
function prepareFiles(): Promise<File[]> {
  preparing ??= (async () => {
    const photos = await Promise.all(remotePhotos.value.map((photo) => fetchPhoto(photo)))
    files.value = photos.flatMap((photo, index) =>
      photo
        ? [
            new File(
              [photo.blob],
              photoFileName(`surat ${props.letter.slug}`, index, photo.blob.type),
              { type: photo.blob.type || 'image/jpeg' },
            ),
          ]
        : [],
    )
    return files.value
  })().catch((problem) => {
    preparing = null
    throw problem
  })
  return preparing
}
onMounted(() => {
  if (remotePhotos.value.length) prepareFiles().catch(() => {})
})

async function download() {
  if (exporting.value) return
  exporting.value = true
  message.value = ''
  try {
    const ready = files.value
    const list = ready ?? (await prepareFiles())
    if (!list.length) {
      message.value = 'Fotonya sudah dihapus dari server.'
      return
    }
    // Lembar Bagikan di iPhone butuh ketukan yang masih baru. Kalau fotonya baru selesai
    // disiapkan, ketukan berikutnya yang menyimpannya.
    if (!ready && sharesToPhotos(list)) {
      message.value = `${list.length} foto siap. Ketuk Unduh foto sekali lagi untuk menyimpannya.`
      return
    }
    const result = await exportPhotos(list)
    if (result === 'downloaded') message.value = `${list.length} foto diunduh ke perangkatmu.`
  } catch {
    message.value = 'Foto gagal diunduh. Cek sinyal, lalu coba lagi.'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <section
    class="mt-5 w-full max-w-sm rounded-[20px] bg-surface p-4 shadow-raised"
    aria-labelledby="keep-title"
    data-testid="keep-letter"
    :data-state="state"
  >
    <template v-if="state === 'saved'">
      <h2 id="keep-title" class="flex items-center gap-2 text-body font-semibold">
        <Icon name="check" :size="16" /> Tersimpan di HP ini
      </h2>
      <p class="mt-1 text-caption text-ink-muted">
        Buka lagi kapan saja dari Kotak surat, walau link-nya sudah mati<template
          v-if="remotePhotos.length"
          >. Fotonya juga masuk CD "Surat untukmu" di TV</template
        >.
      </p>
    </template>
    <template v-else>
      <h2 id="keep-title" class="text-body font-semibold">Simpan surat ini</h2>
      <p class="mt-1 text-caption text-ink-muted">
        Surat dari link tidak disimpan selamanya. Simpan di HP ini supaya tetap bisa dibuka<template
          v-if="remotePhotos.length"
        >
          lengkap dengan fotonya, dan fotonya sekalian masuk CD di TV</template
        >.
      </p>
      <p v-if="inApp" class="mt-2 text-caption text-ink-muted" data-testid="keep-in-app">
        Link ini terbuka di dalam aplikasi lain. Supaya ketemu lagi nanti, buka link-nya di Chrome
        atau Safari dulu, baru simpan.
      </p>
    </template>

    <div class="mt-3 flex flex-wrap gap-2">
      <NuxtLink
        v-if="state === 'saved'"
        to="/kotak"
        class="inline-flex h-11 items-center rounded-control bg-ink px-4 text-body font-semibold text-white hover:bg-ink/90"
        data-testid="keep-open-box"
      >
        Buka Kotak surat
      </NuxtLink>
      <button
        v-else
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-control bg-ink px-4 text-body font-semibold text-white hover:bg-ink/90 disabled:opacity-70"
        :disabled="state === 'saving'"
        data-testid="keep-save"
        @click="keep"
      >
        <span
          v-if="state === 'saving'"
          class="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
        {{ state === 'saving' ? 'Menyimpan…' : 'Simpan surat' }}
      </button>
      <button
        v-if="remotePhotos.length"
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-control px-4 text-body font-semibold inset-ring inset-ring-line hover:bg-panel disabled:opacity-70"
        :disabled="exporting"
        data-testid="keep-download"
        @click="download"
      >
        <Icon name="download" :size="15" /> Unduh foto
      </button>
    </div>
    <p v-if="message" role="status" class="mt-2 text-caption text-ink-muted">{{ message }}</p>
  </section>
</template>
