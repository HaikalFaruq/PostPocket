<script setup lang="ts">
import { byId, letter as letterPresets } from '@postpocket/presets'
import type { FolderFile } from '~/components/kotak/GlassFolder.vue'
import { warmCardFront } from '~/composables/useCardFront'
import { folderSeed } from '~/utils/folder-art'
import { calmMotion } from '~/utils/render'
import { formatDay } from '~/utils/box-time'
import { letterFront, type ShownLetter } from '~/utils/letter-view'
import { listBoxes, type MyBox } from '~/utils/my-boxes'
import { LETTERS_FOLDER, type SavedLetter } from '~/utils/saved-letters'

/**
 * Kotak surat: surat yang disimpan penerima di perangkat ini, dikelompokkan per folder kaca.
 * Surat dari link masuk folder "Surat untukmu"; kotak bareng punya folder sendiri. Ketuk folder
 * untuk membukanya, lalu ketuk suratnya untuk membaca satu per satu.
 */
useSeoMeta({ title: 'Kotak surat · PostPocket', robots: 'noindex' })
definePageMeta({
  // Back ke halaman ini digulir halaman ini sendiri setelah folder-foldernya tampil (`LeftAt`),
  // bukan digulir router ke atas selagi halamannya masih kosong.
  scrollToTop: () => !(history.state as { kotak?: unknown } | null)?.kotak,
})

const saved = useSavedLetters()
const memories = useMemories()
const ready = ref(false)
// Kotak bareng yang dibuat dari browser ini (kontrak 0.3.0), kalau fiturnya sudah dinyalakan.
const kotakBareng = !!useRuntimeConfig().public.kotakBareng
const myBoxes = ref<MyBox[]>([])
const route = useRoute()
const router = useRouter()
/** Kabar dari halaman kelola setelah kotak bareng dihapus (`?dihapus=<judul>`). */
const deleted = ref('')
/** Ruang simpan browser untuk situs ini hampir habis, jadi surat baru bisa gagal disimpan. */
const storageNearlyFull = ref(false)
/**
 * Posisi gulir dan folder yang terbuka saat halaman ini ditinggal, disimpan di entri riwayatnya
 * (`history.state.kotak`), supaya Back ke sini (misalnya dari TV) mendarat di tempat yang sama.
 * Router sendiri baru menyimpan posisi gulir setelah beberapa kali pindah halaman.
 */
interface LeftAt {
  top: number
  folder: string | null
}
onBeforeRouteLeave(() => {
  // Saat folder terbuka, useBackToClose membatalkan pindah halaman yang pertama, mengambil entri
  // tambahannya, lalu pindah lagi; yang tercatat entri halaman ini, di percobaan kedua.
  const left: LeftAt = { top: Math.round(window.scrollY), folder: openFolder.value }
  history.replaceState({ ...history.state, kotak: left }, '')
})

/** Folder dari link yang dibuka saat halaman dimuat, dan surat yang sekalian dibaca. */
interface LinkTarget {
  folder: string
  letter?: number
}
/**
 * Folder tujuan link tampil sudah tersusun (tanpa animasi masuk), lalu dibuka seperti diketuk.
 * Animasi masuk dan animasi buka yang berjalan bersamaan saling menumpuk: kipasnya naik lalu turun
 * lagi.
 */
const settled = ref<string | null>(null)
/**
 * Halaman dipulihkan lewat Back: folder-foldernya langsung tampil seperti saat ditinggal, tanpa
 * animasi masuk.
 */
const restored = ref(false)

