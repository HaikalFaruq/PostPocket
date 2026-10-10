<script setup lang="ts">
import { byId, isFilledElement, letter } from '@postpocket/presets'
import { BottomSheet, SidePanel } from '#components'
import { PhotoError, preparePhoto } from '~/utils/front-image'
import { MESSAGE_LIMIT } from '~/utils/letter-draft'

useSeoMeta({ title: 'Buat surat · PostPocket', robots: 'noindex' })

const draft = useLetterDraft()
// Dibuka dari tombol "Bikin balasan" di halaman penerima: /letter/new?balas=<slug>.
const route = useRoute()
const router = useRouter()
onMounted(async () => {
  await draft.load()
  const reply = route.query.balas
  if (typeof reply === 'string') {
    draft.setReplyTo(reply)
    router.replace({ query: {} })
  }
})

const isDesktop = useMediaQuery('(min-width: 1024px)')
const open = ref(false)
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
  return [...(list ?? [])].find((file) => file.type.startsWith('image/'))
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

// Paste foto dari clipboard; teks biasa tetap masuk ke kolom isi surat.
useEventListener(document, 'paste', (event: ClipboardEvent) => {
  const file = imageFile(event.clipboardData?.files)
  if (!file) return
  event.preventDefault()
  takeFile(file)
})

const templateOptions = letter.templates.map((item) => ({ value: item.id, label: item.label }))
const template = computed({
  get: () => draft.design.template,
  set: (id: string) => draft.setTemplate(id),
})
const filled = computed(() => draft.content.elements.filter(isFilledElement))
const contentSummary = computed(() => {
  const photos = filled.value.filter((e) => e.kind === 'photo').length
  const stickers = filled.value.filter((e) => e.kind === 'sticker').length
  const parts = [photos && `${photos} foto`, stickers && `${stickers} stiker`].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Belum ada foto atau stiker.'
})

// "Buat link": dialog kirim memakai sampul yang sama untuk gambar OG.
const sending = ref(false)
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

function surpriseMe() {
  open.value = false
  draft.surpriseMe()
  card.value?.turnBy(360)
}

async function startOver() {
  if (!window.confirm('Mulai dari awal? Draf surat ini akan dihapus.')) return
  open.value = false
  error.value = ''
  await draft.reset()
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
        class="absolute top-4 left-4 z-10 inline-flex items-center gap-1 text-caption text-ink-muted hover:text-ink"
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
          <LetterPage :content="draft.content" :photo-urls="draft.photoUrls" />
          <p v-if="filled.length === 0" class="opacity-40">Tulis isi suratmu di langkah 5.</p>
        </template>
      </FoilCard>
      <p
        v-if="isDesktop"
        class="pointer-events-none absolute inset-x-0 bottom-6 text-center text-caption text-ink-subtle"
      >
        Tap kartu untuk membuka · geser untuk memutar
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
        <p class="text-caption text-ink-subtle">Tap kartu untuk membuka</p>
      </template>

      <div class="px-6 pt-6 pb-1">
        <h1 class="text-title font-semibold">Surat foil</h1>
        <p class="mt-1 text-ink-muted">
          Ubah gambar jadi kartu bercetak foil, tulis isinya, lalu kirim lewat link.
        </p>
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
          :photo-url="draft.photoUrl"
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
        <textarea
          v-model="draft.message"
          :maxlength="MESSAGE_LIMIT"
          rows="5"
          aria-label="Isi surat"
          placeholder="Tulis sesuatu untuk dia…"
          class="mt-4 block w-full resize-y rounded-control bg-surface px-3.5 py-3 font-letter text-[19px] leading-snug inset-ring inset-ring-line placeholder:text-ink-subtle focus:outline-2 focus:outline-ink"
        />
        <p class="mt-1 text-right text-caption text-ink-subtle">
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
        <StickyCTA :disabled="!draft.ready || maskBusy" @click="sending = true"
          >Buat link untuk dikirim</StickyCTA
        >
      </template>
    </component>

    <Teleport to="body">
      <LetterEditor v-if="editing" @close="closeEditor" />
      <SendLetter v-if="sending" :card="ogCard" @close="sending = false" />
    </Teleport>
  </div>
</template>
