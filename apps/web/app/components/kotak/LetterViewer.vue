<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { warmCardFront } from '~/composables/useCardFront'
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
const overlay = ref<{ $el: HTMLElement } | null>(null)
const content = ref<{ $el: HTMLElement } | null>(null)
const prevButton = ref<{ $el: HTMLElement } | null>(null)
const nextButton = ref<{ $el: HTMLElement } | null>(null)

// Ketukan Sebelumnya dan Berikutnya selama kartu masih bergeser digabung: begitu geseran itu
// selesai, kartunya langsung bergeser ke surat tujuannya, tanpa memasang setiap surat di antaranya.
const SLIDE_MS = 340
const pending = ref<number | null>(null)
/** Surat yang dituju: yang sedang tampil, atau tujuan ketukan yang masih menunggu. */
const target = computed(() => pending.value ?? index.value)
let slideUntil = 0
let pendingTimer: ReturnType<typeof setTimeout> | undefined

function cancelPending() {
  clearTimeout(pendingTimer)
  pending.value = null
}

// Daftar berubah (misalnya surat dihapus): indeks tetap di dalam daftar, dan penampil ditutup
// kalau suratnya habis. Surat sebelumnya masuk dari kiri, sesuai arahnya.
watch(
  () => props.letters.length,
  (count) => {
    cancelPending()
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

function slideTo(next: number) {
  // Fokus di kartu yang bergeser keluar ikut hilang bersama kartunya, jadi pindah ke kartu baru.
  const hadFocus = !!stage.value?.contains(document.activeElement)
  direction.value = next > index.value ? 1 : -1
  index.value = next
  slideUntil = calmMotion() ? 0 : performance.now() + SLIDE_MS
  if (!hadFocus) return
  // Sampai kartu barunya terukur, fokus dititipkan di penampil, supaya tombol yang ditekan di
  // antaranya tidak jatuh ke halaman di belakang.
  content.value?.$el.focus({ preventScroll: true })
  void nextTick(() => whenMeasured((card) => card?.focus({ preventScroll: true })))
}

function go(step: number) {
  const next = target.value + step
  if (next < 0 || next > props.letters.length - 1) return
  const wait = slideUntil - performance.now()
  if (wait > 0) {
    pending.value = next
    clearTimeout(pendingTimer)
    pendingTimer = setTimeout(() => {
      const queued = pending.value
      pending.value = null
      if (queued !== null && queued !== index.value) slideTo(queued)
    }, wait)
  } else slideTo(next)
  // Di surat pertama atau terakhir tombolnya nonaktif. Kalau fokus keyboard ada di sana, fokusnya
  // dipindah ke tombol arah sebaliknya, supaya tidak lepas dari penampil.
  const pressed = (step > 0 ? nextButton : prevButton).value?.$el
  const other = (step > 0 ? prevButton : nextButton).value?.$el
  const atEnd = step > 0 ? next === props.letters.length - 1 : next === 0
  if (atEnd && pressed && document.activeElement === pressed) void nextTick(() => other?.focus())
}

// Tombol yang membuka penampil. Kalau tombol itu hilang selama penampil terbuka (suratnya dihapus
// dan foldernya ikut hilang), fokus kembali ke `fallbackFocus`, bukan ke <body>, tanpa menggulir
// halaman di belakangnya.
let opener: Element | null = null
watch(open, (isOpen) => isOpen && (opener = document.activeElement), { flush: 'sync' })
function onCloseFocus(event: Event) {
  if (!opener || opener.isConnected) return
  const target = props.fallbackFocus?.()
  if (!target) return
  event.preventDefault()
  target.focus({ preventScroll: true })
}

// Ditutup selagi masih memudar masuk: memudar keluarnya mulai dari kepekatan saat itu, bukan dari
// penuh, jadi latarnya tidak berkedip (`--fade-from` di keyframes fade-out).
watch(
  open,
  (isOpen) => {
    if (isOpen) return
    cancelPending()
    for (const el of [overlay.value?.$el, content.value?.$el]) {
      if (el instanceof HTMLElement)
        el.style.setProperty('--fade-from', getComputedStyle(el).opacity)
    }
  },
  { flush: 'sync' },
)

// Back di HP menutup penampil, bukan meninggalkan halaman.
useBackToClose(open, () => {
  open.value = false
})

/**
 * Jalankan `task` begitu FoilCard surat yang tampil (bukan yang sedang bergeser keluar) selesai
 * mengukur kartunya, paling lama 12 frame.
 */
function whenMeasured(task: (card: HTMLElement | null) => void) {
  let frames = 0
  const check = () => {
    const card =
      stage.value?.querySelector<HTMLElement>(
        '[data-testid="viewer-letter"]:not([aria-hidden="true"]) .foil-rotor',
      ) ?? null
    if (card?.classList.contains('is-measuring') && frames++ < 12) requestAnimationFrame(check)
    else task(card)
  }
  check()
}

// Fokus awal di kartunya, bukan di tombol pertama (Hapus): pembaca layar langsung menyebut
// suratnya, dan Enter langsung membukanya. Sebelum kartunya terukur fokusnya di penampil.
function onOpenFocus(event: Event) {
  event.preventDefault()
  content.value?.$el.focus({ preventScroll: true })
  whenMeasured((card) => card?.focus({ preventScroll: true }))
}

// Panah kiri dan kanan pindah surat, seperti penampil foto. Di sini panah tidak membalik kartu.
function onKeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || reading.value) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  event.stopPropagation()
  go(event.key === 'ArrowRight' ? 1 : -1)
}