onMounted(async () => {
  const left = (history.state as { kotak?: LeftAt | null } | null)?.kotak
  await Promise.all([saved.load(), memories.load()])
  if (kotakBareng) myBoxes.value = await listBoxes()
  if (typeof route.query.dihapus === 'string') {
    deleted.value = `Kotak "${route.query.dihapus}" sudah dihapus, beserta link titip dan link bukanya.`
    await router.replace({ query: {} })
  }
  const link = await linkTarget()
  restored.value = !link && !!left
  if (link) settled.value = link.folder
  else if (left?.folder && folders.value.some((folder) => folder.id === left.folder)) {
    // Folder yang terbuka saat halaman ditinggal (misalnya ke TV) sudah terbuka lagi sejak tampil.
    openFolder.value = left.folder
    warmFolder(left.folder)
  }
  ready.value = true
  void checkStorage()
  await nextTick()
  if (link) await openLink(link)
  else if (left) {
    window.scrollTo({ top: left.top, behavior: 'instant' })
    // Sekali pakai: muat ulang nanti memakai posisi gulirnya sendiri.
    history.replaceState({ ...history.state, kotak: null }, '')
  }
})

/**
 * Folder dari link tampil tertutup di tempatnya dulu, lalu terbuka seperti diketuk. Dengan
 * `baca=1`, suratnya tumbuh dari lembarnya setelah kipasnya hampir selesai terbuka.
 */
async function openLink(target: LinkTarget) {
  sections.get(target.folder)?.scrollIntoView({ block: 'start' })
  // Keadaan tertutupnya harus sempat tergambar satu frame. Tanpa itu browser langsung menggambar
  // folder yang sudah terbuka, tanpa animasi.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  toggleFolder(target.folder, true)
  if (target.letter === undefined) return
  // Kipasnya bergerak 0,75 s, tapi sudah hampir diam setelah 0,6 s.
  await new Promise((resolve) => setTimeout(resolve, calmMotion() ? 0 : 600))
  const item = folders.value.find((entry) => entry.id === target.folder)?.items[target.letter]
  if (item && openFolder.value === target.folder && !viewer.open) {
    read(target.folder, target.letter, item.id)
  }
}

/**
 * Peringatan sebelum memori penuh: Kotak surat tidak punya batas jumlah, batasnya ruang simpan
 * browser di HP ini. Di atas 90% terpakai, surat dan foto baru bisa gagal disimpan.
 */
async function checkStorage() {
  try {
    const { usage, quota } = (await navigator.storage?.estimate?.()) ?? {}
    storageNearlyFull.value = !!usage && !!quota && usage / quota > 0.9
  } catch {
    // Browser yang tidak memberi angkanya tetap memberi tahu saat menyimpan gagal.
  }
}

// Folder "Surat untukmu" terus bertambah seperti kotak masuk, jadi surat terbaru di depan: yang
// baru disimpan langsung terlihat di kipas. Folder kotak bareng tetap urut titipannya.
const folders = computed(() =>
  saved.folders.map((folder) =>
    folder.id === LETTERS_FOLDER ? { ...folder, items: [...folder.items].reverse() } : folder,
  ),
)

/**
 * Dibuka dari "Buka Kotak surat" (`?surat=<id>` atau `?folder=<id>`): folder suratnya langsung
 * terbuka dan terlihat. Dengan `baca=1` suratnya sekalian dibuka di penampil, misalnya dari link
 * surat yang sudah mati tapi suratnya masih tersimpan di sini.
 */
async function linkTarget(): Promise<LinkTarget | null> {
  const { surat, folder: folderId, baca } = route.query
  if (typeof surat !== 'string' && typeof folderId !== 'string') return null
  // Alamatnya dibersihkan dulu, baru penampil dibuka: Back yang menutup penampil kembali ke
  // /kotak, bukan ke alamat yang membuka suratnya lagi.
  await router.replace({ query: {} })
  const folder = folders.value.find((entry) =>
    typeof surat === 'string'
      ? entry.items.some((item) => item.id === surat)
      : entry.id === folderId,
  )
  if (!folder) return null
  const at = folder.items.findIndex((item) => item.id === surat)
  return { folder: folder.id, letter: baca === '1' && at >= 0 ? at : undefined }
}

// URL foto tiap momen yang dipakai surat tersimpan, dibuat sekali lalu dipakai ulang.
const urls = ref<Record<string, string | null>>({})
watch(
  () => folders.value.flatMap((folder) => folder.items),
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

const dayFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })
const date = (value: string) => dayFormat.format(new Date(value))

