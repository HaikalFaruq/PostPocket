<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { LetterApiError } from '~/utils/letter-api'

/**
 * Konfirmasi hapus akun dari kartu Cadangan (`DELETE /account`, kontrak 0.4.0). Menyebut apa yang
 * ikut terhapus dan apa yang tetap ada. Fokus awalnya di Batal, jadi Enter tidak menghapus apa pun.
 * Tidak perlu login ulang: pemegang sesi juga bisa menghapus semua cadangan lewat sinkron.
 */
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  /** Akun sudah terhapus dan dialognya tertutup. Kartu Cadangan memindahkan fokus. */
  removed: []
}>()

const sync = useSync()
const busy = ref(false)
const failed = ref('')
const cancelButton = ref<HTMLButtonElement | null>(null)
let removed = false

/** Selama menghapus, dialog tidak bisa ditutup, termasuk lewat Back dan Esc. */
function close() {
  if (busy.value) return false
  open.value = false
}
useBackToClose(() => open.value, close)

watch(open, (isOpen) => {
  if (isOpen) failed.value = ''
})

async function confirm() {
  busy.value = true
  failed.value = ''
  try {
    await sync.removeAccount()
    removed = true
    open.value = false
  } catch (problem) {
    failed.value =
      problem instanceof LetterApiError && problem.code === 'network'
        ? 'Akunnya belum terhapus. Cek sinyal, lalu coba lagi.'
        : 'Akunnya belum terhapus karena server sedang bermasalah. Coba lagi sebentar lagi.'
  } finally {
    busy.value = false
  }
}

function focusCancel(event: Event) {
  event.preventDefault()
  cancelButton.value?.focus()
}

// Tombol Hapus akun sudah hilang bersama tampilan akun, jadi fokusnya diserahkan ke kartu.
function afterClose(event: Event) {
  if (!removed) return
  removed = false
  event.preventDefault()
  emit('removed')
}
</script>

<template>
  <DialogRoot :open="open" @update:open="(isOpen: boolean) => (isOpen ? (open = true) : close())">
    <DialogPortal>
      <DialogOverlay class="scrim fixed inset-0 z-[60] data-[state=open]:animate-fade-in" />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-[60] rounded-t-[24px] bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] text-pocket-ink sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px]"
        data-testid="delete-account"
        @open-auto-focus="focusCancel"
        @close-auto-focus="afterClose"
      >
        <DialogTitle class="text-title">Hapus akun?</DialogTitle>
        <DialogDescription class="mt-1 text-ink-muted">
          Akun <span class="break-all text-pocket-ink">{{ sync.user?.email }}</span> dan semua
          cadangan kenangannya di server dihapus sekarang juga. Ini tidak bisa dibatalkan.
        </DialogDescription>
        <p class="mt-3 text-body">Yang tetap ada:</p>
        <ul class="mt-1 list-disc space-y-1 pl-5 text-caption text-ink-muted">
          <li>kenangan di perangkat ini, jadi bisa kamu cadangkan lagi nanti;</li>
          <li>
            surat yang sudah kamu kirim dan kotak bareng, karena keduanya tidak terikat ke akun.
          </li>
        </ul>
        <p class="mt-3 rounded-control bg-[#fbefd2] px-3 py-2 text-caption text-[#7a5a14]">
          Perangkat lain yang masih masuk ke akun ini keluar sendiri, paling lama satu jam lagi.
        </p>
        <p v-if="failed" class="mt-3 text-caption text-[#a8402f]" role="alert">{{ failed }}</p>
        <div class="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            class="h-11 rounded-control bg-ink px-4 text-body font-semibold text-white disabled:opacity-50 sm:flex-1"
            :disabled="busy || sync.syncing"
            data-testid="delete-account-confirm"
            @click="confirm"
          >
            {{ busy ? 'Menghapus…' : 'Hapus akun' }}
          </button>
          <button
            ref="cancelButton"
            type="button"
            class="h-11 rounded-control px-4 text-body font-semibold inset-ring inset-ring-line disabled:opacity-50 sm:flex-1"
            :disabled="busy"
            @click="close"
          >
            Batal
          </button>
        </div>
        <p v-if="sync.syncing && !busy" class="mt-2 text-caption text-ink-muted">
          Tunggu sinkron selesai dulu.
        </p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
