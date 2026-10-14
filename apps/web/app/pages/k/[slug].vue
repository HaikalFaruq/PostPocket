<script setup lang="ts">
import { byId, letter as letterPresets } from '@postpocket/presets'
import type { FolderFile } from '~/components/kotak/GlassFolder.vue'
import { readLetters, markRead } from '~/utils/box-read'
import { folderSeed } from '~/utils/folder-art'
import {
  WIB,
  countdown,
  deviceTimeZone,
  formatDay as formatDayIn,
  formatWhen as formatWhenIn,
} from '~/utils/box-time'
import { missingBox } from '~/utils/box-api'
import { LetterApiError } from '~/utils/letter-api'
import { letterFront, shownFromBox } from '~/utils/letter-view'
import { boxHere } from '~/utils/my-boxes'

/**
 * Kotak bareng untuk penerimanya (kontrak 0.3.0). Di-SSR supaya meta OG terbaca crawler
 * WhatsApp, dengan noindex. Sebelum `opensAt` kotaknya tersegel dan hanya jumlah suratnya yang
 * terlihat. Setelah itu folder kaca bisa dibuka, dan suratnya dibaca satu per satu. Membuka surat
 * pertama menandai kotak dibuka (hitungan 7 hari foto mulai), kecuali di browser pembuatnya.
 */
if (!useRuntimeConfig().public.kotakBareng) {
  throw createError({ statusCode: 404, statusMessage: 'Kotak bareng belum tersedia', fatal: true })
}

const route = useRoute()
// Link yang tersalin bersama tanda baca di belakangnya diarahkan ke link kotaknya.
const rawSlug = String(route.params.slug)
const slug = rawSlug.replace(/[^A-Za-z0-9]+$/, '')
if (slug && slug !== rawSlug) await navigateTo(`/k/${slug}`, { redirectCode: 301, replace: true })
const api = useBoxApi()

const load = () =>
  api.forRecipient(slug).catch((problem) => {
    if (problem instanceof LetterApiError && missingBox(problem)) return null
    throw problem
  })
const { data, error } = await useAsyncData(`kotak-${slug}`, load)
// Salinan yang dimuat ulang sendiri tanpa kehilangan isi saat koneksi sedang putus.
const box = ref(data.value)
const failed = ref(!!error.value)
const missing = computed(() => !failed.value && !box.value)
if (import.meta.server && (missing.value || failed.value)) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, missing.value ? 404 : 503)
}

/** Muat ulang. Gangguan sesaat tidak menghapus kotak yang sudah tampil. */
async function reload() {
  try {
    box.value = await load()
    failed.value = false
  } catch {
    // Coba lagi di putaran berikutnya.
  }
}

// Waktu ditulis dalam WIB saat di-SSR, lalu dalam zona waktu HP begitu halaman dimuat.
const zone = ref(WIB)
onMounted(() => (zone.value = deviceTimeZone()))
const formatWhen = (value: string) => formatWhenIn(value, zone.value)
const formatDay = (value: string) => formatDayIn(value, zone.value)

const site = useRequestURL().origin
useSeoMeta({
  title: () =>
    box.value
      ? `Kotak surat untuk ${box.value.to} · PostPocket`
      : 'Kotak tidak tersedia · PostPocket',
  description: 'Teman-temanmu menitipkan surat foil di kotak ini.',
  ogTitle: () => (box.value ? `Kotak surat untuk ${box.value.to}` : 'Kotak surat'),
  ogDescription: () =>
    box.value
      ? `${box.value.letterCount} surat dari teman-temanmu. Ketuk untuk membuka.`
      : 'Kotak ini sudah tidak tersedia.',
  ogImage: `${site}/og-kotak.jpg`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/jpeg',
  ogImageAlt: 'Folder kaca berisi surat',
  twitterCard: 'summary_large_image',
  robots: 'noindex, nofollow',
})

// Lebar folder mengikuti layar dengan jarak 16 px di kiri dan kanan, paling lebar 340 px.
const { width: windowWidth } = useWindowSize()
const folderWidth = computed(() => Math.max(240, Math.min(340, windowWidth.value - 32)))

// Pembuat kotak yang melihat kotaknya sendiri tidak menandai kotak dibuka.
const own = ref(false)
const read = ref(new Set<string>())
const interactive = ref(false)
onMounted(async () => {
  interactive.value = true
  read.value = readLetters(slug)
  own.value = !!(await boxHere(slug))
})