/** Potongan tulisan pertama surat, supaya surat tanpa nama pengirim tetap mudah dikenali. */
function snippet(item: SavedLetter): string | null {
  const text = item.content.elements.find(
    (element) => element.kind === 'text' && element.text.trim(),
  )
  if (text?.kind !== 'text') return null
  const line = Array.from(text.text.trim().split('\n')[0]!)
  if (line.length <= 28) return line.join('')
  // Tanda baca di ujung potongan dibuang, supaya tidak jadi "foto.…".
  return `${line
    .slice(0, 28)
    .join('')
    .replace(/[\s.,;:!?-]+$/, '')}…`
}

/** Lembar surat di folder: gambar depannya, nama pengirim (atau potongan tulisan), dan tanggal. */
function file(item: SavedLetter): FolderFile {
  return {
    id: item.id,
    name: item.from ? `Dari ${item.from}` : (snippet(item) ?? 'Surat untukmu'),
    meta: date(item.publishedAt),
    image: letterFront(item.design, item.cover ? urls.value[item.cover.moment] : null),
    paper: byId(letterPresets.papers, item.design.paper)?.color,
  }
}

// Lembar tiap folder dihitung sekali per perubahan surat, bukan setiap halaman digambar ulang
// (misalnya saat folder dibuka), supaya ketukan di folder tetap ringan di HP lambat.
const folderFiles = computed(
  () => new Map(folders.value.map((folder) => [folder.id, folder.items.map(file)])),
)

// Satu folder terbuka dalam satu waktu. Back di HP menutup folder yang terbuka dulu (penampil di
// atasnya lebih dulu lagi), baru meninggalkan halaman.
const openFolder = ref<string | null>(null)
useBackToClose(
  () => openFolder.value !== null,
  () => {
    openFolder.value = null
  },
)
const sections = new Map<string, HTMLElement>()
function setSection(id: string, el: unknown) {
  if (el instanceof HTMLElement) sections.set(id, el)
  else sections.delete(id)
}

/**
 * Buka atau tutup folder `id`; folder lain yang sedang terbuka ikut menutup. Folder yang menutup
 * di atasnya mengecil, jadi selama animasinya folder yang diketuk ditahan di tempatnya, tidak
 * terlempar ke atas layar.
 */
function toggleFolder(id: string, value: boolean) {
  const previous = openFolder.value
  openFolder.value = value ? id : null
  if (value) warmFolder(id)
  const el = sections.get(id)
  if (!value || !previous || previous === id || !el) return
  holdInPlace(() => el.getBoundingClientRect().top)
}

// Folder yang menutup sendiri (diketuk lagi, atau Back): kacanya ditahan di tempatnya di layar.
// Ruang kipas di atasnya mengecil, jadi tanpa ini kacanya naik sejauh itu, bisa sampai keluar
// layar.
watch(openFolder, (now, before) => {
  if (before && !now) holdInPlace(() => folderRefs.get(before)?.glassRect()?.top)
})

/**
 * Menahan posisi `measure()` di layar selama folder bergerak (0,75 s ditambah satu frame): tiap
 * frame selisihnya digulir balik. Berhenti kalau pengguna menggulir sendiri. Di ujung atas dan
 * bawah halaman, gulirnya tertahan browser, jadi yang ditahan ikut bergeser.
 */
function holdInPlace(measure: () => number | undefined) {
  const start = measure()
  if (start === undefined) return
  const until = performance.now() + 800
  let stopped = false
  const events = ['wheel', 'touchstart', 'keydown'] as const
  const stop = () => {
    stopped = true
    for (const name of events) window.removeEventListener(name, stop)
  }
  for (const name of events) window.addEventListener(name, stop, { passive: true })
  const hold = () => {
    if (stopped) return
    const drift = (measure() ?? start) - start
    if (Math.abs(drift) >= 0.5) window.scrollBy({ top: drift, behavior: 'instant' })
    if (performance.now() < until) requestAnimationFrame(hold)
    else stop()
  }
  requestAnimationFrame(hold)
}

/**
 * Dua surat terdepan di folder yang baru dibuka disiapkan satu per satu setelah kipasnya selesai
 * bergerak, saat browser senggang, jadi kartu yang diketuk langsung tampil utuh.
 */
