<script setup lang="ts">
import { byId, contentLimits, letter, type LetterElement } from '@postpocket/presets'
import { PhotoError, preparePhoto } from '~/utils/front-image'
import { MESSAGE_LIMIT } from '~/utils/letter-draft'
import {
  moved,
  pinched,
  pointerAngle,
  scaled,
  snappedRotation,
  textSized,
} from '~/utils/letter-gesture'
import { describeElement, elementStyle } from '~/utils/letter-page'

/**
 * Editor isi surat layar penuh. Teks, foto, dan stiker disusun di halaman datar (bukan di dalam
 * kartu 3D) supaya posisi jari selalu tepat: geser untuk memindah, pegangan pojok untuk ukuran,
 * dan pegangan atas untuk memutar. Semua perubahan langsung tersimpan di draf.
 */
const emit = defineEmits<{ close: [] }>()
const draft = useLetterDraft()
const paper = computed(() => byId(letter.papers, draft.design.paper) ?? letter.papers[0]!)

const dialog = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const page = ref<HTMLElement | null>(null)
const textField = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const { width: stageWidth, height: stageHeight } = useElementSize(stage)
useScrollLock(document.body, true)

const pageStyle = computed(() => {
  const width = Math.max(
    120,
    Math.min(stageWidth.value - 32, (stageHeight.value - 32) * draft.ratio, 560),
  )
  return {
    width: `${width}px`,
    height: `${width / draft.ratio}px`,
    backgroundColor: paper.value.color,
    color: paper.value.textColor,
  }
})

const selectedId = ref<string | null>(null)
const selected = computed(() => draft.content.elements.find((e) => e.id === selectedId.value))
const stickersOpen = ref(false)
const busy = ref(false)
const error = ref('')

const counts = computed(() => {
  const total = { text: 0, photo: 0, sticker: 0 }
  for (const element of draft.content.elements) total[element.kind]++
  return total
})
const filledPhotos = computed(
  () => draft.content.elements.filter((e) => e.kind === 'photo' && e.photo).length,
)
const canAddPhoto = computed(
  () =>
    counts.value.photo < contentLimits.photo ||
    draft.content.elements.some((e) => e.kind === 'photo' && !e.photo),
)

const templateOptions = letter.templates.map((item) => ({ value: item.id, label: item.label }))
const template = computed({
  get: () => draft.design.template,
  set: (id: string) => draft.setTemplate(id),
})
const alignOptions = [
  { value: 'left', label: 'Kiri' },
  { value: 'center', label: 'Tengah' },
  { value: 'right', label: 'Kanan' },
]
const selectedText = computed({
  get: () => (selected.value?.kind === 'text' ? selected.value.text : ''),
  set: (text: string) => {
    if (selected.value) draft.updateElement(selected.value.id, { text })
  },
})
const selectedAlign = computed({
  get: () => (selected.value?.kind === 'text' ? selected.value.align : 'center'),
  set: (align: string) => {
    if (selected.value) draft.updateElement(selected.value.id, { align })
  },
})

function stickerLabel(element: LetterElement): string | undefined {
  return element.kind === 'sticker' ? byId(letter.stickers, element.sticker)?.label : undefined
}

function select(id: string | null) {
  selectedId.value = id
  if (id) stickersOpen.value = false
}

function focusText() {
  nextTick(() => textField.value?.focus())
}

// Gestur: satu penunjuk menggeser, memperbesar, atau memutar elemen yang dipilih.
interface Gesture {
  kind: 'move' | 'scale' | 'rotate'
  start: LetterElement
  x: number
  y: number
  cx: number
  cy: number
  distance: number
  angle: number
  moved: boolean
}
let gesture: Gesture | null = null

function begin(event: PointerEvent, element: LetterElement, kind: Gesture['kind']) {
  if (event.button !== 0) return
  const item = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-element]')
  if (!item) return
  event.preventDefault()
  select(element.id)
  // Kotak pembatas elemen yang diputar tetap berpusat di titik tengah elemen.
  const rect = item.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  gesture = {
    kind,
    start: { ...element },
    x: event.clientX,
    y: event.clientY,
    cx,
    cy,
    distance: Math.max(1, Math.hypot(event.clientX - cx, event.clientY - cy)),
    angle: pointerAngle(cx, cy, event.clientX, event.clientY),
    moved: false,
  }
}

// Cubit dua jari (HP): semua penunjuk di panggung dicatat. Begitu ada dua dan ada elemen terpilih,
// jarak, sudut, dan titik tengah keduanya mengubah ukuran, putaran, dan posisi elemen itu. Jari
// kedua boleh mendarat di luar elemen tanpa melepas pilihan.
interface Pinch {
  start: LetterElement
  distance: number
  angle: number
  x: number
  y: number
}
const pointers = new Map<number, { x: number; y: number }>()
let pinch: Pinch | null = null

