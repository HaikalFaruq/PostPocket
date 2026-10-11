<script setup lang="ts">
import { byId, letter as letterPresets } from '@postpocket/presets'
import { LetterApiError } from '~/utils/letter-api'
import { PHOTO_FRONT } from '~/utils/letter-draft'

/**
 * Halaman penerima surat (PRD: Kirim dan buka). Di-SSR supaya meta OG terbaca crawler WhatsApp
 * yang tidak menjalankan JavaScript, dengan noindex karena isinya pribadi. Membaca surat tidak
 * menandainya dibuka; yang menandai hanya ketukan pertama di kartu.
 */
const route = useRoute()
const slug = String(route.params.slug)
const api = useLetterApi()

const { data: letter, error } = await useAsyncData(`surat-${slug}`, () =>
  api.get(slug).catch((problem) => {
    if (problem instanceof LetterApiError && problem.code === 'not_found') return null
    throw problem
  }),
)
const missing = computed(() => !error.value && !letter.value)
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
useHead({
  link: () =>
    frontImages.value.map((href, index) => ({
      rel: 'preload',
      as: 'image',
      href,
      fetchpriority: index === 0 ? 'high' : 'auto',
    })),
})

const open = ref(false)
let marked = false
watch(open, async (isOpen) => {
  if (!isOpen || marked || !letter.value) return
  marked = true
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
      <div class="relative h-[min(64dvh,560px)] w-full">
        <ClientOnly>
          <ReceivedLetter v-model:open="open" :letter="letter" />
          <template #fallback>
            <div class="grid size-full place-items-center">
              <div class="aspect-[0.72] h-[72%] rounded-[3px] bg-surface shadow-raised" />
            </div>
          </template>
        </ClientOnly>
      </div>
      <p class="mt-2 text-caption text-ink-subtle">
        {{ open ? 'Geser untuk memutar, ketuk untuk menutup' : 'Ketuk kartu untuk membuka' }}
      </p>

      <NuxtLink
        :to="`/letter/new?balas=${letter.slug}`"
        class="mt-6 inline-flex h-11 items-center gap-2 rounded-control bg-ink px-6 text-body font-semibold text-white hover:bg-ink/90"
        data-testid="reply"
      >
        Bikin balasan <Icon name="arrow-right" :size="15" />
      </NuxtLink>

      <p class="mt-6 max-w-sm text-center text-caption text-ink-muted">
        Surat ini bisa dibuka sampai {{ formatDate(letter.expiresAt) }}.
        <template v-if="hasPhotos && letter.photosDeletedAt"
          >Foto di dalamnya sudah dihapus.</template
        >
        <template v-else-if="hasPhotos && letter.photosExpireAt">
          Foto di dalamnya dihapus {{ formatDate(letter.photosExpireAt) }}.
        </template>
      </p>
    </main>

    <main
      v-else
      class="flex flex-1 flex-col items-center justify-center pb-16 text-center"
      data-testid="letter-missing"
    >
      <h1 class="text-title font-semibold">
        {{ missing ? 'Surat ini sudah tidak tersedia' : 'Surat belum bisa dimuat' }}
      </h1>
      <p class="mt-2 max-w-sm text-ink-muted">
        {{
          missing
            ? 'Mungkin sudah lewat 30 hari, atau pengirimnya menghapusnya.'
            : 'Coba muat ulang halaman ini sebentar lagi.'
        }}
      </p>
      <NuxtLink
        to="/letter/new"
        class="mt-6 inline-flex h-11 items-center rounded-control bg-ink px-6 text-body font-semibold text-white"
      >
        Bikin surat sendiri
      </NuxtLink>
    </main>
  </div>
</template>