function warmFolder(id: string) {
  const items = folders.value.find((entry) => entry.id === id)?.items.slice(0, 2) ?? []
  const wanted = () => openFolder.value === id
  setTimeout(async () => {
    for (const item of items) {
      if (!wanted()) return
      await warmCardFront(item.design, shown(item).cover?.url, wanted)
    }
  }, 700)
}
/** Judul halaman: tujuan fokus kalau folder yang membuka penampil ikut terhapus. */
const heading = ref<HTMLElement | null>(null)
interface FolderHandle {
  sheetRect: (id: string) => DOMRect | null
  glassRect: () => DOMRect | null
}
const folderRefs = new Map<string, FolderHandle>()
function setFolderRef(id: string, el: unknown) {
  if (el) folderRefs.set(id, el as FolderHandle)
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
const viewerFolder = computed(() => folders.value.find((folder) => folder.id === viewer.folder))
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
  // Surat terakhir di folder: foldernya ikut hilang dan penampilnya menutup sendiri.
  if (folder && openFolder.value === folder.id && !folderExists(folder.id)) openFolder.value = null
}

function folderExists(id: string) {
  return folders.value.some((entry) => entry.id === id)
}

async function removeFolder(id: string, title: string) {
  const folder = folders.value.find((entry) => entry.id === id)
  const cd = folder ? cdOf(folder.album) : undefined
  const note = cd ? ` Fotonya tetap ada di CD "${cd.title}".` : ''
  if (!window.confirm(`Hapus folder "${title}" beserta suratnya dari HP ini?${note}`)) return
  openFolder.value = null
  await saved.removeFolder(id)
}
</script>

