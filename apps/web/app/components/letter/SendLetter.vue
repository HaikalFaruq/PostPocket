<script setup lang="ts">
import { contentPhotoKeys, publishableContent } from '@postpocket/presets'
import { errorMessage, sendLetter, type SentLetter } from '~/utils/letter-api'
import { forgetSent, rememberSent } from '~/utils/sent-letters'
import { compressPhoto, renderOgImage, type OgCard } from '~/utils/upload-image'

/**
 * Alur "Buat link" (PRD: Kirim dan buka): kompres foto, render gambar OG dari sampul yang sama,
 * unggah, terbitkan, lalu tampilkan link yang siap disalin atau dibagikan. Mulai begitu dibuka.
 * Dengan `existing`, langsung menampilkan link surat yang sudah dibuat dari draf yang sama.
 */
const props = defineProps<{ card: OgCard; existing?: SentLetter | null }>()
const emit = defineEmits<{ close: [] }>()
const draft = useLetterDraft()
const api = useLetterApi()

type Phase = 'photos' | 'og' | 'upload' | 'publish'
const state = ref<'sending' | 'done' | 'error' | 'deleted'>('sending')
const phase = ref<Phase>('photos')
const uploaded = ref(0)
const total = ref(0)
const error = ref('')
const sent = ref<SentLetter | null>(null)
const copied = ref(false)
const dialog = ref<HTMLElement | null>(null)
const canShare = import.meta.client && typeof navigator.share === 'function'

const phases: { id: Phase; label: string }[] = [
  { id: 'photos', label: 'Menyiapkan foto' },
  { id: 'og', label: 'Membuat gambar pratinjau' },
  { id: 'upload', label: 'Mengunggah' },
  { id: 'publish', label: 'Menerbitkan' },
]
const phaseIndex = computed(() => phases.findIndex((item) => item.id === phase.value))
// Foto isi (dan cover dari foto user) dihapus 7 hari setelah surat pertama kali dibuka (kontrak).
const hasPhotos = computed(
  () => draft.isPhotoFront || contentPhotoKeys(publishableContent(draft.content)).length > 0,
)

const expires = computed(() =>
  sent.value
    ? new Date(sent.value.expiresAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
      })
    : '',
)

async function send() {
  state.value = 'sending'
  error.value = ''
  phase.value = 'photos'
  uploaded.value = 0
  try {
    const cover = draft.isPhotoFront && draft.photo ? await compressPhoto(draft.photo) : null
    const keys = contentPhotoKeys(publishableContent(draft.content))
    const photos = Object.fromEntries(
      await Promise.all(
        keys.map(async (key) => [key, await compressPhoto(draft.photos[key]!)] as const),
      ),
    )
    phase.value = 'og'
    const og = await renderOgImage(props.card)
    phase.value = 'upload'
    const result = await sendLetter(
      api,
      {
        design: { ...draft.design },
        content: draft.content,
        cover,
        photos,
        og,
        replyTo: draft.replyTo,
      },
      (done, count) => {
        uploaded.value = done
        total.value = count
        if (done === count) phase.value = 'publish'
      },
    )
    await rememberSent(result)
    await draft.markSent(result)
    sent.value = result
    state.value = 'done'
  } catch (problem) {
    error.value = errorMessage(problem)
    state.value = 'error'
  }
}

async function copy() {
  if (!sent.value) return
  try {
    await navigator.clipboard.writeText(sent.value.url)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard ditolak: biarkan user menyalin dari kolomnya.
    document.querySelector<HTMLInputElement>('[data-testid="sent-url"]')?.select()
  }
}

async function share() {
  if (!sent.value) return
  try {
    await navigator.share({
      title: 'Ada surat untukmu',
      text: 'Ketuk kartunya untuk membuka surat dariku.',
      url: sent.value.url,
    })
  } catch {
    // Dibatalkan user.
  }
}

async function remove() {
  if (!sent.value || !window.confirm('Hapus surat ini? Link-nya tidak bisa dibuka lagi.')) return
  try {
    await api.remove(sent.value.id, sent.value.editToken)
    await forgetSent(sent.value.id)
    await draft.clearSent()
    state.value = 'deleted'
  } catch (problem) {
    error.value = errorMessage(problem)
  }
}

function close() {
  if (state.value !== 'sending') emit('close')
}

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
})

