<script setup lang="ts">
import { byId, isFilledElement, letter, templateForPhotos } from '@postpocket/presets'
import { BottomSheet, SidePanel } from '#components'
import { PhotoError, preparePhoto } from '~/utils/front-image'
import { looksLikeImage } from '~/utils/heic'
import { LetterApiError, errorMessage } from '~/utils/letter-api'
import { BOX_TEXT_LIMIT, INVITE_PATTERN, MESSAGE_LIMIT } from '~/utils/letter-draft'
import { takePendingPhoto, type PendingPhoto } from '~/utils/pending-photo'
import { listSent, stillOpen } from '~/utils/sent-letters'

useSeoMeta({ title: 'Buat surat · PostPocket', robots: 'noindex' })

const draft = useLetterDraft()
// Dibuka dari tombol "Bikin balasan" di halaman penerima: /letter/new?balas=<slug>.
const route = useRoute()
const router = useRouter()
onMounted(async () => {
  await draft.load()
  const reply = route.query.balas
  if (typeof reply === 'string') {
    router.replace({ query: {} })
    await startReply(reply)
  }
  // Dibuka dari halaman titip kotak bareng: /letter/new?titip=<kode>.
  const titip = route.query.titip
  if (typeof titip === 'string') {
    router.replace({ query: {} })
    await startTitip(titip)
  }
  // Foto dari "Kirim sebagai surat" (Pocket) atau "Pakai di surat" (Booth): /letter/new?foto=1.
  // Pilihan untuk draf yang belum dikirim sudah ditanyakan di sana; kalau belum, ditanya di sini.
  if (route.query.foto !== undefined) {
    router.replace({ query: {} })
    const pending = await takePendingPhoto()
    if (!pending) return
    const mode =
      pending.mode ??
      (draft.blank || draft.sent
        ? 'new'
        : await askDraftChoice({
            kind: 'photo',
            from: pending.from,
            draft: draft.summary,
            full: draft.photosFull,
          }))
    if (mode === 'new') await startWithPhoto(pending)
    else if (mode === 'add') await addToDraft(pending)
  }
})

/**
 * Mulai membalas surat `slug`. Draf yang belum dikirim tidak diam-diam jadi balasan, supaya
 * isinya tidak terkirim ke orang yang salah; kalau dibatalkan, kembali ke surat tadi.
 */
async function startReply(slug: string) {
  if (draft.replyTo === slug) return
  if (draft.blank || draft.sent) {
    if (draft.sent) await draft.reset()
    draft.setReplyTo(slug)
    return
  }
  const choice = await askDraftChoice({
    kind: 'reply',
    draft: draft.summary,
    replyingElsewhere: !!draft.replyTo,
  })
  if (choice === 'new') await draft.reset()
  if (choice) {
    draft.setReplyTo(slug)
    return
  }
  // router, bukan navigateTo(): kalau dibatalkan lewat Back, popstate-nya masih berjalan dan
  // navigateTo() akan diam-diam tidak memindahkan halaman.
  const letterPath = `/l/${encodeURIComponent(slug)}`
  if (window.history.state?.back === letterPath) router.back()
  else await router.replace(letterPath)
}

/**
 * Titip surat ini ke kotak bareng dengan kode `invite`. Seperti balasan, draf yang belum dikirim
 * tidak diam-diam ikut dititip; kalau dibatalkan, kembali ke halaman titip.
 */
async function startTitip(invite: string) {
  if (!INVITE_PATTERN.test(invite)) return
  // Draf untuk kotak yang sama: lanjutkan, kecuali sudah dititip, maka mulai surat baru.
  if (draft.box?.invite === invite) {
    if (draft.sent) await keepTitipThrough(() => draft.reset())
    return
  }
  let info
  try {
    info = await useBoxApi().invite(invite)
  } catch (problem) {
    if (problem instanceof LetterApiError && problem.code === 'network') {
      // Kode titipnya dikembalikan ke alamat halaman, supaya memuat ulang mencoba lagi.
      void router.replace({ query: { titip: invite } })
      notice.value =
        'Kotaknya belum bisa dimuat, jadi surat ini belum dititip. Muat ulang halaman ini setelah sinyal kembali.'
    } else notice.value = errorMessage(problem)
    return
  }
  if (info.closed) {
    notice.value = `Kotak "${info.title}" sudah ditutup, jadi tidak bisa menerima titipan lagi.`
    return
  }
  const target = { invite, title: info.title, to: info.to }
  if (draft.blank || draft.sent) {
    if (draft.sent) await draft.reset()
    draft.setBox(target)
    return
  }
  const choice = await askDraftChoice({ kind: 'titip', draft: draft.summary, box: info.title })
  if (choice === 'new') await draft.reset()
  if (choice) {
    draft.setBox(target)
    return
  }
  const titipPath = `/titip/${encodeURIComponent(invite)}`
  if (window.history.state?.back === titipPath) router.back()
  else await router.replace(titipPath)
}

