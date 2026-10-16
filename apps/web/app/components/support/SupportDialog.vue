<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { SUPPORT_URL } from '~/utils/support'

/**
 * Ajakan dukungan lewat Sociabuzz, dibuka dari Beranda. Dibuka dengan bendanya, perangko yang
 * ditempel lalu dicap. Tombol utamanya tautan biasa ke Sociabuzz di tab baru, jadi tetap jalan
 * tanpa JavaScript tambahan, dan PostPocket tidak mengirim data apa pun ke sana.
 */
const open = defineModel<boolean>('open', { default: false })

useBackToClose(
  () => open.value,
  () => {
    open.value = false
  },
)

const uses = [
  'server surat dan cadangan Pocket tetap menyala;',
  'desain kartu, stiker, dan bingkai baru;',
  'PostPocket tetap gratis untuk semua orang.',
]
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="scrim fixed inset-0 z-[60] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-[60] max-h-dvh overflow-y-auto overscroll-contain rounded-t-[24px] bg-surface pb-[max(24px,env(safe-area-inset-bottom))] text-ink data-[state=closed]:animate-rise-out data-[state=open]:animate-rise-in sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px] sm:pb-6"
        data-testid="support-dialog"
      >
        <!-- Perangko di panggung berkisi titik, seperti kartu contoh di Beranda. -->
        <div class="dot-stage grid h-[200px] place-items-center rounded-t-[24px] bg-canvas">
          <SupportStamp postmark animate class="w-[116px] -translate-x-7" />
        </div>
        <DialogClose as-child>
          <IconButton label="Tutup" class="absolute top-4 right-4">
            <Icon name="close" :size="18" />
          </IconButton>
        </DialogClose>

        <div class="px-6 pt-5">
          <DialogTitle class="text-title">Traktir PostPocket</DialogTitle>
          <DialogDescription class="mt-2 text-pretty text-ink-muted">
            PostPocket gratis, tanpa iklan, dan tanpa daftar. Kalau kamu suka, kirim dukungan
            seikhlasnya lewat Sociabuzz.
          </DialogDescription>

          <p class="mt-4 text-body font-semibold">Dukunganmu dipakai untuk:</p>
          <ul class="mt-2 space-y-2">
            <li v-for="item in uses" :key="item" class="flex items-start gap-2.5 text-body">
              <span
                class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-fill text-ink"
              >
                <Icon name="check" :size="13" />
              </span>
              <span class="text-ink-muted">{{ item }}</span>
            </li>
          </ul>

          <div class="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <a
              :href="SUPPORT_URL"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex h-11 items-center justify-center rounded-control bg-ink px-4 text-body font-semibold text-white hover:bg-ink/90 sm:flex-1"
              data-testid="support-link"
              @click="open = false"
            >
              Dukung lewat Sociabuzz<span class="sr-only"> (dibuka di tab baru)</span>
            </a>
            <DialogClose
              class="h-11 rounded-control px-4 text-body font-semibold inset-ring inset-ring-line hover:bg-fill sm:flex-1"
            >
              Nanti saja
            </DialogClose>
          </div>
          <p class="mt-3 text-caption text-pretty text-ink-muted">
            Dibuka di sociabuzz.com. Pembayarannya diurus Sociabuzz, jadi PostPocket tidak melihat
            data pembayaranmu.
          </p>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
