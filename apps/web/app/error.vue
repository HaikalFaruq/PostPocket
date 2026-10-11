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

const home = () => clearError({ redirect: '/' })
const reload = () => window.location.reload()
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-canvas px-4 sm:px-6" data-testid="error-page">
    <header class="mx-auto flex w-full max-w-3xl items-center gap-2 py-4">
      <button
        type="button"
        class="inline-flex items-center gap-2 text-[15px] font-bold tracking-[-0.02em]"
        @click="home"
      >
        <img src="/favicon.svg" alt="" class="size-6" /> PostPocket
      </button>
    </header>
    <main class="flex flex-1 flex-col items-center justify-center pb-16 text-center">
      <h1 class="text-title font-semibold">
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
        <button
          type="button"
          class="h-11 rounded-control px-6 text-body font-semibold"
          :class="missing ? 'bg-ink text-white' : 'inset-ring inset-ring-line'"
          @click="home"
        >
          Ke Beranda
        </button>
      </div>
      <p v-if="!missing" class="mt-6 text-caption text-ink-muted">
        Masih begini setelah dimuat ulang?
        <FeedbackLink class="font-semibold text-ink underline underline-offset-2" />
      </p>
    </main>
  </div>
</template>
