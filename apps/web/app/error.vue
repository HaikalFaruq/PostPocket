<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * Halaman galat untuk alamat yang tidak ada (404) dan kesalahan lain. Surat yang sudah tidak
 * tersedia punya pesannya sendiri di /l/:slug, jadi halaman ini hanya untuk alamat yang salah.
 */
const props = defineProps<{ error: NuxtError }>()
const missing = computed(() => props.error.statusCode === 404)

useSeoMeta({
  title: () => `${missing.value ? 'Halaman tidak ada' : 'Ada yang tidak beres'} · PostPocket`,
  robots: 'noindex',
})

const home = (event?: Event) => {
  event?.preventDefault()
  clearError({ redirect: '/' })
}
const reload = () => window.location.reload()
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-canvas px-4 sm:px-6" data-testid="error-page">
    <header class="mx-auto flex w-full max-w-3xl items-center gap-2 py-4">
      <a
        href="/"
        class="inline-flex min-h-11 items-center gap-2 text-[17px] font-extrabold tracking-[-0.03em]"
        @click="home"
      >
        <img src="/favicon.svg" alt="" class="size-6" /> PostPocket
      </a>
    </header>
    <main class="flex flex-1 flex-col items-center justify-center pb-16 text-center">
      <!-- "Salah alamat": cap pos seperti pada surat yang dikembalikan ke pengirim. -->
      <p v-if="missing" class="postmark" aria-hidden="true">Alamat tidak dikenal</p>
      <h1 class="mt-8 text-title">
        {{ missing ? 'Halaman ini tidak ada' : 'Ada yang tidak beres' }}
      </h1>
      <p class="mt-2 max-w-sm text-body text-ink-muted">
        <template v-if="missing">
          Mungkin link-nya salah ketik. Kalau kamu mencari surat dari seseorang, minta dia mengirim
          ulang link-nya.
        </template>
        <template v-else>
          Coba muat ulang halaman ini. Draf, kantong, dan albummu tetap aman di perangkat ini.
        </template>
      </p>
      <div class="mt-6 flex flex-wrap justify-center gap-2">
        <button
          v-if="!missing"
          type="button"
          class="h-11 rounded-control bg-ink px-6 text-body font-semibold text-white"
          @click="reload"
        >
          Muat ulang
        </button>
        <a
          href="/"
          class="inline-flex h-11 items-center rounded-control px-6 text-body font-semibold"
          :class="missing ? 'bg-ink text-white' : 'inset-ring inset-ring-line'"
          @click="home"
        >
          Ke Beranda
        </a>
      </div>
      <p v-if="!missing" class="mt-6 text-caption text-ink-muted">
        Masih begini setelah dimuat ulang?
        <FeedbackLink class="font-semibold text-ink underline underline-offset-2" />
      </p>
    </main>
  </div>
</template>

<style scoped>
/* Cap karet merah pos, sedikit miring seperti dicap tangan. */
.postmark {
  padding: 10px 18px;
  border: 3px double var(--color-post-red);
  border-radius: 8px;
  color: var(--color-post-red);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transform: rotate(-7deg);
  opacity: 0.88;
}
</style>