const photosGone = computed(() => !!box.value?.photosDeletedAt)
const letters = computed(() => box.value?.letters ?? [])
const shown = computed(() => letters.value.map((item) => shownFromBox(item, photosGone.value)))
const files = computed<FolderFile[]>(() =>
  box.value?.openable
    ? letters.value.map((item) => ({
        id: item.id,
        name: `Dari ${item.from}`,
        meta: formatDay(item.publishedAt),
        image: letterFront(item.design, item.cover?.url),
        paper: byId(letterPresets.papers, item.design.paper)?.color,
        unread: interactive.value && !read.value.has(item.id),
      }))
    : // Sebelum dibuka, lembarnya polos: isinya masih rahasia.
      Array.from({ length: Math.min(box.value?.letterCount ?? 0, 4) }, (_, index) => ({
        id: `tersegel-${index}`,
        name: '',
      })),
)
const unreadCount = computed(() => letters.value.filter((item) => !read.value.has(item.id)).length)

const folderOpen = ref(false)
const folder = ref<{ sheetRect: (id: string) => DOMRect | null } | null>(null)
const viewer = reactive({ open: false, index: 0, origin: null as DOMRect | null })

function openLetterAt(index: number, fileId?: string) {
  viewer.index = index
  viewer.origin = fileId ? (folder.value?.sheetRect(fileId) ?? null) : null
  viewer.open = true
}

/** Lanjut dari surat pertama yang belum dibaca. */
function continueReading() {
  const next = letters.value.findIndex((item) => !read.value.has(item.id))
  openLetterAt(Math.max(0, next))
}

let marked = false
async function onOpened(id: string) {
  read.value = markRead(slug, id)
  if (marked || own.value || !box.value || box.value.openedAt) return
  marked = true
  try {
    const opened = await api.open(slug)
    box.value = { ...box.value, ...opened }
  } catch {
    // Gagal mencatat waktu dibuka tidak menghalangi membaca.
  }
}