function pinchNow() {
  const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }]
  return {
    distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
    angle: pointerAngle(a.x, a.y, b.x, b.y),
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  }
}

function onStagePointerDown(event: PointerEvent) {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  const element = draft.content.elements.find((e) => e.id === selectedId.value)
  if (pointers.size !== 2 || !element) return
  event.stopPropagation()
  event.preventDefault()
  gesture = null
  pinch = { start: { ...element }, ...pinchNow() }
}

function onPointerMove(event: PointerEvent) {
  if (pointers.has(event.pointerId)) {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  }
  if (pinch) {
    if (pointers.size < 2 || !page.value) return
    const now = pinchNow()
    const rect = page.value.getBoundingClientRect()
    draft.updateElement(
      pinch.start.id,
      pinched(pinch.start, {
        factor: now.distance / pinch.distance,
        turn: now.angle - pinch.angle,
        dx: (now.x - pinch.x) / rect.width,
        dy: (now.y - pinch.y) / rect.height,
      }),
    )
    return
  }
  if (!gesture || !page.value) return
  const dx = event.clientX - gesture.x
  const dy = event.clientY - gesture.y
  if (!gesture.moved && Math.hypot(dx, dy) < 4) return
  gesture.moved = true
  const { start } = gesture
  if (gesture.kind === 'move') {
    const rect = page.value.getBoundingClientRect()
    draft.updateElement(start.id, moved(start, dx / rect.width, dy / rect.height))
  } else if (gesture.kind === 'scale') {
    const distance = Math.hypot(event.clientX - gesture.cx, event.clientY - gesture.cy)
    draft.updateElement(start.id, scaled(start, distance / gesture.distance))
  } else {
    const angle = pointerAngle(gesture.cx, gesture.cy, event.clientX, event.clientY)
    draft.updateElement(start.id, {
      rotation: snappedRotation(start.rotation + angle - gesture.angle),
    })
  }
}

function onPointerEnd(event: PointerEvent) {
  pointers.delete(event.pointerId)
  if (pinch) {
    // Cubitan selesai begitu satu jari diangkat; jari yang tersisa tidak lanjut menggeser.
    pinch = null
    return
  }
  const done = gesture
  gesture = null
  if (!done || done.moved || done.kind !== 'move') return
  // Ketukan tanpa geser: slot foto kosong membuka pilihan foto, teks langsung bisa diketik.
  const element = draft.content.elements.find((e) => e.id === done.start.id)
  if (element?.kind === 'photo' && !element.photo) pickPhoto(element.id)
  else if (element?.kind === 'text') focusText()
}

useEventListener(window, 'pointermove', onPointerMove)
useEventListener(window, 'pointerup', onPointerEnd)
useEventListener(window, 'pointercancel', onPointerEnd)

const nudges: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

function onItemKeydown(event: KeyboardEvent, element: LetterElement) {
  const nudge = nudges[event.key]
  if (nudge) {
    event.preventDefault()
    const step = event.shiftKey ? 0.05 : 0.01
    select(element.id)
    draft.updateElement(element.id, moved(element, nudge[0] * step, nudge[1] * step))
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    remove(element.id)
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    select(element.id)
    if (element.kind === 'text') focusText()
    else if (element.kind === 'photo' && !element.photo) pickPhoto(element.id)
  }
}

/**
 * Panel alat elemen ikut hilang saat pilihan dilepas atau elemennya dihapus. Kalau fokus sedang
 * di sana, kembalikan ke elemen yang tadi dipilih atau ke dialog, supaya keyboard tetap di editor.
 */
function keepFocus(id?: string | null) {
  nextTick(() => {
    if (dialog.value?.contains(document.activeElement)) return
    const item = id ? page.value?.querySelector<HTMLElement>(`[data-id="${id}"]`) : null
    ;(item ?? dialog.value)?.focus()
  })
}

// Escape didengar di dokumen, jadi tetap bekerja walau fokus sempat lepas dari dialog.
useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  event.preventDefault()
  const id = selectedId.value
  if (!id) return emit('close')
  select(null)
  keepFocus(id)
})

function addText() {
  const id = draft.addText()
  if (!id) return
  select(id)
  focusText()
}

function addSticker(sticker: string) {
  const id = draft.addSticker(sticker)
  if (id) select(id)
  stickersOpen.value = false
}

function remove(id: string) {
  draft.removeElement(id)
  if (selectedId.value === id) select(null)
  keepFocus()
}

function resizeText(factor: number) {
  if (selected.value?.kind === 'text') {
    draft.updateElement(selected.value.id, textSized(selected.value, factor))
  }
}

