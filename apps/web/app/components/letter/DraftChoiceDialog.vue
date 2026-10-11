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

/**
 * Pertanyaan "Masih ada draf surat" dari `askDraftChoice()`. Dipasang sekali di app.vue supaya
 * bisa muncul di Pocket, Booth, maupun editor surat.
 */
const { asking, answer } = useDraftChoice()
const keepButton = ref<HTMLButtonElement | null>(null)

// Fokus awal di pilihan yang tidak menghapus apa pun, jadi Enter tidak membuang draf.
function focusSafeChoice(event: Event) {
  event.preventDefault()
  keepButton.value?.focus()
}

const text = computed(() =>
  asking.value?.kind === 'reply'
    ? {
        question: 'Mulai balasan baru, atau jadikan draf itu balasannya?',
        warning: 'Kalau mulai balasan baru, draf itu dihapus.',
        fresh: 'Hapus draf, mulai balasan',
        keep: 'Jadikan draf ini balasan',
      }
    : {
        question: `Mulai surat baru dengan foto dari ${asking.value?.from ?? 'sini'}, atau tambahkan fotonya ke draf itu?`,
        warning: 'Kalau mulai surat baru, draf itu dihapus.',
        fresh: 'Hapus draf, mulai baru',
        keep: 'Tambahkan ke draf',
      },
)
</script>

<template>
  <DialogRoot :open="!!asking" @update:open="(isOpen: boolean) => !isOpen && answer(null)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[60] bg-ink/40 data-[state=open]:animate-fade-in" />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-[60] rounded-t-[24px] bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px]"
        data-testid="draft-choice"
        :data-kind="asking?.kind"
        @open-auto-focus="focusSafeChoice"
      >
        <DialogTitle class="text-title font-semibold">Masih ada draf surat</DialogTitle>
        <DialogDescription class="mt-1 text-ink-muted">
          Draf yang belum kamu kirim masih ada. {{ text.question }}
        </DialogDescription>
        <p class="mt-3 rounded-control bg-[#fbefd2] px-3 py-2 text-caption text-[#7a5a14]">
          {{ text.warning }}
        </p>
        <div class="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            class="h-11 rounded-control bg-ink px-4 text-body font-semibold text-white sm:flex-1"
            @click="answer('new')"
          >
            {{ text.fresh }}
          </button>
          <button
            ref="keepButton"
            type="button"
            class="h-11 rounded-control px-4 text-body font-semibold inset-ring inset-ring-line sm:flex-1"
            @click="answer('add')"
          >
            {{ text.keep }}
          </button>
        </div>
        <DialogClose
          class="mt-3 w-full text-center text-caption text-ink-muted underline underline-offset-2"
        >
          Batal
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