const notice = ref('')

/**
 * Jalankan `reset` sambil mempertahankan kotak tujuan dan nama pengirim, misalnya saat mulai
 * dari awal atau menulis surat berikutnya untuk kotak yang sama.
 */
async function keepTitipThrough(reset: () => Promise<void>) {
  const titipTo = draft.box ? { box: draft.box, from: draft.from } : null
  await reset()
  if (titipTo) {
    draft.setBox(titipTo.box)
    draft.from = titipTo.from
  }
}

/**
 * Surat baru berisi foto ini di template "1 foto + teks", lalu kartunya dibuka. Bingkainya
 * mengikuti bentuk foto (`addPhoto`), jadi strip Booth dan foto tegak tampil utuh. Kotak tujuan
 * titipan dan nama pengirimnya tetap, karena fotonya diambil untuk surat titipan itu.
 */
async function startWithPhoto(pending: PendingPhoto) {
  // Foto untuk surat titipan yang belum dikirim tetap ke kotak itu. Kalau titipannya sudah
  // dikirim, surat berfoto ini surat baru yang tidak otomatis ke kotak lama.
  if (draft.box && !draft.sent) await keepTitipThrough(() => draft.reset())
  else await draft.reset()
  draft.setTemplate('photo-1')
  draft.addPhoto(pending.photo)
  await draft.save()
  notice.value = draft.box
    ? `Foto dari ${pending.from} sudah ada di isi surat. Tulis pesanmu, lalu titip ke kotak.`
    : `Foto dari ${pending.from} sudah ada di isi surat. Tulis pesanmu, lalu buat link.`
  open.value = true
}

/**
 * Tambahkan foto ke draf. Kalau slot template-nya tidak cukup, tata letaknya diganti ke template
 * dengan slot sebanyak fotonya, supaya foto baru tidak menumpuk di atas foto lama. Bingkai foto
 * di slot mengikuti bentuk fotonya, dan stiker yang jadi menutupi isi dipindah (`setTemplate`).
 */
async function addToDraft(pending: PendingPhoto) {
  const id = draft.addPhoto(pending.photo)
  if (!id) {
    notice.value =
      'Isi surat ini sudah berisi 4 foto. Hapus satu dulu lewat "Atur foto dan stiker".'
    return
  }
  const count = draft.content.elements.filter((e) => e.kind === 'photo' && e.photo).length
  const current = byId(letter.templates, draft.design.template)
  const next =
    current && current.photos >= count ? null : templateForPhotos(letter.templates, count)
  if (next) draft.setTemplate(next.id)
  await draft.save()
  notice.value = next
    ? `Foto dari ${pending.from} ditambahkan. Tata letaknya diganti ke "${next.label}" supaya fotonya tidak bertumpuk.`
    : `Foto dari ${pending.from} ditambahkan ke isi surat.`
  open.value = true
}

const isDesktop = useMediaQuery('(min-width: 1024px)')
const open = ref(false)
const cardHint = computed(() =>
  open.value ? 'Ketuk kartu untuk menutup' : 'Ketuk kartu untuk membuka',
)
const expanded = ref(true)
const card = ref<{ turnBy: (degrees: number) => void } | null>(null)
const busy = ref(false)
const error = ref('')

const { foil, paper, art, mask, maskBusy } = useCardFront(
  computed(() => draft.design),
  computed(() => (draft.isPhotoFront ? draft.photoUrl : null)),
)
const mode = computed(() => byId(letter.foilModes, draft.design.foilMode) ?? letter.foilModes[0]!)

const ratio = computed(() => draft.ratio)

const front = computed({
  get: () => draft.design.illustration,
  set: (id: string) => draft.selectFront(id),
})