// Kotak yang masih disegel (atau belum bisa dimuat) dimuat ulang sendiri sekali semenit, dan
// segera begitu jadwalnya lewat. Sekali semenit juga untuk kotak terjadwal, karena pembuatnya bisa
// menekan Buka sekarang atau memajukan jadwalnya, dan jam HP bisa saja meleset. Hanya selama
// halamannya terlihat, supaya tidak memanggil server di tab yang ditinggal.
const now = ref(Date.now())
let lastCheck = Date.now()
let ticker: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now()
    if (document.visibilityState !== 'visible') return
    const waiting = failed.value || (box.value && !box.value.openable)
    if (!waiting) return
    const due =
      now.value - lastCheck >= 60_000 ||
      (!!box.value?.scheduled && now.value >= Date.parse(box.value.opensAt))
    if (!due) return
    lastCheck = now.value
    void reload()
  }, 15_000)
})
onBeforeUnmount(() => clearInterval(ticker))
const untilOpen = computed(() =>
  box.value && !box.value.openable ? Date.parse(box.value.opensAt) - now.value : 0,
)
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6" data-testid="box-page">
    <header class="flex items-center gap-2 py-4">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-2 text-[15px] font-bold tracking-[-0.02em]"
      >
        <img src="/favicon.svg" alt="" class="size-6" /> PostPocket
      </NuxtLink>
    </header>

    <main v-if="box" class="flex flex-1 flex-col items-center pb-10 text-center">
      <p class="text-body text-ink-muted">Kotak surat untuk {{ box.to }}</p>
      <h1 class="mt-1 text-[30px] leading-tight font-bold tracking-[-0.03em] text-balance">
        {{ box.title }}
      </h1>

      <!-- Folder kaca baru dirender di browser: seninya dilukis di kanvas dan lebarnya mengikuti
           layar. Penggantinya berukuran sama, jadi halaman tidak bergeser. -->
      <div class="mt-6 w-full max-w-[340px]">
        <ClientOnly>
          <GlassFolder
            ref="folder"
            v-model:open="folderOpen"
            :label="box.title"
            :meta="box.openable ? `${box.letterCount} surat` : `untuk ${box.to}`"
            :art="box.design"
            :seed="folderSeed(box.slug)"
            :files="files"
            :width="folderWidth"
            :sealed="!box.openable"
            :sealed-text="box.scheduled ? `Dibuka ${formatDay(box.opensAt)}` : 'Disegel'"
            @select="(file: FolderFile, index: number) => openLetterAt(index, file.id)"
          />
          <template #fallback>
            <div class="aspect-[340/326] w-full" />
          </template>
        </ClientOnly>
      </div>

      <template v-if="!box.openable">
        <p class="mt-6 text-title" data-testid="box-sealed">Kotak ini masih disegel</p>
        <p class="mt-2 max-w-sm text-pretty text-ink-muted">
          {{ box.letterCount }} surat dari teman-temanmu sudah menunggu di dalamnya.
          <template v-if="box.scheduled">
            Bisa dibuka {{ formatWhen(box.opensAt)
            }}<template v-if="interactive && untilOpen < 86_400_000"
              >, {{ countdown(untilOpen) }} lagi</template
            >.
          </template>
          <template v-else>
            Pembuat kotaknya yang menentukan kapan dibuka, paling lambat
            {{ formatWhen(box.opensAt) }}.
          </template>
        </p>
        <p class="mt-2 max-w-sm text-caption text-ink-muted">
          Simpan link ini, lalu buka lagi nanti. Selama halaman ini terbuka, kotaknya terbuka
          sendiri begitu bisa dibuka.
        </p>
      </template>

      <template v-else-if="box.letterCount === 0">
        <p class="mt-6 text-title">Kotaknya masih kosong</p>
        <p class="mt-2 max-w-sm text-pretty text-ink-muted">
          Belum ada surat yang dititip di kotak ini.
        </p>
      </template>

      <template v-else>
        <p
          v-if="!folderOpen"
          class="mt-6 text-body font-semibold"
          :class="{ invisible: !interactive }"
          data-testid="box-hint"
        >
          Ketuk kotaknya untuk melihat suratnya
        </p>
        <div v-else class="mt-6 flex w-full max-w-md flex-col items-center gap-3 animate-rise-in">
          <button
            type="button"
            class="inline-flex h-11 items-center rounded-control bg-ink px-6 text-body font-semibold text-white hover:bg-ink/90"
            data-testid="box-read"
            @click="continueReading"
          >
            {{
              unreadCount === letters.length
                ? 'Mulai baca'
                : unreadCount
                  ? `Lanjut baca (${unreadCount} belum dibuka)`
                  : 'Baca lagi dari awal'
            }}
          </button>
          <ol
            class="w-full divide-y divide-line-soft rounded-[16px] bg-surface text-left shadow-raised"
            aria-label="Semua surat di kotak"
          >
            <li v-for="(item, index) in letters" :key="item.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-panel"
                @click="openLetterAt(index)"
              >
                <span
                  class="size-2.5 shrink-0 rounded-full"
                  :class="interactive && !read.has(item.id) ? 'bg-ink' : 'bg-line'"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1 truncate text-body font-semibold">
                  Dari {{ item.from }}
                </span>
                <span class="shrink-0 text-caption text-ink-muted">
                  {{
                    interactive && !read.has(item.id) ? 'Belum dibuka' : formatDay(item.publishedAt)
                  }}
                </span>
              </button>
            </li>
          </ol>
        </div>

        <ClientOnly>
          <KeepBox v-if="!own" :box="box" class="mt-6 text-left" />
        </ClientOnly>
      </template>

      <p class="mt-6 max-w-sm text-caption text-ink-muted">
        Kotak ini bisa dibuka sampai {{ formatWhen(box.expiresAt) }}.
        <template v-if="box.photosDeletedAt">Foto di dalamnya sudah dihapus.</template>
        <template v-else-if="box.photosExpireAt">
          Foto di dalamnya dihapus {{ formatWhen(box.photosExpireAt) }}.
        </template>
      </p>
      <p
        v-if="own"
        class="mt-3 max-w-sm rounded-control bg-fill px-3 py-2 text-caption"
        data-testid="own-box-note"
      >
        Ini kotak buatanmu. Penerima melihat halaman yang sama, dan membukanya di sini tidak memulai
        hitungan 7 hari fotonya.
      </p>

      <ClientOnly>
        <LetterViewer
          v-model:open="viewer.open"
          v-model:index="viewer.index"
          :letters="shown"
          :title="box.title"
          :origin="viewer.origin"
          @opened="onOpened"
        />
      </ClientOnly>
    </main>

    <main
      v-else
      class="flex flex-1 flex-col items-center justify-center pb-16 text-center"
      data-testid="box-missing"
    >
      <h1 class="text-title">
        {{ missing ? 'Kotak ini sudah tidak tersedia' : 'Kotak belum bisa dimuat' }}
      </h1>
      <p class="mt-2 max-w-sm text-pretty text-ink-muted">
        <template v-if="missing">
          Mungkin sudah lewat 30 hari sejak dibuka, pembuatnya menghapusnya, atau
          <span class="whitespace-nowrap">link-nya</span> terpotong saat disalin.
        </template>
        <template v-else>Coba muat ulang halaman ini sebentar lagi.</template>
      </p>
      <NuxtLink
        to="/kotak"
        class="mt-6 inline-flex h-11 items-center rounded-control bg-ink px-6 text-body font-semibold text-white"
      >
        Buka Kotak surat
      </NuxtLink>
    </main>

    <footer class="py-6 text-center text-caption text-ink-muted">
      Ada yang tidak beres dengan kotak ini?
      <FeedbackLink class="font-semibold text-ink underline underline-offset-2" />
    </footer>
  </div>
</template>
