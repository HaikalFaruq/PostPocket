<script setup lang="ts">
import { byId, letter } from '@postpocket/presets'
import booth from '~/utils/hairline/booth'
import pocket from '~/utils/hairline/pocket'
import surat from '~/utils/hairline/surat'

// Crawler WhatsApp hanya membaca URL gambar OG yang absolut.
const site = useRequestURL().origin
useSeoMeta({
  title: 'PostPocket',
  description: 'Tangkap momen, simpan per hari, kirim sebagai surat foil 3D.',
  ogTitle: 'PostPocket',
  ogDescription: 'Tangkap momen, simpan per hari, kirim sebagai surat foil 3D.',
  ogImage: `${site}/og-beranda.jpg`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/jpeg',
  ogImageAlt: 'PostPocket: kirim surat foil lewat satu link',
  twitterCard: 'summary_large_image',
})

const example = letter.illustrations[0]!
const foil = byId(letter.foilColors, 'gold')!
const paper = byId(letter.papers, 'cream')!
const open = ref(false)
// Versi untuk tester saat melapor masalah: commit yang sedang di-deploy.
const version = useRuntimeConfig().public.appVersion
const kotakBareng = !!useRuntimeConfig().public.kotakBareng

/**
 * Tiga modul, dari kiri ke kanan seperti perjalanan sebuah kenangan: ditulis jadi surat, disimpan
 * di kantong, dan difoto di booth. Masing-masing dibuka dengan bendanya sebagai figur garis
 * Hairline yang bergerak sendiri dan menjawab sentuhan.
 */
const modules = [
  {
    id: 'surat',
    figure: surat,
    title: 'Surat',
    text: 'Tulis kartu foil 3D, lalu kirim lewat satu link. Penerimanya tinggal mengetuk kartunya.',
    to: '/letter/new',
    action: 'Tulis surat',
    tags: ['kartu foil 3D', 'kirim lewat link'],
  },
  {
    id: 'pocket',
    figure: pocket,
    title: 'Pocket',
    text: 'Simpan satu hal kecil setiap hari di kantong berstiker, lalu buka lagi kapan saja.',
    to: '/pocket',
    action: 'Buka Pocket',
    tags: ['satu kantong', 'setiap hari'],
  },
  {
    id: 'booth',
    figure: booth,
    title: 'Photo Booth',
    text: 'Empat jepretan berfilter retro, langsung jadi strip foto untuk disimpan atau dikirim.',
    to: '/tv?booth=1',
    action: 'Foto di Booth',
    tags: ['empat jepretan', 'jadi strip foto'],
  },
] as const
</script>