onMounted(() => {
  dialog.value?.focus()
  if (props.existing) {
    sent.value = props.existing
    state.value = 'done'
  } else send()
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 grid items-end bg-ink/40 sm:place-items-center"
    data-testid="send-letter"
    :data-state="state"
    @click.self="close"
  >
    <div
      ref="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-title"
      tabindex="-1"
      class="w-full rounded-t-[24px] bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] outline-none sm:max-w-md sm:rounded-[24px]"
    >
      <template v-if="state === 'sending'">
        <h2 id="send-title" class="text-title font-semibold">Membuat link…</h2>
        <ol class="mt-4 space-y-2" aria-live="polite">
          <li
            v-for="(item, index) in phases"
            :key="item.id"
            class="flex items-center gap-2 text-body"
            :class="index > phaseIndex ? 'text-ink-subtle' : 'text-ink'"
          >
            <span
              class="grid size-5 place-items-center rounded-full"
              :class="index < phaseIndex ? 'bg-ink text-white' : 'inset-ring inset-ring-line'"
            >
              <Icon v-if="index < phaseIndex" name="check" :size="12" />
              <span
                v-else-if="index === phaseIndex"
                class="size-2.5 animate-spin rounded-full border-2 border-ink/30 border-t-ink"
              />
            </span>
            {{ item.label
            }}<span v-if="item.id === 'upload' && total" class="text-ink-muted">
              {{ uploaded }}/{{ total }}</span
            >
          </li>
        </ol>
      </template>

      <template v-else-if="state === 'done' && sent">
        <h2 id="send-title" class="text-title font-semibold">Link surat siap</h2>
        <p class="mt-1 text-ink-muted">
          Kirim link ini ke dia. Suratnya bisa dibuka sampai {{ expires }}.
          <template v-if="hasPhotos">
            Fotonya hanya disimpan 7 hari sejak dia membuka surat, jadi minta dia segera membukanya.
          </template>
        </p>
        <div class="mt-4 flex gap-2">
          <input
            :value="sent.url"
            readonly
            aria-label="Link surat"
            data-testid="sent-url"
            class="h-10 min-w-0 flex-1 rounded-control bg-panel px-3 text-body inset-ring inset-ring-line"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <button
            type="button"
            class="h-10 shrink-0 rounded-control bg-ink px-4 text-body font-semibold text-white"
            @click="copy"
          >
            {{ copied ? 'Tersalin' : 'Salin' }}
          </button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-if="canShare"
            type="button"
            class="h-9 rounded-control px-3.5 text-body font-semibold inset-ring inset-ring-line"
            @click="share"
          >
            Bagikan
          </button>
          <a
            :href="sent.url"
            target="_blank"
            rel="noopener"
            class="inline-flex h-9 items-center rounded-control px-3.5 text-body font-semibold inset-ring inset-ring-line"
            >Lihat surat</a
          >
        </div>
        <p v-if="error" role="alert" class="mt-3 text-caption text-ink-muted">{{ error }}</p>
        <div class="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            class="text-caption text-ink-muted underline underline-offset-2"
            @click="remove"
          >
            Hapus surat ini
          </button>
          <button
            type="button"
            class="h-10 rounded-control bg-ink px-5 text-body font-semibold text-white"
            @click="close"
          >
            Selesai
          </button>
        </div>
      </template>

      <template v-else-if="state === 'deleted'">
        <h2 id="send-title" class="text-title font-semibold">Surat dihapus</h2>
        <p class="mt-1 text-ink-muted">Link-nya sudah tidak bisa dibuka.</p>
        <button
          type="button"
          class="mt-6 h-10 w-full rounded-control bg-ink text-body font-semibold text-white"
          @click="close"
        >
          Tutup
        </button>
      </template>

      <template v-else>
        <h2 id="send-title" class="text-title font-semibold">Link belum jadi</h2>
        <p role="alert" class="mt-1 text-ink-muted">{{ error }}</p>
        <div class="mt-6 flex gap-2">
          <button
            type="button"
            class="h-10 flex-1 rounded-control bg-ink text-body font-semibold text-white"
            @click="send"
          >
            Coba lagi
          </button>
          <button
            type="button"
            class="h-10 rounded-control px-4 text-body font-semibold inset-ring inset-ring-line"
            @click="close"
          >
            Tutup
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
