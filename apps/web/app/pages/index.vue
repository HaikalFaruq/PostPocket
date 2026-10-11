<script setup lang="ts">
import { byId, letter } from '@postpocket/presets'
import type { IconName } from '~/utils/icons'

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

const doors: { title: string; text: string; icon: IconName; to: string }[] = [
  {
    title: 'Booth',
    text: 'Foto 4 frame dengan filter retro, langsung jadi strip.',
    icon: 'camera',
    to: '/tv?booth=1',
  },
  {
    title: 'Pocket',
    text: 'Simpan satu hari kecil di kantong berstiker.',
    icon: 'calendar',
    to: '/pocket',
  },
  {
    title: 'Letter',
    text: 'Kartu foil 3D yang dikirim lewat satu link.',
    icon: 'link',
    to: '/letter/new',
  },
]

const example = letter.illustrations[0]!
const foil = byId(letter.foilColors, 'gold')!
const paper = byId(letter.papers, 'cream')!
const open = ref(false)
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6">
    <header class="flex items-center gap-3 py-5">
      <img src="/favicon.svg" alt="" class="size-8" />
      <div>
        <p class="text-[17px] leading-none font-bold tracking-[-0.02em]">PostPocket</p>
        <p class="mt-1 text-caption text-ink-muted">kantong kecil untuk momen-momenmu</p>
      </div>
    </header>

    <main class="grid flex-1 items-center gap-10 py-6 lg:grid-cols-[1fr_1.05fr] lg:py-10">
      <div>
        <p class="font-mono text-[11px] tracking-[0.2em] text-ink-subtle uppercase">
          Booth · Pocket · Letter
        </p>
        <h1
          class="mt-3 text-[34px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-display"
        >
          Tangkap momen, simpan per hari, kirim sebagai surat foil.
        </h1>
        <p class="mt-4 max-w-md text-[15px] leading-relaxed text-ink-muted">
          Foto dari Booth atau galeri masuk ke kantong harian, lalu bisa dikirim sebagai kartu foil
          3D yang dibuka lewat satu link.
        </p>

        <ul class="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <li v-for="door in doors" :key="door.title">
            <NuxtLink
              :to="door.to"
              class="block h-full rounded-[20px] bg-surface p-4 shadow-raised transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div class="flex items-center justify-between">
                <span class="grid size-9 place-items-center rounded-full bg-fill">
                  <Icon :name="door.icon" :size="17" />
                </span>
                <span
                  class="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white"
                >
                  Buat <Icon name="arrow-right" :size="11" />
                </span>
              </div>
              <h2 class="mt-3 text-[15px] font-semibold">{{ door.title }}</h2>
              <p class="mt-1 text-caption text-ink-muted">{{ door.text }}</p>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <figure class="flex flex-col items-center">
        <div class="relative h-[min(64dvh,560px)] w-full">
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
                <p class="mt-[6cqw] text-right">— Kall</p>
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
        <figcaption class="mt-2 text-caption text-ink-muted">
          Contoh surat · ketuk untuk membuka, geser untuk memutar
        </figcaption>
      </figure>
    </main>

    <InstallCard class="mb-6 max-w-md" />

    <footer class="border-t border-line-soft py-5 text-caption text-ink-muted">
      <p>Versi beta · foto, kantong, dan draf suratmu tersimpan di perangkat ini.</p>
    </footer>
  </div>
</template>