<template>
  <div class="flex min-h-dvh flex-col overflow-x-clip">
    <!-- Pembungkus selebar layar: kerumunan di atas footer ikut selebar layar, tanpa membuat
         halaman bisa digeser ke samping. Isi halaman tetap dalam kolom max-w-6xl. -->
    <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
      <header class="flex items-center gap-2.5 py-5">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" class="size-7" />
          <span class="text-[19px] leading-none font-bold tracking-[-0.03em]">PostPocket</span>
        </NuxtLink>
        <span class="text-caption text-ink-muted">beta</span>
        <nav aria-label="Menu" class="ml-auto flex items-center gap-5 text-body text-ink-muted">
          <NuxtLink
            to="/letter/new"
            class="hidden min-h-11 items-center hover:text-ink sm:inline-flex"
            >Surat</NuxtLink
          >
          <NuxtLink to="/pocket" class="hidden min-h-11 items-center hover:text-ink sm:inline-flex"
            >Pocket</NuxtLink
          >
          <NuxtLink
            to="/tv?booth=1"
            class="hidden min-h-11 items-center hover:text-ink sm:inline-flex"
            >Booth</NuxtLink
          >
          <NuxtLink to="/kotak" class="inline-flex min-h-11 items-center hover:text-ink">
            Kotak surat
          </NuxtLink>
        </nav>
      </header>

      <main class="flex-1">
        <section class="flex flex-col items-center pt-2 text-center sm:pt-6">
          <!-- Pembuka: surat contoh dalam amplop par avion, yang bisa langsung dibuka. -->
          <figure class="w-full max-w-[400px]">
            <div class="airmail">
              <div class="relative h-[clamp(240px,38dvh,360px)] rounded-[3px] bg-canvas">
                <ClientOnly>
                  <FoilCard
                    v-model:open="open"
                    :art="example.art"
                    :foil-mask="example.foil"
                    :foil="foil"
                    :paper="paper"
                    :ratio="example.ratio"
                    label="Contoh surat"
                  >
                    <template #inside>
                      <p>Untukmu,</p>
                      <p>hari ini seru banget. Makasih udah nemenin!</p>
                      <p class="mt-[6cqw] text-right">PostPocket</p>
                    </template>
                  </FoilCard>
                  <template #fallback>
                    <div class="grid size-full place-items-center">
                      <div
                        class="aspect-[0.72] h-[72%] rounded-[3px]"
                        :style="{ backgroundColor: paper.color }"
                      />
                    </div>
                  </template>
                </ClientOnly>
              </div>
            </div>
            <figcaption class="mt-3 text-caption text-ink-muted">
              Contoh surat. Ketuk untuk membuka, geser untuk memutar.
            </figcaption>
          </figure>

          <h1
            class="mt-10 max-w-[14ch] text-[40px] leading-[1.02] font-bold tracking-[-0.035em] text-balance sm:text-[58px]"
          >
            Kenangan kecil, dikirim jadi
            <span class="font-letter text-[1.16em] leading-none font-normal tracking-normal"
              >surat</span
            >.
          </h1>
          <p class="mt-4 max-w-[34rem] text-[16px] leading-relaxed text-pretty text-ink-muted">
            Tulis kartu foil 3D, simpan satu momen setiap hari, dan foto bareng di booth. Semua
            dibuka lewat satu link, tanpa daftar dan tanpa aplikasi.
          </p>
        </section>

        <!-- Surat, Pocket, lalu Photo Booth: satu pita berpanel, bukan tiga kartu yang sama. -->
        <section
          class="mt-14 rounded-card bg-surface inset-ring inset-ring-line-soft"
          aria-label="Surat, Pocket, dan Photo Booth"
        >
          <ul class="grid divide-y divide-line-soft md:grid-cols-3 md:divide-x md:divide-y-0">
            <li
              v-for="item in modules"
              :key="item.id"
              class="flex flex-col items-center px-4 pt-3 pb-3 text-center"
              :data-testid="`modul-${item.id}`"
            >
              <HairlineFigure :figure="item.figure" class="w-full max-w-[380px]" />
              <h2 class="text-[21px] font-bold tracking-[-0.02em]">{{ item.title }}</h2>
              <p class="mt-1.5 max-w-[32ch] text-pretty text-ink-muted">{{ item.text }}</p>
              <TagButton :to="item.to" :label="item.action" :tags="item.tags" />
            </li>
          </ul>
        </section>

        <NuxtLink to="/kotak" class="group mx-auto mt-8 flex max-w-md items-center gap-4 py-2">
          <span class="grid w-14 shrink-0 place-items-center">
            <span class="w-12 -rotate-3 transition-transform group-hover:rotate-0">
              <FolderMini />
            </span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[17px] font-bold tracking-[-0.02em]">Kotak surat</span>
            <span class="mt-0.5 block text-ink-muted">
              {{
                kotakBareng
                  ? 'Simpan surat yang kamu terima, atau kumpulkan surat dari teman-teman untuk satu orang.'
                  : 'Surat yang kamu simpan dari link, tetap bisa dibuka walau link-nya sudah mati.'
              }}
            </span>
          </span>
          <Icon name="chevron-right" :size="18" class="shrink-0 text-ink-subtle" />
        </NuxtLink>

        <InstallCard class="mx-auto mt-6 max-w-md" />

        <section class="mt-20 text-center" aria-labelledby="crowd-title">
          <h2
            id="crowd-title"
            class="mx-auto max-w-[22ch] text-[24px] leading-tight font-bold tracking-[-0.025em] text-balance sm:text-[28px]"
          >
            Untuk siapa pun yang mau kamu kirimi surat.
          </h2>
          <p class="mx-auto mt-2 max-w-md text-pretty text-ink-muted">
            Teman sekelas, keluarga, atau orang yang baru kamu kenal hari ini. Mereka cukup membuka
            satu link.
          </p>
          <span
            class="mx-auto mt-6 block h-12 w-px bg-linear-to-b from-transparent to-ink/30"
            aria-hidden="true"
          />
        </section>
      </main>
    </div>

    <!-- Kerumunan dan garis tanahnya selebar layar; isi footer kembali ke kolom max-w-6xl. -->
    <CrowdStreet class="h-[180px] w-full border-b border-line sm:h-[220px]" />

    <footer
      class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-5 text-caption text-ink-muted sm:px-6"
    >
      <p>Versi beta ({{ version }}). Foto, kantong, dan draf suratmu tersimpan di perangkat ini.</p>
      <nav aria-label="Tentang PostPocket" class="flex gap-4">
        <FeedbackLink class="font-semibold text-ink underline underline-offset-2" />
        <NuxtLink to="/privasi" class="underline underline-offset-2 hover:text-ink"
          >Privasi</NuxtLink
        >
        <NuxtLink to="/lisensi" class="underline underline-offset-2 hover:text-ink"
          >Lisensi</NuxtLink
        >
      </nav>
    </footer>
  </div>
</template>
