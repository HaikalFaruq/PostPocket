<script setup lang="ts">
import { byId, letter, pocket } from '@postpocket/presets'

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

// Modul lain ditampilkan sebagai bendanya: kantong jajan Pocket dan strip foto Booth.
const packet = pocket.packetColors[0]!
const heart = byId(letter.stickers, 'heart')
// Satu foto contoh dengan empat filter Booth, seperti strip sungguhan.
const shots = ['none', 'grayscale(1)', 'sepia(0.75)', 'saturate(1.6) hue-rotate(-18deg)']
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6">
    <header class="flex items-center gap-2.5 py-5">
      <img src="/favicon.svg" alt="" class="size-7" />
      <p class="text-[20px] leading-none font-extrabold tracking-[-0.035em]">PostPocket</p>
    </header>

    <main class="grid flex-1 gap-10 pb-10 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
      <!-- Pembuka: surat contoh dalam amplop par avion, yang bisa langsung dibuka. -->
      <figure class="lg:order-2">
        <div class="airmail">
          <div
            class="relative h-[clamp(240px,40dvh,440px)] rounded-[3px] bg-canvas lg:h-[min(58dvh,520px)]"
          >
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
                  <p class="mt-[6cqw] text-right">Kall</p>
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
        <figcaption class="mt-3 text-center text-caption text-ink-muted">
          Contoh surat. Ketuk untuk membuka, geser untuk memutar.
        </figcaption>
      </figure>

      <div class="lg:order-1">
        <h1
          class="text-[38px] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance sm:text-[60px]"
        >
          Kenangan kecil, dikirim jadi surat.
        </h1>
        <p class="mt-4 max-w-md text-[16px] leading-relaxed text-pretty text-ink-muted">
          Tulis kartu foil 3D, lalu kirim lewat satu link. Penerimanya tinggal mengetuk kartunya,
          tanpa daftar dan tanpa aplikasi.
        </p>
        <NuxtLink
          to="/letter/new"
          class="mt-6 inline-flex h-12 items-center rounded-control bg-ink px-7 text-[15px] font-semibold text-white transition-colors hover:bg-ink/90"
        >
          Tulis surat
        </NuxtLink>

        <ul class="mt-12 max-w-md divide-y divide-line-soft border-y border-line-soft">
          <li>
            <NuxtLink to="/pocket" class="group flex items-center gap-4 py-4">
              <span class="grid w-14 shrink-0 place-items-center">
                <span class="w-12 -rotate-6 transition-transform group-hover:-rotate-2">
                  <SnackPacket :color="packet.color" :sticker="heart" mini />
                </span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[17px] font-bold tracking-[-0.02em]">Pocket</span>
                <span class="mt-0.5 block text-ink-muted">
                  Simpan satu hal kecil setiap hari di kantong berstiker.
                </span>
              </span>
              <Icon name="chevron-right" :size="18" class="shrink-0 text-ink-subtle" />
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/tv?booth=1" class="group flex items-center gap-4 py-4">
              <span class="grid w-14 shrink-0 place-items-center">
                <span
                  class="booth-mini w-8 rotate-6 transition-transform group-hover:rotate-2"
                  aria-hidden="true"
                >
                  <img
                    v-for="filter in shots"
                    :key="filter"
                    src="/samples/contoh-foto.svg"
                    alt=""
                    class="booth-mini__shot"
                    :style="{ filter }"
                  />
                </span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[17px] font-bold tracking-[-0.02em]">Booth</span>
                <span class="mt-0.5 block text-ink-muted">
                  Empat jepretan berfilter retro, langsung jadi strip foto.
                </span>
              </span>
              <Icon name="chevron-right" :size="18" class="shrink-0 text-ink-subtle" />
            </NuxtLink>
          </li>
        </ul>
      </div>
    </main>

    <InstallCard class="mb-6 max-w-md" />

    <footer
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line-soft py-5 text-caption text-ink-muted"
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

<style scoped>
/* Strip Booth mini: empat jepretan dalam bingkai putih. */
.booth-mini {
  display: grid;
  gap: 3px;
  padding: 4px 4px 9px;
  background-color: var(--color-white);
  border-radius: 2px;
  box-shadow: 0 6px 12px -6px rgb(24 32 74 / 0.45);
}

.booth-mini__shot {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 1px;
}
</style>