const shapeOptions = letter.shapes.map((shape) => ({ value: shape.id, label: shape.label }))
const shape = computed(() => byId(letter.shapes, draft.design.shape) ?? letter.shapes[0]!)
const photoRatio = computed(() =>
  draft.photo ? draft.photo.width / draft.photo.height : undefined,
)
const paperOptions = letter.papers.map((item) => ({
  value: item.id,
  label: item.label,
  color: item.color,
}))
const modeOptions = computed(() =>
  letter.foilModes.map((item) => ({
    value: item.id,
    label: item.label,
    // Foto user tidak punya lapisan foil bawaan.
    disabled: draft.isPhotoFront && item.id === 'design',
  })),
)

const panelProps = computed(() =>
  isDesktop.value
    ? { label: 'Opsi surat' }
    : {
        label: 'Opsi surat',
        expanded: expanded.value,
        'onUpdate:expanded': (value: boolean) => (expanded.value = value),
      },
)

async function takeFile(file: File) {
  error.value = ''
  busy.value = true
  try {
    draft.setPhoto(await preparePhoto(file))
    open.value = false
  } catch (problem) {
    error.value = problem instanceof PhotoError ? problem.message : 'Foto gagal diproses.'
  } finally {
    busy.value = false
  }
}

function imageFile(list: FileList | null | undefined): File | undefined {
  return [...(list ?? [])].find(looksLikeImage)
}

// Drop di mana saja di halaman.
const dragging = ref(false)
let dragDepth = 0
function onDragEnter(event: DragEvent) {
  if (![...(event.dataTransfer?.items ?? [])].some((item) => item.kind === 'file')) return
  dragDepth++
  dragging.value = true
}
function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}
function onDrop(event: DragEvent) {
  dragDepth = 0
  dragging.value = false
  const file = imageFile(event.dataTransfer?.files)
  if (file) takeFile(file)
}

// Paste foto dari clipboard; teks biasa tetap masuk ke kolom isi surat. Selama editor isi surat
// terbuka, foto yang ditempel tidak mengganti gambar depan diam-diam.
useEventListener(document, 'paste', (event: ClipboardEvent) => {
  const file = imageFile(event.clipboardData?.files)
  if (!file || editing.value) return
  event.preventDefault()
  takeFile(file)
})

const templateOptions = letter.templates.map((item) => ({ value: item.id, label: item.label }))
const template = computed({
  get: () => draft.design.template,
  set: (id: string) => draft.setTemplate(id),
})
const filled = computed(() => draft.content.elements.filter(isFilledElement))
const hasTextSlot = computed(() => draft.content.elements.some((e) => e.kind === 'text'))
const contentSummary = computed(() => {
  const photos = filled.value.filter((e) => e.kind === 'photo').length
  const stickers = filled.value.filter((e) => e.kind === 'sticker').length
  const parts = [photos && `${photos} foto`, stickers && `${stickers} stiker`].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Belum ada foto atau stiker.'
})

// "Buat link": dialog kirim memakai sampul yang sama untuk gambar OG. Draf yang sudah jadi link
// cukup menampilkan link-nya lagi, dan surat kosong tidak bisa dikirim.
const sending = ref(false)
const emptyWarning = ref(false)
const messageField = ref<HTMLTextAreaElement | null>(null)
watch(
  () => filled.value.length,
  (count) => {
    if (count) emptyWarning.value = false
  },
)

// Surat titipan butuh nama pengirim, supaya penerima tahu surat itu dari siapa.
const fromField = ref<HTMLInputElement | null>(null)
const fromWarning = ref(false)
watch(
  () => draft.from,
  (name) => {
    if (name.trim()) fromWarning.value = false
  },
)

function startSending() {
  if (draft.sent) {
    sending.value = true
    return
  }
  if (draft.box && !draft.from.trim()) {
    fromWarning.value = true
    expanded.value = true
    nextTick(() => fromField.value?.focus())
    return
  }
  if (!filled.value.length) {
    emptyWarning.value = true
    expanded.value = true
    nextTick(() => messageField.value?.focus())
    return
  }
  sending.value = true
}

// Surat yang pernah dibuat linknya di sini, supaya link lama tetap bisa disalin atau dihapus.
const sentCount = ref(0)
const showSent = ref(false)
async function refreshSent() {
  sentCount.value = (await listSent()).filter((item) => stillOpen(item)).length
}
onMounted(refreshSent)
watch(() => draft.sent, refreshSent)