let photoSlot: string | undefined
function pickPhoto(slotId?: string) {
  photoSlot = slotId
  fileInput.value?.click()
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  busy.value = true
  try {
    const id = draft.addPhoto(await preparePhoto(file), photoSlot)
    if (id) select(id)
    else error.value = `Maksimal ${contentLimits.photo} foto per surat.`
  } catch (problem) {
    error.value = problem instanceof PhotoError ? problem.message : 'Foto gagal diproses.'
  } finally {
    busy.value = false
    photoSlot = undefined
  }
}

function close() {
  select(null)
  emit('close')
}

onMounted(() => dialog.value?.focus())
</script>

<template>
  <div
    ref="dialog"
    class="fixed inset-0 z-50 flex flex-col bg-canvas outline-none"
    role="dialog"
    aria-modal="true"
    aria-labelledby="content-editor-title"
    tabindex="-1"
    data-testid="content-editor"
  >
    <header
      class="flex items-center gap-3 border-b border-line-soft bg-surface px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3"
    >
      <div class="min-w-0 flex-1">
        <h2 id="content-editor-title" class="text-[15px] font-semibold">Isi surat</h2>
        <p class="text-caption text-ink-muted">
          <span class="pointer-coarse:hidden">
            Geser untuk memindah, tarik pojok untuk ukuran, tarik titik atas untuk memutar.
          </span>
          <span class="hidden pointer-coarse:inline">
            Geser untuk memindah, cubit dua jari untuk ukuran dan putaran.
          </span>
        </p>
      </div>
      <button
        type="button"
        class="h-9 shrink-0 rounded-control bg-ink px-4 text-body font-semibold text-white hover:bg-ink/90"
        @click="close"
      >
        Selesai
      </button>
    </header>

    <div
      ref="stage"
      class="grid min-h-0 flex-1 touch-none place-items-center overflow-hidden p-4"
      @pointerdown.capture="onStagePointerDown"
      @pointerdown.self="select(null)"
    >
      <div
        ref="page"
        class="letter-surface"
        :style="pageStyle"
        data-testid="content-page"
        @pointerdown.self="select(null)"
      >
        <div class="letter-surface__grain" />
        <div
          v-for="element in draft.content.elements"
          :key="element.id"
          class="letter-editable"
          :class="{ 'is-selected': element.id === selectedId }"
          :style="elementStyle(element)"
          data-element
          :data-kind="element.kind"
          :data-id="element.id"
          role="button"
          tabindex="0"
          :aria-label="describeElement(element, stickerLabel(element))"
          :aria-pressed="element.id === selectedId"
          @pointerdown="begin($event, element, 'move')"
          @keydown="onItemKeydown($event, element)"
        >
          <LetterElementView
            :element="element"
            :photo-url="
              element.kind === 'photo' && element.photo ? draft.photoUrls[element.photo] : null
            "
            text-placeholder="Tulis sesuatu…"
            photo-placeholder="Tambah foto"
          />
          <template v-if="element.id === selectedId">
            <span
              class="handle handle--rotate"
              data-handle="rotate"
              aria-hidden="true"
              @pointerdown.stop="begin($event, element, 'rotate')"
            />
            <span
              class="handle handle--scale"
              data-handle="scale"
              aria-hidden="true"
              @pointerdown.stop="begin($event, element, 'scale')"
            />
          </template>
        </div>
      </div>
    </div>

    <footer
      class="border-t border-line-soft bg-surface px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]"
    >
      <div class="mx-auto max-w-xl space-y-3">
        <p
          v-if="error"
          role="alert"
          class="rounded-control bg-fill px-3 py-2 text-caption text-ink-muted"
        >
          {{ error }}
        </p>

        <div v-if="selected" class="space-y-3" data-testid="element-tools">
          <div class="flex items-center justify-between gap-2">
            <p class="text-caption font-medium text-ink-muted">
              {{ describeElement(selected, stickerLabel(selected)) }}
            </p>
            <IconButton label="Lepas pilihan" size="sm" variant="ghost" @click="select(null)">
              <Icon name="close" :size="15" />
            </IconButton>
          </div>
          <template v-if="selected.kind === 'text'">
            <textarea
              ref="textField"
              v-model="selectedText"
              :maxlength="MESSAGE_LIMIT"
              rows="2"
              aria-label="Teks yang dipilih"
              placeholder="Tulis sesuatu…"
              class="block w-full resize-none rounded-control bg-surface px-3.5 py-2.5 font-letter text-[19px] leading-snug inset-ring inset-ring-line placeholder:text-ink-subtle focus:outline-2 focus:outline-ink"
            />
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="tool"
                aria-label="Huruf lebih kecil"
                @click="resizeText(1 / 1.15)"
              >
                A−
              </button>
              <button
                type="button"
                class="tool"
                aria-label="Huruf lebih besar"
                @click="resizeText(1.15)"
              >
                A+
              </button>
              <PillGroup v-model="selectedAlign" label="Rata teks" :options="alignOptions" />
            </div>
          </template>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="selected.kind === 'photo'"
              type="button"
              class="tool"
              :disabled="busy"
              @click="pickPhoto(selected.id)"
            >
              <Icon name="upload" :size="15" /> {{ selected.photo ? 'Ganti foto' : 'Pilih foto' }}
            </button>
            <button type="button" class="tool" @click="draft.bringToFront(selected.id)">
              Ke depan
            </button>
            <button type="button" class="tool" @click="remove(selected.id)">Hapus</button>
          </div>
        </div>

        <template v-else>
          <PillGroup v-model="template" label="Template isi surat" :options="templateOptions" />
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="tool"
              :disabled="counts.text >= contentLimits.text"
              @click="addText"
            >
              <Icon name="plus" :size="15" /> Teks
            </button>
            <button
              type="button"
              class="tool"
              :disabled="!canAddPhoto || busy"
              @click="pickPhoto()"
            >
              <Icon name="camera" :size="15" />
              {{ busy ? 'Menyiapkan foto…' : 'Foto' }}
              <span class="text-ink-subtle">{{ filledPhotos }}/{{ contentLimits.photo }}</span>
            </button>
            <button
              type="button"
              class="tool"
              :aria-expanded="stickersOpen"
              :disabled="counts.sticker >= contentLimits.sticker"
              @click="stickersOpen = !stickersOpen"
            >
              <Icon name="plus" :size="15" /> Stiker
            </button>
          </div>
          <!-- Di HP dua baris yang digeser ke samping (setengah kolom berikutnya mengintip), supaya
               halaman surat di atasnya tidak tertutup; di layar lebar semua stiker kelihatan. -->
          <div
            v-if="stickersOpen"
            class="grid auto-cols-[calc((100%-1.25rem)/5.5)] grid-flow-col grid-rows-2 gap-1 overflow-x-auto overscroll-x-contain pb-1 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-9 sm:grid-rows-none sm:overflow-visible"
            role="group"
            aria-label="Pilih stiker"
          >
            <button
              v-for="item in letter.stickers"
              :key="item.id"
              type="button"
              class="aspect-square rounded-control p-1.5 hover:bg-fill"
              :aria-label="item.label"
              :title="item.label"
              @click="addSticker(item.id)"
            >
              <img :src="item.src" alt="" class="size-full" draggable="false" />
            </button>
          </div>
        </template>
      </div>
    </footer>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="sr-only"
      tabindex="-1"
      aria-label="Pilih foto isi surat"
      data-testid="content-photo-upload"
      @change="onFile"
    />
  </div>
