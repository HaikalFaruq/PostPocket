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
const cancelButton = ref<HTMLButtonElement | null>(null)

// Back di HP sama dengan Batal, dan dialog tidak ikut terbawa ke halaman lain.
useBackToClose(
  () => !!asking.value,
  () => answer(null),
)
useRouter().afterEach((to, from) => {
  if (to.path !== from.path) answer(null)
})

const text = computed(() =>
  asking.value?.kind === 'reply'
    ? {
        question: 'Mulai balasan baru, atau jadikan draf itu balasan untuk surat ini?',
        warning: 'Kalau mulai balasan baru, draf itu dihapus.',
        fresh: 'Hapus draf, mulai balasan',
        keep: 'Jadikan draf ini balasan',
      }
    : asking.value?.kind === 'titip'
      ? {
          question: `Tulis surat baru untuk kotak "${asking.value.box ?? 'ini'}", atau titipkan draf itu?`,
          warning: 'Kalau tulis surat baru, draf itu dihapus.',
          fresh: 'Hapus draf, tulis baru',
          keep: 'Titipkan draf ini',
        }
      : {
          question: `Mulai surat baru dengan foto dari ${asking.value?.from ?? 'sini'}, atau tambahkan fotonya ke draf itu?`,
          warning: 'Kalau mulai surat baru, draf itu dihapus.',
          fresh: 'Hapus draf, mulai baru',
          keep: 'Tambahkan ke draf',
        },
)

// Fokus awal di pilihan yang tidak menghapus apa pun, jadi Enter tidak membuang draf. Untuk
// balasan, "Batal": memindahkan draf ke surat lain juga bisa salah alamat.
function focusSafeChoice(event: Event) {
  event.preventDefault()
  const safe =
    asking.value?.kind === 'reply' || asking.value?.kind === 'titip' || asking.value?.full
      ? cancelButton
      : keepButton
  safe.value?.focus()
}
</script>

<template>
  <DialogRoot :open="!!asking" @update:open="(isOpen: boolean) => !isOpen && answer(null)">
    <DialogPortal>
      <DialogOverlay class="scrim fixed inset-0 z-[60] data-[state=open]:animate-fade-in" />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-[60] rounded-t-[24px] bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px]"
        data-testid="draft-choice"
        :data-kind="asking?.kind"
        @open-auto-focus="focusSafeChoice"
      >
        <DialogTitle class="text-title">Masih ada draf surat</DialogTitle>
        <DialogDescription class="mt-1 text-ink-muted">
          Draf yang belum kamu kirim:
          <span class="font-letter text-[19px] text-ink" data-testid="draft-summary"
            >“{{ asking?.draft }}”</span
          >{{ /[.!?…]$/.test(asking?.draft ?? '') ? '' : '.' }}
          <template v-if="asking?.replyingElsewhere">
            Draf ini sudah jadi balasan untuk surat lain.
          </template>
          {{ text.question }}
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
            class="h-11 rounded-control px-4 text-body font-semibold inset-ring inset-ring-line disabled:opacity-40 sm:flex-1"
            :disabled="asking?.full"
            @click="answer('add')"
          >
            {{ text.keep }}
          </button>
        </div>
        <p v-if="asking?.full" class="mt-2 text-caption text-ink-muted">
          Draf itu sudah berisi 4 foto, jadi foto ini tidak bisa ditambahkan ke sana.
        </p>
        <DialogClose as-child>
          <button
            ref="cancelButton"
            type="button"
            class="mt-2 min-h-11 w-full rounded-control text-center text-body text-ink-muted underline underline-offset-2"
          >
            Batal
          </button>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