const sentUntil = computed(() =>
  draft.sent
    ? new Date(draft.sent.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })
    : '',
)

async function newLetter() {
  open.value = false
  const titip = draft.box
  // Surat berikutnya tetap untuk kotak yang sama; "Batal titip" kalau mau jadi link biasa.
  await keepTitipThrough(() => draft.reset())
  notice.value = titip
    ? `Suratmu tadi tetap di kotak "${titip.title}". Surat baru ini juga untuk kotak itu.`
    : 'Surat tadi tetap bisa dibuka. Link-nya ada di "Surat terkirim".'
  void refreshSent()
}
const ogCard = computed(() => ({
  art: art.value,
  foilMask: mask.value,
  foil: foil.value,
  paper: paper.value,
  ratio: ratio.value,
  foilBorder: draft.design.foilBorder,
}))

// Editor isi surat layar penuh. Setelah ditutup, kartu dibuka supaya hasilnya langsung terlihat.
const editing = ref(false)
const editorButton = ref<HTMLButtonElement | null>(null)
function closeEditor() {
  editing.value = false
  open.value = true
  nextTick(() => editorButton.value?.focus())
}
// Back di HP menutup editor isi surat, bukan meninggalkan halaman.
useBackToClose(editing, closeEditor)

function surpriseMe() {
  open.value = false
  draft.surpriseMe()
  card.value?.turnBy(360)
}

async function startOver() {
  if (!window.confirm('Mulai dari awal? Draf surat ini akan dihapus.')) return
  open.value = false
  error.value = ''
  // Kotak tujuan titipan tetap; yang dihapus hanya isi draf.
  await keepTitipThrough(() => draft.reset())
}
</script>

