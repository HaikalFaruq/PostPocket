<script setup lang="ts">
import { byId, letter as letterPresets } from '@postpocket/presets'
import { PHOTO_FRONT, cardRatio } from '~/utils/letter-draft'
import { LetterApiError } from '~/utils/letter-api'
import { shownFromApi } from '~/utils/letter-view'
import { sentHere } from '~/utils/sent-letters'

/**
 * Halaman penerima surat (PRD: Kirim dan buka). Di-SSR supaya meta OG terbaca crawler WhatsApp
 * yang tidak menjalankan JavaScript, dengan noindex karena isinya pribadi. Membaca surat tidak
 * menandainya dibuka; yang menandai hanya ketukan pertama di kartu.
 */
const route = useRoute()
// Link yang tersalin bersama tanda baca di belakangnya (misalnya titik di akhir kalimat chat)
// diarahkan ke link suratnya, bukan dibilang suratnya sudah tidak ada.
const rawSlug = String(route.params.slug)
const slug = rawSlug.replace(/[^A-Za-z0-9]+$/, '')
if (slug && slug !== rawSlug) await navigateTo(`/l/${slug}`, { redirectCode: 301, replace: true })
const api = useLetterApi()

const { data: letter, error } = await useAsyncData(`surat-${slug}`, () =>
  api.get(slug).catch((problem) => {
    if (problem instanceof LetterApiError && problem.code === 'not_found') return null
    throw problem
  }),
)
const missing = computed(() => !error.value && !letter.value)
const shown = computed(() => (letter.value ? shownFromApi(letter.value) : null))
if (import.meta.server && (missing.value || error.value)) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, missing.value ? 404 : 503)
}

const site = useRequestURL().origin
const description = 'Ketuk kartunya untuk membuka surat foil ini.'
useSeoMeta({
  title: () =>
    letter.value ? 'Ada surat untukmu · PostPocket' : 'Surat tidak tersedia · PostPocket',
  description,
  ogTitle: 'Ada surat untukmu',
  ogDescription: description,
  // Gambar OG bawaan dipakai kalau OG surat sudah dihapus bersama cover dari foto user.
  ogImage: () => letter.value?.og?.url ?? `${site}/og-surat.jpg`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/jpeg',
  ogImageAlt: 'Sampul surat foil',
  twitterCard: 'summary_large_image',
  robots: 'noindex, nofollow',
})

// Gambar depan kartu adalah elemen terbesar (LCP) halaman ini, tapi kartunya baru dirender di
// browser. Gambarnya di-preload dari HTML supaya unduhannya mulai bersamaan dengan halaman.
const frontImages = computed(() => {
  const design = letter.value?.design
  if (!design) return []
  if (design.illustration === PHOTO_FRONT)
    return letter.value?.cover ? [letter.value.cover.url] : []
  const art = byId(letterPresets.illustrations, design.illustration)
  return art ? [art.art, art.foil].filter((href): href is string => !!href) : []
})
// Pengganti kartu selama JavaScript dimuat: ukuran dan warna kertasnya sama dengan kartu nanti,
// jadi pergantiannya tidak terlihat seperti kedipan.
const placeholderStyle = computed(() => {
  const design = letter.value?.design
  const ratio = design ? cardRatio(design, letter.value?.cover ?? null) : 0.72
  const paper = design ? byId(letterPresets.papers, design.paper) : undefined
  return {
    aspectRatio: String(ratio),
    width: `min(78cqw, ${(72 * ratio).toFixed(2)}cqh)`,
    backgroundColor: paper?.color ?? 'var(--color-surface)',
  }
})

useHead({
  link: () =>
    frontImages.value.map((href, index) => ({
      rel: 'preload',
      as: 'image',
      href,
      // Sama dengan <img> kartu dan pemuat kanvas, supaya preload-nya terpakai.
      crossorigin: 'anonymous',
      fetchpriority: index === 0 ? 'high' : 'auto',
    })),
})

const open = ref(false)
const reading = ref(false)
// Pengirim yang melihat suratnya sendiri (pratinjau) tidak menandainya dibuka, supaya hitungan
// 7 hari foto baru mulai saat penerima membukanya.
const ownLetter = ref(false)
onMounted(async () => {
  ownLetter.value = await sentHere(slug)
})
// Ajakan mengetuk baru tampil saat kartunya benar-benar bisa diketuk, bukan selama JavaScript
// masih dimuat (di 4G lambat bisa beberapa detik).
const interactive = ref(false)
onMounted(() => {
  interactive.value = true
})
let marked = false
watch(open, async (isOpen) => {
  if (!isOpen || marked || !letter.value) return
  marked = true
  if (ownLetter.value || (await sentHere(slug))) return
  try {
    const opened = await api.open(slug)
    letter.value = { ...letter.value, ...opened }
  } catch {
    // Gagal mencatat waktu dibuka tidak menghalangi membaca.
  }
})

