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
    /** Tujuan fokus setelah menutup, kalau tombol yang membuka penampil sudah tidak ada. */
    fallbackFocus?: () => HTMLElement | null
  }>(),
  { origin: null, fallbackFocus: undefined },
)
const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })
const emit = defineEmits<{ opened: [id: string] }>()

// Surat terakhir yang tampil tetap dipakai kalau daftarnya habis (surat terakhir dihapus),
// supaya penampil yang sedang menutup tidak sempat berganti judul.
const last = shallowRef<ShownLetter | null>(null)
const current = computed(
  () =>
    props.letters[index.value] ?? props.letters[0] ?? (props.letters.length ? null : last.value),
)
watch(current, (letter) => letter && (last.value = letter), { immediate: true })
const cardOpen = ref(false)
const reading = ref(false)
const direction = ref(1)
const stage = ref<HTMLElement | null>(null)
const prevButton = ref<{ $el: HTMLElement } | null>(null)
const nextButton = ref<{ $el: HTMLElement } | null>(null)

// Daftar berubah (misalnya surat dihapus): indeks tetap di dalam daftar, dan penampil ditutup
// kalau suratnya habis. Surat sebelumnya masuk dari kiri, sesuai arahnya.
watch(
  () => props.letters.length,
  (count) => {
    if (!count) open.value = false
    else if (index.value > count - 1) {
      direction.value = -1
      index.value = count - 1
    }
  },
)

watch(current, (next, previous) => {
  if (!next || next.id === previous?.id) return
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
  // Di surat pertama atau terakhir tombolnya nonaktif. Kalau fokus keyboard ada di sana, fokusnya
  // dipindah ke tombol arah sebaliknya, supaya tidak lepas dari penampil.
  const pressed = (step > 0 ? nextButton : prevButton).value?.$el
  const other = (step > 0 ? prevButton : nextButton).value?.$el
  const atEnd = step > 0 ? next === props.letters.length - 1 : next === 0
  if (atEnd && pressed && document.activeElement === pressed) void nextTick(() => other?.focus())
}

// Tombol yang membuka penampil. Kalau tombol itu hilang selama penampil terbuka (suratnya dihapus
// dan foldernya ikut hilang), fokus kembali ke `fallbackFocus`, bukan ke <body>.
let opener: Element | null = null
watch(open, (isOpen) => isOpen && (opener = document.activeElement), { flush: 'sync' })
function onCloseFocus(event: Event) {
  if (!opener || opener.isConnected) return
  const target = props.fallbackFocus?.()
  if (!target) return
  event.preventDefault()
  target.focus()
}

// Back di HP menutup penampil, bukan meninggalkan halaman.
useBackToClose(open, () => {
  open.value = false
})

/**
 * Kartu tumbuh dari lembar suratnya di folder ke tengah layar. Tanpa lembar asal (dibuka dari
 * daftar, atau lembarnya di luar layar), kartunya naik dari bawah. Selama bergerak kartunya tidak
 * bisa diketuk, supaya ketukan kedua di lembar tadi tidak langsung membuka kartu yang lewat.
 */
function rise() {
  const el = stage.value
  if (!el || calmMotion()) return
  const to = el.getBoundingClientRect()
  if (!to.width || !to.height) return
  const from = props.origin
  const visible = !!from && from.bottom > 0 && from.top < window.innerHeight
  let keyframes: Keyframe[]
  if (from && visible) {
    // Kartunya (bukan seluruh panggung) dicocokkan ke lembar: ukurannya muat di lembar, lalu
    // titik tengahnya mendarat di titik tengah lembar.
    const card = el.querySelector('.foil-rotor')?.getBoundingClientRect()
    const target = card && card.width > 0 && card.height > 0 ? card : null
    const fit = target
      ? Math.min(from.width / target.width, from.height / target.height)
      : from.height / (to.height * 0.72)
    const scale = Math.max(0.12, Math.min(1, fit))
    const ox = to.left + to.width / 2
    const oy = to.top + to.height / 2
    const cx = target ? target.left + target.width / 2 : ox
    const cy = target ? target.top + target.height / 2 : oy
    const dx = from.left + from.width / 2 - (ox + scale * (cx - ox))
    const dy = from.top + from.height / 2 - (oy + scale * (cy - oy))
    keyframes = [
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.2 },
      { transform: 'none', opacity: 1 },
    ]
  } else {
    keyframes = [
      { transform: 'translateY(32px) scale(0.94)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ]
  }
  el.style.pointerEvents = 'none'
  const done = () => (el.style.pointerEvents = '')
  el.animate(keyframes, {
    duration: visible ? 480 : 360,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  }).finished.then(done, done)
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
        @close-auto-focus="onCloseFocus"
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
              aria-live="polite"
              data-testid="viewer-count"
            >
              Surat {{ index + 1 }} dari {{ letters.length }}
            </p>
          </div>
          <slot v-if="current" name="actions" :letter="current" />
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
            ref="prevButton"
            label="Surat sebelumnya"
            variant="ghost"
            size="lg"
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
              class="inline-flex h-11 items-center rounded-control px-4 text-body font-semibold inset-ring inset-ring-line hover:bg-panel"
              @click="reading = true"
            >
              Baca lebih besar
            </button>
          </div>
          <IconButton
            ref="nextButton"
            label="Surat berikutnya"
            variant="ghost"
            size="lg"
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
