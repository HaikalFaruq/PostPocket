<script setup lang="ts">
import { byId, letter as letterPresets } from '@postpocket/presets'
import type { FolderFile } from '~/components/kotak/GlassFolder.vue'
import { hashString } from '~/utils/folder-art'
import { PHOTO_FRONT } from '~/utils/letter-draft'
import type { ShownLetter } from '~/utils/letter-view'
import type { SavedLetter } from '~/utils/saved-letters'

/**
 * Kotak surat: surat yang disimpan penerima di perangkat ini, dikelompokkan per folder kaca.
 * Surat dari link masuk folder "Surat untukmu"; kotak bareng punya folder sendiri. Ketuk folder
 * untuk membukanya, lalu ketuk suratnya untuk membaca satu per satu.
 */
useSeoMeta({ title: 'Kotak surat · PostPocket', robots: 'noindex' })

const saved = useSavedLetters()
const memories = useMemories()
const ready = ref(false)
onMounted(async () => {
  await Promise.all([saved.load(), memories.load()])
  ready.value = true
})

// URL foto tiap momen yang dipakai surat tersimpan, dibuat sekali lalu dipakai ulang.
const urls = ref<Record<string, string | null>>({})
watch(
  () => saved.folders.flatMap((folder) => folder.items),
  async (items) => {
    for (const item of items) {
      for (const id of [item.cover?.moment, ...Object.values(item.photos)]) {
        if (!id || id in urls.value) continue
        const url = await memories.photoUrl(id)
        urls.value = { ...urls.value, [id]: url }
      }
    }
  },
  { immediate: true },
)

function shown(item: SavedLetter): ShownLetter {
  const coverUrl = item.cover ? urls.value[item.cover.moment] : null
  const photoUrls: Record<string, string> = {}
  for (const [key, moment] of Object.entries(item.photos)) {
    const url = urls.value[moment]
    if (url) photoUrls[key] = url
  }
  return {
    id: item.id,
    from: item.from,
    design: item.design,
    content: item.content,
    cover: item.cover && coverUrl ? { ...item.cover, url: coverUrl } : null,
    photoUrls,
    photoPlaceholder: 'Foto tidak tersimpan',
  }
}

const date = (value: string) =>
  new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

/** Potongan tulisan pertama surat, supaya surat tanpa nama pengirim tetap mudah dikenali. */
function snippet(item: SavedLetter): string | null {
  const text = item.content.elements.find(
    (element) => element.kind === 'text' && element.text.trim(),
  )
  if (text?.kind !== 'text') return null
  const line = Array.from(text.text.trim().split('\n')[0]!)
  return line.length > 28 ? `${line.slice(0, 28).join('').trimEnd()}…` : line.join('')
}

/** Lembar surat di folder: gambar depannya, nama pengirim (atau potongan tulisan), dan tanggal. */
function file(item: SavedLetter): FolderFile {
  const art =
    item.design.illustration === PHOTO_FRONT
      ? item.cover
        ? urls.value[item.cover.moment]
        : null
      : byId(letterPresets.illustrations, item.design.illustration)?.art
  return {
    id: item.id,
    name: item.from ? `Dari ${item.from}` : (snippet(item) ?? 'Surat untukmu'),
    meta: date(item.publishedAt),
    image: art ?? null,
    paper: byId(letterPresets.papers, item.design.paper)?.color,
  }
}

// Satu folder terbuka dalam satu waktu.
const openFolder = ref<string | null>(null)
const folderRefs = new Map<string, { sheetRect: (id: string) => DOMRect | null }>()
function setFolderRef(id: string, el: unknown) {
  if (el) folderRefs.set(id, el as { sheetRect: (id: string) => DOMRect | null })
  else folderRefs.delete(id)
}

// Lebar folder mengikuti kolom grid (1, 2, atau 3 kolom seperti kelas grid di bawah), paling
// lebar 340 px. Dihitung dari lebar layar supaya folder tidak melompat setelah grid terukur.
const { width: windowWidth } = useWindowSize()
const folderWidth = computed(() => {
  const w = windowWidth.value
  const content = Math.min(w, 1152) - (w >= 640 ? 48 : 32)
  const columns = w >= 1024 ? 3 : w >= 640 ? 2 : 1
  return Math.floor(Math.max(240, Math.min(340, (content - (columns - 1) * 40) / columns)))
})

const viewer = reactive({
  open: false,
  folder: null as string | null,
  index: 0,
  origin: null as DOMRect | null,
})
const viewerFolder = computed(() => saved.folders.find((folder) => folder.id === viewer.folder))
const viewerLetters = computed(() => viewerFolder.value?.items.map(shown) ?? [])

function read(folderId: string, index: number, fileId?: string) {
  viewer.folder = folderId
  viewer.index = index
  viewer.origin = fileId ? (folderRefs.get(folderId)?.sheetRect(fileId) ?? null) : null
  viewer.open = true
}

function cdOf(albumId: string | null) {
  return albumId
    ? memories.data.albums.find((album) => album.id === albumId && album.moments.length)
    : undefined
}

async function removeLetter(item: ShownLetter) {
  const folder = viewerFolder.value
  const cd = folder ? cdOf(folder.album) : undefined
  const note = cd ? ` Fotonya tetap ada di CD "${cd.title}".` : ''
  if (!window.confirm(`Hapus surat ini dari HP ini?${note}`)) return
  await saved.remove(item.id)
}