</template>

<style scoped>
.letter-surface {
  position: relative;
  container-type: size;
  border-radius: 3px;
  box-shadow: var(--shadow-raised);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.letter-surface__grain {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-image: var(--texture-paper);
  background-size: 160px;
  opacity: 0.1;
  mix-blend-mode: multiply;
  pointer-events: none;
}

.letter-editable {
  position: absolute;
  cursor: grab;
  touch-action: none;
}

.letter-editable:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
}

.letter-editable.is-selected {
  z-index: 10;
  outline: 1.5px dashed currentColor;
  outline-offset: 3px;
}

.handle {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 1.5px solid var(--color-ink);
  border-radius: 999px;
  background-color: var(--color-white);
  box-shadow: 0 2px 6px rgb(17 17 20 / 0.25);
  touch-action: none;
}

/* Area sentuh lebih besar dari tampilannya. */
.handle::before {
  content: '';
  position: absolute;
  inset: -10px;
}

.handle--rotate {
  top: -38px;
  left: 50%;
  margin-left: -11px;
  cursor: grab;
}

.handle--rotate::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  width: 1.5px;
  height: 14px;
  margin-left: -0.75px;
  background-color: var(--color-ink);
}

.handle--scale {
  right: -14px;
  bottom: -14px;
  border-radius: 6px;
  cursor: nwse-resize;
}

.tool {
  display: inline-flex;
  height: 36px;
  align-items: center;
  gap: 6px;
  border-radius: var(--radius-control);
  padding: 0 14px;
  background-color: var(--color-surface);
  box-shadow: inset 0 0 0 1px var(--color-line);
  font-size: var(--text-body);
  font-weight: 600;
}

.tool:hover:not(:disabled) {
  background-color: var(--color-panel);
}

.tool:disabled {
  opacity: 0.45;
}
</style>
