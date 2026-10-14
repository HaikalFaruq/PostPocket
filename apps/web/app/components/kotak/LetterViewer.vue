<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import type { ShownLetter } from '~/utils/letter-view'
import { calmMotion } from '~/utils/render'

/**
 * Surat-surat di satu folder, dibaca satu per satu. Kartunya keluar dari lembar yang diketuk di
 * folder kaca (`origin`), lalu dibuka dengan ketukan seperti di halaman surat. Sebelumnya dan
 * Berikutnya menggeser kartu ke samping. `opened` dipanggil saat sebuah kartu pertama kali dibuka.
 */
const props = withDefaults(
  defineProps<{
    letters: ShownLetter[]
    /** Judul folder, dipakai kalau suratnya tidak punya nama pengirim. */
    title: string
    /** Kotak layar lembar surat di folder, untuk animasi keluar dari folder. */
    origin?: DOMRect | null
  }>(),
  { origin: null },
)
const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })
const emit = defineEmits<{ opened: [id: string] }>()

const current = computed(() => props.letters[index.value] ?? props.letters[0] ?? null)
const cardOpen = ref(false)
const reading = ref(false)
const direction = ref(1)
const stage = ref<HTMLElement | null>(null)

// Daftar berubah (misalnya surat dihapus): indeks tetap di dalam daftar, dan penampil ditutup
// kalau suratnya habis.
watch(
  () => props.letters.length,
  (count) => {
    if (!count) open.value = false
    else if (index.value > count - 1) index.value = count - 1
  },
)

watch(current, (next, previous) => {
  if (next?.id === previous?.id) return
  cardOpen.value = false
  reading.value = false
})

watch(cardOpen, (isOpen) => {
  if (isOpen && current.value) emit('opened', current.value.id)
})

/**
 * Kartu yang sedang bergeser keluar tidak bisa disentuh dan disembunyikan dari pembaca layar,
 * supaya selama animasi hanya ada satu surat yang aktif.
 */
function retire(el: Element) {
  if (!(el instanceof HTMLElement)) return
  el.inert = true
  el.setAttribute('aria-hidden', 'true')
}

function go(step: number) {
  const next = index.value + step
  if (next < 0 || next > props.letters.length - 1) return
  direction.value = step
  index.value = next
}

// Back di HP menutup penampil, bukan meninggalkan halaman.
useBackToClose(open, () => {
  open.value = false
})

/** Kartu tumbuh dari lembar suratnya di folder ke tengah layar. */
function rise() {
  const el = stage.value
  const from = props.origin
  if (!el || !from || calmMotion()) return
  const to = el.getBoundingClientRect()
  if (!to.width || !to.height) return
  const scale = Math.max(0.12, Math.min(1, from.height / (to.height * 0.72)))
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.2 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 480, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  )
}

// Setiap kali dibuka, kartunya mulai tertutup. Diatur sebelum render, supaya kartu yang terakhir
// dibuka tidak sempat tampil terbuka lalu menutup sendiri.
watch(open, (isOpen) => {
  if (!isOpen) return
  cardOpen.value = false
  reading.value = false
})

// Animasi keluar dari folder dimulai begitu penampilnya terpasang dan ukurannya terbaca.
watch(
  open,
  (isOpen) => {
    if (isOpen) requestAnimationFrame(rise)
  },
  { flush: 'post', immediate: true },
)

const label = computed(() =>
  current.value?.from ? `Surat dari ${current.value.from}` : 'Surat untukmu',
)
const heading = computed(() => (current.value?.from ? `Dari ${current.value.from}` : props.title))
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="scrim fixed inset-0 z-40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <DialogContent
        class="fixed inset-0 z-50 flex flex-col px-4 pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] outline-none data-[state=closed]:animate-fade-out"
        :aria-describedby="undefined"
        data-testid="letter-viewer"
      >
        <header
          class="mx-auto flex w-full max-w-xl items-center gap-3 rounded-[18px] bg-surface/90 py-2 pr-2 pl-4 shadow-float"
        >
          <div class="min-w-0 flex-1">
            <DialogTitle class="truncate text-body font-semibold" data-testid="viewer-title">
              {{ heading }}
            </DialogTitle>
            <p
              v-if="letters.length > 1"
              class="text-caption text-ink-muted"
              data-testid="viewer-count"
            >
              Surat {{ index + 1 }} dari {{ letters.length }}
            </p>
          </div>
          <DialogClose as-child>
            <IconButton label="Tutup" variant="ghost">
              <Icon name="close" :size="18" />
            </IconButton>
          </DialogClose>
        </header>

        <div ref="stage" class="relative min-h-0 flex-1 overflow-hidden">
          <Transition :name="direction > 0 ? 'viewer-next' : 'viewer-prev'" @before-leave="retire">
            <div
              v-if="current"
              :key="current.id"
              class="absolute inset-0"
              data-testid="viewer-letter"
            >
              <ReceivedLetter
                v-model:open="cardOpen"
                v-model:reading="reading"
                :letter="current"
                :label="label"
              />
            </div>
          </Transition>
        </div>

        <footer
          class="mx-auto flex w-full max-w-xl items-center gap-2 rounded-[18px] bg-surface/90 p-2 shadow-float"
        >
          <IconButton
            label="Surat sebelumnya"
            variant="ghost"
            :disabled="index === 0"
            data-testid="viewer-prev"
            @click="go(-1)"
          >
            <Icon name="chevron-left" :size="18" />
          </IconButton>
          <div class="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
            <p v-if="!cardOpen" class="px-1 text-center text-caption text-ink-muted">
              Ketuk kartunya untuk membuka
            </p>
            <button
              v-else
              type="button"
              class="inline-flex h-10 items-center rounded-control px-4 text-body font-semibold inset-ring inset-ring-line hover:bg-panel"
              @click="reading = true"
            >
              Baca lebih besar
            </button>
            <slot v-if="current" name="actions" :letter="current" />
          </div>
          <IconButton
            label="Surat berikutnya"
            variant="ghost"
            :disabled="index >= letters.length - 1"
            data-testid="viewer-next"
            @click="go(1)"
          >
            <Icon name="chevron-right" :size="18" />
          </IconButton>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.viewer-next-enter-active,
.viewer-next-leave-active,
.viewer-prev-enter-active,
.viewer-prev-leave-active {
  transition:
    transform 340ms var(--ease-card),
    opacity 260ms ease;
}

.viewer-next-enter-from,
.viewer-prev-leave-to {
  transform: translateX(28%) rotate(4deg);
  opacity: 0;
}

.viewer-next-leave-to,
.viewer-prev-enter-from {
  transform: translateX(-28%) rotate(-4deg);
  opacity: 0;
}
</style>