// Keterangan jadwal hapus foto hanya relevan kalau suratnya memang memuat foto.
const hasPhotos = computed(
  () =>
    !!letter.value &&
    (letter.value.content.elements.some((element) => element.kind === 'photo') ||
      letter.value.design.illustration === 'upload'),
)

// Tanggal ditulis dalam WIB, sama di server dan browser.
const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        timeZone: 'Asia/Jakarta',
      })
    : ''
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6" data-testid="received-page">
    <header class="flex items-center gap-2 py-4">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-2 text-[15px] font-bold tracking-[-0.02em]"
      >
        <img src="/favicon.svg" alt="" class="size-6" /> PostPocket
      </NuxtLink>
    </header>

    <main v-if="letter" class="flex flex-1 flex-col items-center">
      <h1 class="sr-only">{{ ownLetter ? 'Pratinjau suratmu' : 'Surat untukmu' }}</h1>
      <!-- Suratnya datang dalam amplop par avion, sama dengan gambar pratinjau di chat. -->
      <div class="airmail w-full">
        <div class="relative h-[min(60dvh,540px)] w-full rounded-[3px] bg-canvas">
          <ClientOnly>
            <ReceivedLetter
              v-if="shown"
              v-model:open="open"
              v-model:reading="reading"
              :letter="shown"
            />
            <template #fallback>
              <div class="grid size-full place-items-center [container-type:size]">
                <div class="rounded-[3px] shadow-raised" :style="placeholderStyle" />
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>
      <!-- Sebelum dibuka, satu-satunya langkah adalah mengetuk kartu; balasan baru muncul sesudahnya. -->
      <p
        v-if="!open"
        class="mt-3 text-body font-semibold text-ink"
        :class="{ invisible: !interactive }"
        data-testid="open-hint"
      >
        Ketuk kartunya untuk membuka suratmu
      </p>
      <template v-else>
        <p class="mt-2 text-caption text-ink-muted">Geser untuk memutar, ketuk untuk menutup</p>
        <!-- Di dalam kartu, halaman surat hanya separuh lebar kartu; di HP tulisannya jadi kecil. -->
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            class="inline-flex h-11 items-center gap-2 rounded-control bg-surface px-5 text-body font-semibold inset-ring inset-ring-line hover:bg-panel"
            @click="reading = true"
          >
            Baca lebih besar
          </button>
          <NuxtLink
            v-if="!ownLetter"
            :to="`/letter/new?balas=${letter.slug}`"
            class="inline-flex h-11 items-center gap-2 rounded-control bg-ink px-5 text-body font-semibold text-white hover:bg-ink/90"
            data-testid="reply"
          >
            Bikin balasan
          </NuxtLink>
        </div>
        <!-- Surat dari link tidak disimpan selamanya, jadi penerima bisa menyimpannya di HP. -->
        <ClientOnly>
          <KeepLetter v-if="!ownLetter" :letter="letter" />
        </ClientOnly>
      </template>

      <p class="mt-6 max-w-sm text-center text-caption text-ink-muted">
        Surat ini bisa dibuka sampai {{ formatDate(letter.expiresAt) }}.
        <template v-if="hasPhotos && letter.photosDeletedAt"
          >Foto di dalamnya sudah dihapus.</template
        >
        <template v-else-if="hasPhotos && letter.photosExpireAt">
          Foto di dalamnya dihapus {{ formatDate(letter.photosExpireAt) }}.
        </template>
      </p>
      <p
        v-if="ownLetter"
        class="mt-3 max-w-sm rounded-control bg-fill px-3 py-2 text-center text-caption"
        data-testid="own-letter-note"
      >
        Ini pratinjau suratmu. Penerima melihat halaman yang sama<template v-if="hasPhotos"
          >, dan membukanya di sini tidak memulai hitungan 7 hari fotonya</template
        >.
      </p>
    </main>

    <main
      v-else
      class="flex flex-1 flex-col items-center justify-center pb-16 text-center"
      data-testid="letter-missing"
    >
      <h1 class="text-title">
        {{ missing ? 'Surat ini sudah tidak tersedia' : 'Surat belum bisa dimuat' }}
      </h1>
      <p class="mt-2 max-w-sm text-pretty text-ink-muted">
        <template v-if="missing">
          Mungkin sudah lewat 30 hari, pengirimnya menghapusnya, atau
          <span class="whitespace-nowrap">link-nya</span> terpotong saat disalin.
        </template>
        <template v-else>Coba muat ulang halaman ini sebentar lagi.</template>
      </p>
      <NuxtLink
        to="/letter/new"
        class="mt-6 inline-flex h-11 items-center rounded-control bg-ink px-6 text-body font-semibold text-white"
      >
        Bikin surat sendiri
      </NuxtLink>
    </main>

    <footer class="py-6 text-center text-caption text-ink-muted">
      Ada yang tidak beres dengan surat ini?
      <FeedbackLink class="font-semibold text-ink underline underline-offset-2" />
    </footer>
  </div>
</template>