<template>
  <div
    class="mx-auto flex min-h-dvh max-w-6xl flex-col overflow-x-clip px-4 sm:px-6"
    data-testid="kotak-page"
  >
    <!-- overflow-x-clip: kipas folder yang terbuka boleh melewati tepi layar HP tanpa membuat
         halamannya bisa digeser ke samping. -->
    <header class="py-4">
      <NuxtLink
        to="/"
        class="inline-flex min-h-11 items-center gap-1 text-body text-ink-muted hover:text-ink"
      >
        <Icon name="chevron-left" :size="14" /> PostPocket
      </NuxtLink>
      <h1
        ref="heading"
        tabindex="-1"
        class="mt-2 text-[34px] leading-none font-bold tracking-[-0.035em] outline-none"
      >
        Kotak <span class="hand-word">surat</span>
      </h1>
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
      <p
        v-else-if="storageNearlyFull"
        role="status"
        class="mt-2 max-w-md rounded-control bg-[#fbefd2] px-3 py-2 text-caption text-[#7a5a14]"
        data-testid="storage-nearly-full"
      >
        Memori HP untuk browser ini hampir penuh. Surat dan foto baru bisa gagal disimpan, jadi
        hapus surat atau kenangan yang tidak dipakai, atau kosongkan sedikit memori HP.
      </p>

      <div
        v-if="ready && folders.length"
        class="mt-10 grid justify-items-center gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
      >
        <section
          v-for="(folder, position) in folders"
          :key="folder.id"
          :ref="(el) => setSection(folder.id, el)"
          class="flex w-full scroll-mt-4 flex-col items-center"
          :aria-label="folder.title"
          data-testid="saved-folder"
        >
          <GlassFolder
            :ref="(el) => setFolderRef(folder.id, el)"
            :open="openFolder === folder.id"
            :label="folder.title"
            :art="folder.art"
            :seed="folderSeed(folder.id.replace(/^kotak-/, ''))"
            :files="folderFiles.get(folder.id)"
            :width="folderWidth"
            :appear="!restored && settled !== folder.id"
            :appear-delay="Math.min(position, 2) * 120"
            @update:open="(value: boolean) => toggleFolder(folder.id, value)"
            @select="(item: FolderFile, index: number) => read(folder.id, index, item.id)"
          />
          <Transition name="reveal">
            <div
              v-if="openFolder === folder.id"
              class="reveal w-full max-w-[340px]"
              data-testid="folder-actions"
            >
              <div>
                <div class="flex flex-col gap-3 pt-5">
                  <ol
                    v-if="folder.items.length > 4"
                    class="divide-y divide-line-soft rounded-[16px] bg-surface shadow-raised"
                  >
                    <li v-for="(item, index) in folder.items" :key="item.id">
                      <button
                        type="button"
                        class="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-panel"
                        @click="read(folder.id, index, item.id)"
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
                      class="inline-flex h-11 items-center rounded-control bg-ink px-4 text-body font-semibold text-white hover:bg-ink/90"
                      data-testid="folder-read"
                      @click="read(folder.id, 0, folder.items[0]?.id)"
                    >
                      Baca dari awal
                    </button>
                    <NuxtLink
                      v-if="cdOf(folder.album)"
                      :to="`/tv?album=${folder.album}`"
                      class="inline-flex h-11 items-center gap-2 rounded-control px-4 text-body font-semibold inset-ring inset-ring-line hover:bg-panel"
                      data-testid="folder-tv"
                    >
                      <Icon name="play" :size="14" /> Putar fotonya di TV
                    </NuxtLink>
                  </div>
                  <button
                    type="button"
                    class="inline-flex min-h-11 items-center self-start text-caption text-ink-muted underline underline-offset-2 hover:text-ink"
                    @click="removeFolder(folder.id, folder.title)"
                  >
                    Hapus folder ini dari HP
                  </button>
                </div>
              </div>
            </div>
          </Transition>
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
      <section
        v-if="kotakBareng && ready"
        class="mt-14 max-w-xl border-t border-line-soft pt-8"
        aria-labelledby="bareng-title"
        data-testid="kotak-bareng"
      >
        <h2 id="bareng-title" class="text-[24px] font-bold tracking-[-0.03em]">Kotak bareng</h2>
        <p
          v-if="deleted"
          role="status"
          class="mt-2 rounded-control bg-fill px-3 py-2 text-caption"
          data-testid="box-deleted"
        >
          {{ deleted }}
        </p>
        <p class="mt-1 text-pretty text-ink-muted">
          Kumpulkan surat dan foto Booth dari teman-teman untuk satu orang, misalnya untuk ulang
          tahunnya. Dia membuka semuanya dari satu link.
        </p>
        <NuxtLink
          to="/kotak/baru"
          class="mt-4 inline-flex h-11 items-center gap-2 rounded-control bg-ink px-5 text-body font-semibold text-white hover:bg-ink/90"
          data-testid="kotak-baru"
        >
          <Icon name="plus" :size="15" /> Bikin kotak bareng
        </NuxtLink>
        <ul
          v-if="myBoxes.length"
          class="mt-5 divide-y divide-line-soft rounded-[16px] bg-surface shadow-raised"
          aria-label="Kotak bareng buatanmu"
        >
          <li v-for="item in myBoxes" :key="item.id">
            <NuxtLink
              :to="`/kotak/${item.id}`"
              class="flex items-center gap-3 px-4 py-3 hover:bg-panel"
              data-testid="my-box"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-body font-semibold">{{ item.title }}</span>
                <span class="block text-caption text-ink-muted">
                  Untuk {{ item.to }}, dibuat {{ formatDay(item.createdAt) }}
                </span>
              </span>
              <Icon name="chevron-right" :size="16" class="shrink-0 text-ink-subtle" />
            </NuxtLink>
          </li>
        </ul>
      </section>
    </main>

    <LetterViewer
      v-model:open="viewer.open"
      v-model:index="viewer.index"
      :letters="viewerLetters"
      :title="viewerFolder?.title ?? 'Surat'"
      :origin="viewer.origin"
      :fallback-focus="() => heading"
    >
      <template #actions="{ letter }">
        <IconButton
          label="Hapus surat ini dari HP"
          variant="ghost"
          size="lg"
          data-testid="viewer-remove"
          @click="removeLetter(letter)"
        >
          <Icon name="trash" :size="17" />
        </IconButton>
      </template>
    </LetterViewer>
  </div>
</template>
