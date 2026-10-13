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
import { LetterApiError, errorMessage } from '~/utils/letter-api'
import { forgetSent, listSent, type SentRecord } from '~/utils/sent-letters'

/**
 * Surat yang dibuat linknya dari browser ini. Link lama tetap bisa disalin, dilihat, atau dihapus
 * walaupun editornya sudah dipakai untuk surat baru. Surat yang lewat masa aktifnya tidak tampil.
 */
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ changed: [] }>()
const draft = useLetterDraft()
const api = useLetterApi()

// Back di HP menutup daftar ini, bukan meninggalkan editor.
useBackToClose(open, () => {
  open.value = false
})

const letters = ref<SentRecord[]>([])
const copied = ref<string | null>(null)
const busy = ref<string | null>(null)
const error = ref('')

watch(
  open,
  async (isOpen) => {
    if (!isOpen) return
    error.value = ''
    const now = Date.now()
    letters.value = (await listSent()).filter((item) => Date.parse(item.expiresAt) > now)
  },
  { immediate: true },
)

const date = (value: string) =>
  new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })

async function copy(item: SentRecord) {
  try {
    await navigator.clipboard.writeText(item.url)
    copied.value = item.id
    setTimeout(() => {
      if (copied.value === item.id) copied.value = null
    }, 2000)
  } catch {
    // Clipboard ditolak: link tetap bisa dibuka lewat "Pratinjau" lalu disalin dari sana.
  }
}

async function forget(item: SentRecord) {
  await forgetSent(item.id)
  if (draft.sent?.id === item.id) await draft.clearSent()
  letters.value = letters.value.filter((other) => other.id !== item.id)
  emit('changed')
}

async function remove(item: SentRecord) {
  if (!window.confirm('Hapus surat ini? Link-nya tidak bisa dibuka lagi.')) return
  busy.value = item.id
  error.value = ''
  try {
    await api.remove(item.id, item.editToken)
    await forget(item)
  } catch (problem) {
    // Surat yang sudah tidak ada di server cukup dibuang dari daftar.
    if (problem instanceof LetterApiError && problem.code === 'not_found') await forget(item)
    else error.value = errorMessage(problem)
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="scrim fixed inset-0 z-50 data-[state=open]:animate-fade-in" />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[24px] bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px]"
        data-testid="sent-letters"
      >
        <div class="flex items-start justify-between gap-3">
          <DialogTitle class="text-title">Surat terkirim</DialogTitle>
          <DialogClose as-child>
            <IconButton label="Tutup" size="sm" variant="ghost">
              <Icon name="close" :size="15" />
            </IconButton>
          </DialogClose>
        </div>
        <DialogDescription class="mt-1 text-ink-muted">
          Link surat yang kamu buat di perangkat ini. Hanya perangkat ini yang bisa menghapusnya.
        </DialogDescription>
        <p v-if="error" role="alert" class="mt-3 text-caption text-ink-muted">{{ error }}</p>
        <ul v-if="letters.length" class="mt-4 min-h-0 space-y-2 overflow-y-auto overscroll-contain">
          <li
            v-for="item in letters"
            :key="item.id"
            class="rounded-control bg-panel p-3 inset-ring inset-ring-line"
            data-testid="sent-letter"
          >
            <p class="truncate font-letter text-[19px] leading-snug">
              {{ item.preview || 'Surat tanpa teks' }}
            </p>
            <p class="mt-0.5 text-caption text-ink-muted">
              Dibuat {{ date(item.publishedAt) }}, bisa dibuka sampai {{ date(item.expiresAt) }}
            </p>
            <div class="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                class="h-9 rounded-control bg-ink px-3.5 text-body font-semibold text-white"
                @click="copy(item)"
              >
                {{ copied === item.id ? 'Tersalin' : 'Salin link' }}
              </button>
              <a
                :href="item.url"
                target="_blank"
                rel="noopener"
                class="inline-flex h-9 items-center rounded-control px-3.5 text-body font-semibold inset-ring inset-ring-line"
                >Pratinjau</a
              >
              <button
                type="button"
                class="h-9 rounded-control px-3.5 text-body font-semibold text-ink-muted underline underline-offset-2 disabled:opacity-50"
                :disabled="busy === item.id"
                @click="remove(item)"
              >
                Hapus
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="mt-4 text-body text-ink-muted">Belum ada surat yang masih bisa dibuka.</p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