<template>
  <div
    class="flex h-dvh flex-col bg-surface lg:flex-row"
    data-testid="letter-editor"
    :data-front="draft.design.illustration"
    :data-paper="draft.design.paper"
    :data-foil="draft.design.foilColor"
    :data-mode="draft.design.foilMode"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <main class="relative min-h-0 flex-1">
      <NuxtLink
        to="/"
        class="absolute top-2 left-3 z-10 inline-flex min-h-11 items-center gap-1 px-1 text-body text-ink-muted hover:text-ink"
      >
        <Icon name="chevron-left" :size="14" /> PostPocket
      </NuxtLink>
      <FoilCard
        v-if="draft.ready"
        ref="card"
        v-model:open="open"
        :art="art"
        :foil-mask="mask"
        :foil="foil"
        :paper="paper"
        :ratio="ratio"
        :foil-border="draft.design.foilBorder"
      >
        <template #inside>
          <!-- Petunjuknya ditulis di slot teks, jadi tidak menimpa slot foto di atasnya. -->
          <LetterPage
            :content="draft.content"
            :photo-urls="draft.photoUrls"
            text-placeholder="Tulis isi suratmu di langkah 5."
          />
          <p v-if="!hasTextSlot && filled.length === 0" class="opacity-40">
            Tulis isi suratmu di langkah 5.
          </p>
        </template>
      </FoilCard>
      <p
        v-if="isDesktop"
        class="pointer-events-none absolute inset-x-0 bottom-6 text-center text-caption text-ink-muted"
      >
        {{ cardHint }}, geser untuk memutar
      </p>
      <div
        v-if="dragging"
        class="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-card border-2 border-dashed border-line bg-surface/85 text-body font-semibold"
      >
        Lepaskan foto di sini
      </div>
    </main>

    <component :is="isDesktop ? SidePanel : BottomSheet" v-bind="panelProps">
      <template #peek>
        <p class="text-caption text-ink-muted" data-testid="card-hint">{{ cardHint }}</p>
      </template>

      <div class="px-6 pt-6 pb-1">
        <h1 class="text-title">Surat foil</h1>
        <p class="mt-1 text-ink-muted">
          Ubah gambar jadi kartu bercetak foil, tulis isinya, lalu
          {{ draft.box ? 'titip ke kotak' : 'kirim lewat link' }}.
        </p>
        <button
          v-if="sentCount"
          type="button"
          class="mt-2 text-caption font-semibold underline underline-offset-2"
          data-testid="open-sent-letters"
          @click="showSent = true"
        >
          Surat terkirim ({{ sentCount }})
        </button>
        <div
          v-if="draft.box"
          class="mt-3 rounded-control bg-fill px-3 py-2.5 text-caption"
          data-testid="titip-banner"
        >
          <p class="font-semibold text-ink">Untuk kotak "{{ draft.box.title }}"</p>
          <p class="mt-0.5 text-ink-muted">
            Suratmu masuk ke kotak bareng untuk {{ draft.box.to }}, bukan jadi link sendiri. Isinya
            rahasia sampai kotaknya dibuka.
          </p>
          <label for="titip-from" class="mt-2.5 block font-semibold text-ink">Nama kamu</label>
          <input
            id="titip-from"
            ref="fromField"
            v-model="draft.from"
            :maxlength="BOX_TEXT_LIMIT"
            autocomplete="nickname"
            :placeholder="`Biar ${draft.box.to} tahu ini dari siapa`"
            :aria-invalid="fromWarning || undefined"
            aria-describedby="titip-from-hint"
            class="mt-1 h-10 w-full rounded-control bg-surface px-3 text-body inset-ring inset-ring-line placeholder:text-ink-subtle focus:outline-2 focus:outline-ink"
            data-testid="titip-from"
          />
          <p
            id="titip-from-hint"
            :role="fromWarning ? 'alert' : undefined"
            class="mt-1"
            :class="fromWarning ? 'font-semibold text-[#7a5a14]' : 'text-ink-muted'"
          >
            {{
              fromWarning
                ? 'Tulis namamu dulu, ya.'
                : 'Ditulis di balik sampul kartu dan di daftar titipan.'
            }}
          </p>
          <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <NuxtLink
              to="/tv?booth=1"
              class="font-medium underline underline-offset-2"
              data-testid="titip-booth"
              >Ambil foto di Booth</NuxtLink
            >
            <button
              type="button"
              class="font-medium underline underline-offset-2"
              @click="draft.setBox(null)"
            >
              Batal titip
            </button>
          </div>
        </div>
        <div
          v-if="draft.replyTo"
          class="mt-3 flex items-center justify-between gap-3 rounded-control bg-fill px-3 py-2 text-caption"
          data-testid="reply-banner"
        >
          <span>Membalas surat yang kamu terima.</span>
          <button
            type="button"
            class="font-medium underline underline-offset-2"
            @click="draft.setReplyTo(null)"
          >
            Batal membalas
          </button>
        </div>
        <p
          v-if="notice"
          role="status"
          class="mt-3 flex items-start justify-between gap-3 rounded-control bg-fill px-3 py-2 text-caption"
          data-testid="letter-notice"
        >
          <span>{{ notice }}</span>
          <button
            type="button"
            class="shrink-0 font-medium underline underline-offset-2"
            @click="notice = ''"
          >
            Oke
          </button>
        </p>
        <div
          v-if="draft.sent"
          class="mt-3 rounded-control bg-fill px-3 py-2.5 text-caption"
          data-testid="sent-banner"
        >
          <template v-if="draft.sent.box">
            <p class="font-semibold text-ink">Surat ini sudah masuk kotak.</p>
            <p class="mt-0.5 text-ink-muted">
              Kalau kamu mengubahnya, nanti dititip sebagai surat baru.
            </p>
          </template>
          <template v-else>
            <p class="font-semibold text-ink">Surat ini sudah jadi link.</p>
            <p class="mt-0.5 text-ink-muted">
              Bisa dibuka sampai {{ sentUntil }}. Kalau kamu mengubahnya, nanti dibuat link baru.
            </p>
          </template>
          <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <button
              type="button"
              class="font-semibold underline underline-offset-2"
              @click="sending = true"
            >
              {{ draft.sent.box ? 'Lihat titipanmu' : 'Lihat link' }}
            </button>
            <button
              type="button"
              class="font-semibold underline underline-offset-2"
              @click="newLetter"
            >
              Bikin surat baru
            </button>
          </div>
        </div>
        <p
          v-if="draft.saveFailed"
          role="alert"
          class="mt-3 rounded-control bg-[#fbefd2] px-3 py-2 text-caption text-[#7a5a14]"
        >
          Draf tidak bisa disimpan di browser ini, jadi akan hilang kalau halaman ditutup.
        </p>
      </div>

      <StepCard :step="1" title="Gambar depan">
        <FrontPicker
          v-model="front"
          :foil="foil"
          :paper="paper"
          :shape="shape"
          :photo-url="draft.photoUrl"
          :photo-ratio="photoRatio"
          :busy="busy"
          :error="error"
          @file="takeFile"
        />
        <p class="mt-4 mb-2 text-caption text-ink-muted">Bentuk</p>
        <PillGroup v-model="draft.design.shape" label="Bentuk kartu" :options="shapeOptions" />
      </StepCard>

      <StepCard :step="2" title="Bagian yang jadi foil">
        <template #action>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-caption font-medium underline underline-offset-2"
            data-testid="surprise"
            @click="surpriseMe"
          >
            <Icon name="shuffle" :size="13" /> Surprise me
          </button>
        </template>
        <PillGroup
          v-model="draft.design.foilMode"
          label="Bagian yang jadi foil"
          :options="modeOptions"
        />
        <p class="mt-2 text-caption text-ink-muted">
          {{ mode.hint }}
          <span v-if="maskBusy" class="text-ink-subtle">Menyiapkan foil…</span>
        </p>
        <label class="mt-3 flex items-center gap-2 text-body">
          <input v-model="draft.design.foilBorder" type="checkbox" class="size-4 accent-ink" />
          Bingkai foil di tepi
        </label>
      </StepCard>

      <StepCard :step="3" title="Warna foil" :hint="foil.label">
        <SwatchGroup v-model="draft.design.foilColor" label="Warna foil" size="lg">
          <Swatch
            v-for="item in letter.foilColors"
            :key="item.id"
            :value="item.id"
            :label="item.label"
            size="lg"
          >
            <FoilSwatchIcon :foil="item" />
          </Swatch>
        </SwatchGroup>
      </StepCard>

      <StepCard
        :step="4"
        title="Kertas"
        :hint="paper.label"
        description="Satu kertas untuk depan, dalam, dan belakang kartu."
      >
        <SwatchGroup v-model="draft.design.paper" label="Kertas" :options="paperOptions" />
      </StepCard>

      <StepCard :step="5" title="Isi surat">
        <PillGroup v-model="template" label="Template isi surat" :options="templateOptions" />
        <p
          v-if="emptyWarning"
          role="alert"
          class="mt-3 rounded-control bg-[#fbefd2] px-3 py-2 text-caption text-[#7a5a14]"
        >
          Isi suratnya masih kosong. Tulis sesuatu dulu, yuk.
        </p>
        <textarea
          ref="messageField"
          v-model="draft.message"
          :maxlength="MESSAGE_LIMIT"
          rows="5"
          aria-label="Isi surat"
          placeholder="Tulis sesuatu untuk dia…"
          class="mt-4 block w-full resize-y rounded-control bg-surface px-3.5 py-3 font-letter text-[19px] leading-snug inset-ring inset-ring-line placeholder:text-ink-subtle focus:outline-2 focus:outline-ink"
        />
        <p class="mt-1 text-right text-caption text-ink-muted">
          {{ draft.message.length }}/{{ MESSAGE_LIMIT }}
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            ref="editorButton"
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-control bg-surface px-3.5 text-body font-semibold inset-ring inset-ring-line hover:bg-panel"
            data-testid="open-content-editor"
            @click="editing = true"
          >
            <Icon name="plus" :size="15" /> Atur foto dan stiker
          </button>
          <p class="min-w-0 flex-1 text-caption text-ink-muted">{{ contentSummary }}</p>
        </div>
      </StepCard>

      <div class="px-6 pt-1 pb-6">
        <button
          type="button"
          class="text-caption text-ink-muted underline underline-offset-2 hover:text-ink"
          @click="startOver"
        >
          Mulai dari awal
        </button>
      </div>

      <template #footer>
        <StickyCTA :disabled="!draft.ready || maskBusy" @click="startSending">{{
          draft.box
            ? draft.sent
              ? 'Lihat titipanmu'
              : 'Titip ke kotak'
            : draft.sent
              ? 'Lihat link surat'
              : 'Buat link untuk dikirim'
        }}</StickyCTA>
      </template>
    </component>

    <Teleport to="body">
      <LetterEditor v-if="editing" @close="closeEditor" />
      <SendLetter v-if="sending" :card="ogCard" :existing="draft.sent" @close="sending = false" />
      <SentLetters v-model:open="showSent" @changed="refreshSent" />
    </Teleport>
  </div>
</template>
