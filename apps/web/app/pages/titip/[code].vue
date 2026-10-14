<script setup lang="ts">
import {
  WIB,
  deviceTimeZone,
  formatDay as formatDayIn,
  formatWhen as formatWhenIn,
} from '~/utils/box-time'
import { folderSeed } from '~/utils/folder-art'
import { missingBox } from '~/utils/box-api'
import { LetterApiError, errorMessage } from '~/utils/letter-api'
import { forgetSent, sentToBox, type SentRecord } from '~/utils/sent-letters'

/**
 * Halaman titip kotak bareng (kontrak 0.3.0): teman-teman membuka link titip, menulis surat di
 * editor biasa, lalu suratnya masuk kotak, bukan jadi link sendiri. Di-SSR supaya preview
 * WhatsApp terbaca. Isi kotak tidak pernah tampil di sini: hanya judul, penerima, jadwal, dan
 * jumlah titipan.
 */
if (!useRuntimeConfig().public.kotakBareng) {
  throw createError({ statusCode: 404, statusMessage: 'Kotak bareng belum tersedia', fatal: true })
}

const route = useRoute()
const rawCode = String(route.params.code)
const code = rawCode.replace(/[^A-Za-z0-9]+$/, '')
if (code && code !== rawCode) {
  await navigateTo(`/titip/${code}`, { redirectCode: 301, replace: true })
}
const api = useBoxApi()
const letterApi = useLetterApi()

const load = () =>
  api.invite(code).catch((problem) => {
    if (problem instanceof LetterApiError && missingBox(problem)) return null
    throw problem
  })
const { data, error } = await useAsyncData(`titip-${code}`, load)
// Salinan yang dimuat ulang setelah surat ditarik, tanpa hilang saat koneksi sedang putus.
const invite = ref(data.value)
const missing = computed(() => !error.value && !invite.value)
if (import.meta.server && (missing.value || error.value)) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, missing.value ? 404 : 503)
}
async function reload() {
  try {
    invite.value = await load()
  } catch {
    // Data yang tampil tetap dipakai.
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
    invite.value
      ? `Titip surat untuk ${invite.value.to} · PostPocket`
      : 'Kotak tidak tersedia · PostPocket',
  description: 'Tulis kartu foil untuk kotak bareng ini. Isinya rahasia sampai kotaknya dibuka.',
  ogTitle: () => (invite.value ? `Titip surat untuk ${invite.value.to}` : 'Kotak bareng'),
  ogDescription: () =>
    invite.value
      ? `Kotak "${invite.value.title}". Tulis kartu foil, isinya rahasia sampai kotaknya dibuka.`
      : 'Kotak ini sudah tidak tersedia.',
  ogImage: `${site}/og-titip.jpg`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/jpeg',
  ogImageAlt: 'Folder kaca untuk menitip surat',
  twitterCard: 'summary_large_image',
  robots: 'noindex, nofollow',
})

const { width: windowWidth } = useWindowSize()
const folderWidth = computed(() => Math.max(240, Math.min(340, windowWidth.value - 32)))

const room = computed(() =>
  invite.value
    ? {
        letters: Math.max(0, invite.value.limits.letters - invite.value.usage.letters),
        photos: Math.max(0, invite.value.limits.photos - invite.value.usage.photos),
      }
    : { letters: 0, photos: 0 },
)
const full = computed(() => room.value.letters === 0)
const files = computed(() =>
  Array.from({ length: Math.min(invite.value?.usage.letters ?? 0, 4) }, (_, index) => ({
    id: `titipan-${index}`,
    name: '',
  })),
)

// Surat yang dititip dari browser ini ke kotak ini: bisa ditarik lagi selama kotaknya ada.
const mine = ref<SentRecord[]>([])
const busy = ref<string | null>(null)
const message = ref('')
onMounted(async () => {
  mine.value = await sentToBox(code)
})

/** Lupakan surat yang ditarik, juga tanda "sudah masuk kotak" di draf editor kalau itu draf sama. */
async function forgotten(item: SentRecord) {
  await forgetSent(item.id)
  mine.value = mine.value.filter((other) => other.id !== item.id)
  const draft = useLetterDraft()
  await draft.load()
  if (draft.sent?.id === item.id) await draft.clearSent()
}