// Gestur yang biasa di HP: geser ke samping di luar kartu untuk pindah surat, geser ke bawah untuk
// menutup. Di atas kartunya, geseran tetap memutar kartu.
let swipe: { id: number; x: number; y: number } | null = null
function onStageDown(event: PointerEvent) {
  swipe = null
  if (event.pointerType === 'mouse' || !(event.target instanceof Element)) return
  if (event.target.closest('.foil-rotor, button, a')) return
  swipe = { id: event.pointerId, x: event.clientX, y: event.clientY }
}
function onStageUp(event: PointerEvent) {
  const start = swipe
  swipe = null
  if (!start || start.id !== event.pointerId) return
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1)
  else if (dy > 80 && dy > Math.abs(dx) * 1.4) open.value = false
}
function onStageCancel() {
  swipe = null
}

/**
 * Kartu tumbuh dari lembar suratnya di folder ke tengah layar. Tanpa lembar asal (dibuka dari
 * daftar, atau lembarnya di luar layar), kartunya naik dari bawah. Selama bergerak kartunya tidak
 * bisa diketuk, supaya ketukan kedua di lembar tadi tidak langsung membuka kartu yang lewat.
 *
 * FoilCard menyembunyikan kartunya sampai ukuran panggungnya terbaca, jadi animasinya baru dimulai
 * setelah itu, dari ukuran kartu yang sebenarnya. Selama menunggu panggungnya transparan, supaya
 * kartunya tidak sempat tampil di tempat akhirnya. Kartunya tidak menunggu mask foil: surat yang
 * belum sempat disiapkan langsung naik, dan foilnya memudar masuk begitu siap (`foil-in` di
 * FoilCard), karena menunggu membuat ketukan terasa lambat dan di HP lambat foilnya tetap telat.
 */
function rise() {
  const el = stage.value
  if (!el || calmMotion()) return
  const to = el.getBoundingClientRect()
  if (!to.width || !to.height) return
  el.style.opacity = '0'
  el.style.pointerEvents = 'none'
  whenMeasured((card) => {
    el.style.opacity = ''
    play(el, to, card?.getBoundingClientRect())
  })
}

function play(el: HTMLElement, to: DOMRect, card: DOMRect | undefined) {
  const from = props.origin
  const visible = !!from && from.bottom > 0 && from.top < window.innerHeight
  let keyframes: Keyframe[]
  if (from && visible) {
    // Kartunya (bukan seluruh panggung) dicocokkan ke lembar: ukurannya muat di lembar, lalu
    // titik tengahnya mendarat di titik tengah lembar.
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

// Surat sesudah dan sebelum yang tampil disiapkan satu per satu saat browser senggang (gambar
// cetak dan mask foil), jadi kartunya langsung utuh begitu digeser ke sana. Antreannya diganti
// setiap kali surat tujuannya berubah.
let warmRun = 0
watch(
  [open, target],
  async ([isOpen, at]) => {
    const run = ++warmRun
    if (!isOpen) return
    const wanted = () => run === warmRun
    for (const i of [at + 1, at - 1, at + 2]) {
      const letter = props.letters[i]
      if (!letter) continue
      await warmCardFront(letter.design, letter.cover?.url, wanted)
      if (!wanted()) return
    }
  },
  { immediate: true },
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
        ref="overlay"
        class="scrim fixed inset-0 z-40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <DialogContent
        ref="content"
        class="fixed inset-0 z-50 flex flex-col px-4 pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] outline-none data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in [@media(max-height:440px)]:pt-[max(6px,env(safe-area-inset-top))] [@media(max-height:440px)]:pb-[max(6px,env(safe-area-inset-bottom))]"
        :aria-describedby="undefined"
        tabindex="-1"
        data-testid="letter-viewer"
        @open-auto-focus="onOpenFocus"
        @close-auto-focus="onCloseFocus"
        @keydown.capture="onKeydown"
      >
        <header
          class="mx-auto flex w-full max-w-xl items-center gap-3 rounded-[18px] bg-surface/90 py-2 pr-2 pl-4 shadow-float [@media(max-height:440px)]:py-0.5"
        >
          <div class="min-w-0 flex-1">
            <DialogTitle class="truncate text-body font-semibold" data-testid="viewer-title">
              {{ heading }}
            </DialogTitle>
            <p
              v-if="letters.length > 1"
              class="text-caption text-ink-muted [@media(max-height:440px)]:sr-only"
              aria-live="polite"
              data-testid="viewer-count"
            >
              Surat {{ target + 1 }} dari {{ letters.length }}
            </p>
          </div>
          <slot v-if="current" name="actions" :letter="current" />
          <DialogClose as-child>
            <IconButton label="Tutup" variant="ghost" size="lg">
              <Icon name="close" :size="18" />
            </IconButton>
          </DialogClose>
        </header>

        <div
          ref="stage"
          class="relative min-h-0 flex-1 touch-pinch-zoom overflow-hidden"
          @pointerdown="onStageDown"
          @pointerup="onStageUp"
          @pointercancel="onStageCancel"
        >
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
                :arrow-hint="false"
              />
            </div>
          </Transition>
        </div>

        <footer
          class="mx-auto flex w-full max-w-xl items-center gap-2 rounded-[18px] bg-surface/90 p-2 shadow-float [@media(max-height:440px)]:py-0.5"
        >
          <IconButton
            ref="prevButton"
            label="Surat sebelumnya"
            variant="ghost"
            size="lg"
            :disabled="target === 0"
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
            :disabled="target >= letters.length - 1"
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

<style>
/* Tanpa GPU kartunya langsung berganti, sama seperti dengan gerakan dikurangi (calmMotion). */
[data-render='cpu'] .viewer-next-enter-active,
[data-render='cpu'] .viewer-next-leave-active,
[data-render='cpu'] .viewer-prev-enter-active,
[data-render='cpu'] .viewer-prev-leave-active {
  transition: none;
}
</style>