async function removeFolder(id: string, title: string) {
  const folder = saved.folders.find((entry) => entry.id === id)
  const cd = folder ? cdOf(folder.album) : undefined
  const note = cd ? ` Fotonya tetap ada di CD "${cd.title}".` : ''
  if (!window.confirm(`Hapus folder "${title}" beserta suratnya dari HP ini?${note}`)) return
  openFolder.value = null
  await saved.removeFolder(id)
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6" data-testid="kotak-page">
    <header class="py-4">
      <NuxtLink
        to="/"
        class="inline-flex min-h-11 items-center gap-1 text-body text-ink-muted hover:text-ink"
      >
        <Icon name="chevron-left" :size="14" /> PostPocket
      </NuxtLink>
      <h1 class="mt-2 text-[34px] leading-none font-bold tracking-[-0.035em]">Kotak surat</h1>
      <p class="mt-2 max-w-md text-pretty text-ink-muted">
        Surat yang kamu simpan di HP ini. Tetap bisa dibuka walau link-nya sudah mati, tanpa sinyal
        sekalipun.
      </p>
    </header>

    <main class="flex-1 pb-12">
      <p
        v-if="saved.saveFailed"
        role="alert"
        class="mt-2 max-w-md rounded-control bg-[#fbefd2] px-3 py-2 text-caption text-[#7a5a14]"
      >
        Browser ini menolak menyimpan perubahan, jadi surat bisa hilang kalau halaman ditutup.
      </p>

      <div
        v-if="ready && saved.folders.length"
        class="mt-10 grid justify-items-center gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
      >
        <section
          v-for="(folder, position) in saved.folders"
          :key="folder.id"
          class="flex w-full flex-col items-center"
          :aria-label="folder.title"
          data-testid="saved-folder"
        >
          <GlassFolder
            :ref="(el) => setFolderRef(folder.id, el)"
            :open="openFolder === folder.id"
            :label="folder.title"
            :art="folder.art"
            :seed="hashString(folder.id) % 997"
            :files="folder.items.map(file)"
            :width="folderWidth"
            :appear-delay="position * 120"
            @update:open="(value: boolean) => (openFolder = value ? folder.id : null)"
            @select="(item: FolderFile, index: number) => read(folder.id, index, item.id)"
          />
          <div
            v-if="openFolder === folder.id"
            class="mt-5 flex w-full max-w-[340px] flex-col gap-3 animate-rise-in"
            data-testid="folder-actions"
          >
            <ol
              v-if="folder.items.length > 4"
              class="divide-y divide-line-soft rounded-[16px] bg-surface shadow-raised"
            >
              <li v-for="(item, index) in folder.items" :key="item.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-panel"
                  @click="read(folder.id, index)"
                >
                  <span class="min-w-0 flex-1 truncate text-body font-semibold">{{
                    file(item).name
                  }}</span>
                  <span class="shrink-0 text-caption text-ink-muted">{{
                    date(item.publishedAt)
                  }}</span>
                </button>
              </li>
            </ol>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="inline-flex h-10 items-center rounded-control bg-ink px-4 text-body font-semibold text-white hover:bg-ink/90"
                data-testid="folder-read"
                @click="read(folder.id, 0)"
              >
                Baca dari awal
              </button>
              <NuxtLink
                v-if="cdOf(folder.album)"
                :to="`/tv?album=${folder.album}`"
                class="inline-flex h-10 items-center gap-2 rounded-control px-4 text-body font-semibold inset-ring inset-ring-line hover:bg-panel"
                data-testid="folder-tv"
              >
                <Icon name="play" :size="14" /> Putar fotonya di TV
              </NuxtLink>
            </div>
            <button
              type="button"
              class="self-start text-caption text-ink-muted underline underline-offset-2 hover:text-ink"
              @click="removeFolder(folder.id, folder.title)"
            >
              Hapus folder ini dari HP
            </button>
          </div>
        </section>
      </div>

      <div
        v-else-if="ready"
        class="mt-10 flex max-w-md flex-col items-start gap-4"
        data-testid="kotak-empty"
      >
        <span class="w-24 -rotate-3"><FolderMini /></span>
        <div>
          <h2 class="text-[19px] font-bold tracking-[-0.02em]">Belum ada surat tersimpan</h2>
          <p class="mt-1 text-pretty text-ink-muted">
            Buka surat yang dikirim ke kamu, ketuk kartunya, lalu pilih Simpan surat. Suratnya
            muncul di sini.
          </p>
        </div>
        <NuxtLink
          to="/letter/new"
          class="inline-flex h-11 items-center rounded-control bg-ink px-5 text-body font-semibold text-white hover:bg-ink/90"
        >
          Tulis surat
        </NuxtLink>
      </div>
    </main>

    <LetterViewer
      v-model:open="viewer.open"
      v-model:index="viewer.index"
      :letters="viewerLetters"
      :title="viewerFolder?.title ?? 'Surat'"
      :origin="viewer.origin"
    >
      <template #actions="{ letter }">
        <button
          type="button"
          class="inline-flex h-10 items-center gap-1.5 rounded-control px-3 text-body font-semibold text-ink-muted hover:bg-fill hover:text-ink"
          data-testid="viewer-remove"
          @click="removeLetter(letter)"
        >
          <Icon name="trash" :size="15" /> Hapus
        </button>
      </template>
    </LetterViewer>
  </div>
</template>