async function withdraw(item: SentRecord) {
  if (!invite.value) return
  if (!window.confirm(`Tarik surat ini dari kotak "${invite.value.title}"?`)) return
  busy.value = item.id
  message.value = ''
  try {
    await letterApi.remove(item.id, item.editToken)
    await forgotten(item)
    await reload()
  } catch (problem) {
    // Sudah dihapus pembuat kotak, atau kotaknya sudah dihapus: cukup dibuang dari daftar.
    if (problem instanceof LetterApiError && problem.code === 'not_found') await forgotten(item)
    else message.value = errorMessage(problem)
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6" data-testid="titip-page">
    <header class="flex items-center gap-2 py-4">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-2 text-[15px] font-bold tracking-[-0.02em]"
      >
        <img src="/favicon.svg" alt="" class="size-6" /> PostPocket
      </NuxtLink>
    </header>

    <main v-if="invite" class="flex flex-1 flex-col items-center pb-10 text-center">
      <p class="text-body text-ink-muted">Kotak bareng untuk {{ invite.to }}</p>
      <h1 class="mt-1 text-[30px] leading-tight font-bold tracking-[-0.03em] text-balance">
        Titip surat untuk {{ invite.to }}
      </h1>

      <div class="mt-6 w-full max-w-[340px]">
        <ClientOnly>
          <GlassFolder
            :label="invite.title"
            :meta="`${invite.usage.letters} surat`"
            :art="invite.design"
            :seed="folderSeed(code)"
            :files="files"
            :width="folderWidth"
            sealed
            :sealed-text="
              invite.closed
                ? 'Sudah ditutup'
                : invite.scheduled
                  ? `Ditutup ${formatDay(invite.opensAt)}`
                  : undefined
            "
          />
          <template #fallback>
            <div class="aspect-[340/326] w-full" />
          </template>
        </ClientOnly>
      </div>

      <template v-if="invite.closed">
        <p class="mt-6 text-title" data-testid="titip-closed">Kotak ini sudah ditutup</p>
        <p class="mt-2 max-w-sm text-pretty text-ink-muted">
          {{ invite.to }} sudah bisa membukanya, jadi titipan baru tidak diterima lagi. Kamu tetap
          bisa mengirim surat sendiri lewat link.
        </p>
        <NuxtLink
          to="/letter/new"
          class="mt-5 inline-flex h-11 items-center rounded-control bg-ink px-6 text-body font-semibold text-white hover:bg-ink/90"
        >
          Tulis surat sendiri
        </NuxtLink>
      </template>

      <template v-else>
        <p class="mt-6 max-w-sm text-pretty text-ink-muted" data-testid="titip-schedule">
          <template v-if="invite.scheduled">
            Titip sebelum {{ formatWhen(invite.opensAt) }}. Saat itu kotaknya terbuka untuk
            {{ invite.to }}.
          </template>
          <template v-else>
            Pembuat kotaknya yang menentukan kapan kotak ini dibuka untuk {{ invite.to }}, paling
            lambat {{ formatWhen(invite.opensAt) }}.
          </template>
          Isinya rahasia: kamu tidak bisa membaca surat teman lain.
        </p>
        <p class="mt-2 text-caption text-ink-muted" data-testid="titip-room">
          <template v-if="full">Kotak ini sudah penuh.</template>
          <template v-else>
            {{
              invite.usage.letters
                ? `${invite.usage.letters} surat sudah masuk.`
                : 'Belum ada surat yang masuk.'
            }}
            Masih muat {{ room.letters }} surat dan {{ room.photos }} foto.
          </template>
        </p>
        <NuxtLink
          v-if="!full"
          :to="`/letter/new?titip=${code}`"
          class="mt-5 inline-flex h-12 items-center rounded-control bg-ink px-7 text-[15px] font-semibold text-white hover:bg-ink/90"
          data-testid="titip-write"
        >
          Tulis surat
        </NuxtLink>
        <p class="mt-3 max-w-sm text-caption text-ink-muted">
          Mau pakai strip foto Booth? Mulai tulis suratnya, lalu pilih Ambil foto di Booth.
        </p>
      </template>

      <section
        v-if="mine.length"
        class="mt-8 w-full max-w-md text-left"
        aria-labelledby="titip-mine"
        data-testid="titip-mine"
      >
        <h2 id="titip-mine" class="text-body font-semibold">Suratmu di kotak ini</h2>
        <ul class="mt-2 divide-y divide-line-soft rounded-[16px] bg-surface shadow-raised">
          <li v-for="item in mine" :key="item.id" class="flex items-center gap-3 px-4 py-2.5">
            <span class="min-w-0 flex-1 truncate font-letter text-[18px] leading-snug">
              {{ item.preview || 'Surat tanpa teks' }}
            </span>
            <button
              type="button"
              class="shrink-0 text-caption font-semibold text-ink-muted underline underline-offset-2 hover:text-ink disabled:opacity-50"
              :disabled="busy === item.id"
              @click="withdraw(item)"
            >
              Tarik
            </button>
          </li>
        </ul>
        <p v-if="message" role="status" class="mt-2 text-caption text-ink-muted">{{ message }}</p>
      </section>
    </main>

    <main
      v-else
      class="flex flex-1 flex-col items-center justify-center pb-16 text-center"
      data-testid="titip-missing"
    >
      <h1 class="text-title">
        {{ missing ? 'Kotak ini sudah tidak tersedia' : 'Kotak belum bisa dimuat' }}
      </h1>
      <p class="mt-2 max-w-sm text-pretty text-ink-muted">
        <template v-if="missing">
          Mungkin pembuatnya sudah menghapusnya, atau
          <span class="whitespace-nowrap">link-nya</span> terpotong saat disalin.
        </template>
        <template v-else>Coba muat ulang halaman ini sebentar lagi.</template>
      </p>
      <NuxtLink
        to="/letter/new"
        class="mt-6 inline-flex h-11 items-center rounded-control bg-ink px-6 text-body font-semibold text-white"
      >
        Tulis surat sendiri
      </NuxtLink>
    </main>

    <footer class="py-6 text-center text-caption text-ink-muted">
      Ada yang tidak beres dengan kotak ini?
      <FeedbackLink class="font-semibold text-ink underline underline-offset-2" />
    </footer>
  </div>
</template>
