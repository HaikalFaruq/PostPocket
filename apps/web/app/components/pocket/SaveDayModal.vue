<script setup lang="ts">
import { byId, letter, pocket } from '@postpocket/presets'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { longDate } from '~/utils/calendar'
import { photoTime } from '~/utils/exif'
import { PhotoError, preparePhoto } from '~/utils/front-image'
import type { DraftPhoto } from '~/utils/letter-draft'
import type { PocketDay } from '~/utils/memories'

/**
 * Modal "Simpan satu hari kecil" (PRD Pocket, mengikuti Day Pocket): empat kartu bernomor untuk
 * warna kantong, stiker, bingkai foto, dan foto hari itu. Preview kantong di kiri berubah langsung.
 * Dipakai juga untuk mengganti desain kantong yang sudah ada: foto lama bisa dikeluarkan dan
 * kantongnya bisa dihapus. Semua perubahan baru tersimpan setelah "Simpan".
 */
const props = defineProps<{ day: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [day: PocketDay]; deleted: [] }>()
const memories = useMemories()

const existing = computed(() => memories.data.days[props.day])
const packet = ref(pocket.packetColors[0]!.id)
const sticker = ref(letter.stickers[0]!.id)
const frame = ref(pocket.frames[0]!.id)
const frameColor = ref(pocket.frameColors[0]!.id)
const customColor = ref('#c8a2c8')
const added = shallowRef<{ photo: DraftPhoto; url: string; takenAt?: string }[]>([])
/** Foto lama yang dikeluarkan; baru benar-benar dihapus setelah "Simpan". */
const removed = ref<Set<string>>(new Set())
const keptUrls = ref<Record<string, string | null>>({})
const busy = ref(false)
const preparing = ref(false)
const error = ref('')
/** "Hapus kantong" sedang ditanyakan di footer. */
const confirmDelete = ref(false)

const kept = computed(() => (existing.value?.moments ?? []).filter((id) => !removed.value.has(id)))
const photoCount = computed(() => kept.value.length + added.value.length)
const dirty = computed(() => added.value.length > 0 || removed.value.size > 0)
const saveLabel = computed(() => {
  if (existing.value) return 'Simpan perubahan'
  return photoCount.value ? 'Simpan kantong' : 'Simpan tanpa foto'
})

// Isi ulang pilihan setiap modal dibuka: dari kantong yang sudah ada, atau bawaan.
watch(open, async (isOpen) => {
  if (!isOpen) return
  const day = existing.value
  packet.value = day?.packet ?? pocket.packetColors[0]!.id
  sticker.value = day?.sticker ?? letter.stickers[0]!.id
  frame.value = day?.frame ?? pocket.frames[0]!.id
  if (day?.frameColor.startsWith('#')) {
    customColor.value = day.frameColor
    frameColor.value = 'custom'
  } else frameColor.value = day?.frameColor ?? pocket.frameColors[0]!.id
  clearAdded()
  removed.value = new Set()
  confirmDelete.value = false
  error.value = ''
  const urls: Record<string, string | null> = {}
  for (const id of day?.moments ?? []) urls[id] = await memories.photoUrl(id)
  keptUrls.value = urls
})

const packetColor = computed(
  () => byId(pocket.packetColors, packet.value) ?? pocket.packetColors[0]!,
)
const stickerItem = computed(() => byId(letter.stickers, sticker.value))
type FrameVariant = 'polaroid' | 'stamp' | 'ticket'
const frameVariant = computed(() => frame.value as FrameVariant)
const frameHex = computed(() =>
  frameColor.value === 'custom'
    ? customColor.value
    : (byId(pocket.frameColors, frameColor.value)?.color ?? '#fbf6ec'),
)
const comboName = computed(
  () =>
    // Seperti tulisan di kemasan jajan: rasa kantong dan stikernya.
    `Rasa ${packetColor.value.flavor.toLowerCase()}, stiker ${(stickerItem.value?.label ?? '').toLowerCase()}`,
)
const previewPhoto = computed(
  () => added.value[0]?.url ?? keptUrls.value[kept.value[0] ?? ''] ?? null,
)

const packetOptions = pocket.packetColors.map((item) => ({
  value: item.id,
  label: item.label,
  color: item.color,
}))
const frameOptions = pocket.frames.map((item) => ({ ...item, variant: item.id as FrameVariant }))
const frameColorOptions = pocket.frameColors.map((item) => ({
  value: item.id,
  label: item.label,
  color: item.color,
}))

const fileInput = ref<HTMLInputElement | null>(null)

/** Foto dikompres ke 2048 px sebelum disimpan; tanggalnya diambil dari EXIF bila ada (PRD). */
async function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length) return
  busy.value = true
  preparing.value = true
  error.value = ''
  const next = [...added.value]
  for (const file of files) {
    try {
      const takenAt = await photoTime(file)
      const photo = await preparePhoto(file)
      next.push({ photo, url: URL.createObjectURL(photo.blob), takenAt })
    } catch (problem) {
      error.value = problem instanceof PhotoError ? problem.message : 'Ada foto yang gagal dibaca.'
    }
  }
  added.value = next
  busy.value = false
  preparing.value = false
}

function removeAdded(index: number) {
  const item = added.value[index]
  if (item) URL.revokeObjectURL(item.url)
  added.value = added.value.filter((_, i) => i !== index)
}

function removeKept(id: string) {
  removed.value = new Set([...removed.value, id])
}

function restoreKept(id: string) {
  removed.value = new Set([...removed.value].filter((item) => item !== id))
}

function clearAdded() {
  for (const item of added.value) URL.revokeObjectURL(item.url)
  added.value = []
}

async function save() {
  busy.value = true
  try {
    const ids = added.value.length
      ? await memories.addMoments(
          added.value.map(({ photo, takenAt }) => ({ photo, takenAt })),
          { day: props.day, source: 'upload' },
        )
      : []
    const day: PocketDay = {
      day: props.day,
      packet: packet.value,
      sticker: sticker.value,
      frame: frame.value,
      frameColor: frameColor.value === 'custom' ? customColor.value : frameColor.value,
      moments: [...kept.value, ...ids],
      savedAt: existing.value?.savedAt ?? new Date().toISOString(),
    }
    await memories.saveDay(day)
    if (removed.value.size) await memories.deleteMoments([...removed.value])
    clearAdded()
    removed.value = new Set()
    open.value = false
    emit('saved', day)
  } catch {
    error.value = 'Gagal menyimpan di perangkat ini. Coba lagi.'
  } finally {
    busy.value = false
  }
}

/** Hapus kantong beserta fotonya. Ditanyakan dulu di footer modal. */
const deleteQuestion = computed(() => {
  const count = existing.value?.moments.length ?? 0
  return count ? `Hapus kantong ini beserta ${count} fotonya?` : 'Hapus kantong ini?'
})

async function removePocket() {
  busy.value = true
  try {
    await memories.deleteDay(props.day)
    clearAdded()
    removed.value = new Set()
    confirmDelete.value = false
    open.value = false
    emit('deleted')
  } catch {
    error.value = 'Gagal menghapus di perangkat ini. Coba lagi.'
  } finally {
    busy.value = false
  }
}

/** Perubahan foto yang belum disimpan tidak dibuang tanpa bertanya. */
function setOpen(next: boolean) {
  if (!next && dirty.value && !busy.value) {
    if (!window.confirm('Perubahan fotomu belum disimpan. Tetap tutup?')) return
    clearAdded()
    removed.value = new Set()
  }
  open.value = next
}

// Back di HP menutup modal dengan pertanyaan yang sama, bukan meninggalkan Pocket.
useBackToClose(open, () => {
  setOpen(false)
  return !open.value
})

onBeforeUnmount(clearAdded)
</script>

<template>
  <Modal
    :open="open"
    tone="pocket"
    :title="existing ? 'Ganti desain kantong' : 'Simpan satu hari kecil'"
    :description="longDate(day)"
    @update:open="setOpen"
  >
    <template #preview>
      <!-- Di HP nama kombinasi ada di bawah kantong; di layar lebar di pojok kiri bawah. -->
      <div
        class="flex h-full flex-col items-center justify-center gap-5"
        data-testid="packet-preview"
      >
        <div class="w-[min(52%,290px)] pt-6 md:w-[min(56%,300px)]">
          <SnackPacket
            :color="packetColor.color"
            :sticker="stickerItem"
            :frame="frameVariant"
            :frame-color="frameHex"
            :photo-url="previewPhoto"
          />
        </div>
        <p
          class="text-caption font-medium text-pocket-muted md:absolute md:bottom-5 md:left-6"
          data-testid="combo-name"
        >
          {{ comboName }}
        </p>
        <!-- Di HP langkah foto ada jauh di bawah; tombol ini menghemat gulirnya. -->
        <button
          type="button"
          class="-mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-body font-semibold shadow-[inset_0_0_0_1px_var(--color-line)] md:hidden"
          :disabled="busy"
          @click="fileInput?.click()"
        >
          <Icon name="plus" :size="15" />
          {{ photoCount ? `Tambah foto (${photoCount})` : 'Tambah foto' }}
        </button>
      </div>
    </template>

    <StepCard
      :step="1"
      title="Warna kantong"
      :hint="packetColor.label"
      description="Bungkus kecil untuk hari ini"
      variant="card"
    >
      <SwatchGroup
        v-model="packet"
        label="Warna kantong"
        :options="packetOptions"
        size="md"
        check
      />
    </StepCard>

    <StepCard
      :step="2"
      title="Stiker"
      :hint="stickerItem?.label"
      description="Satu sentuhan terakhir di depan kantong"
      variant="card"
    >
      <RadioGroupRoot
        v-model="sticker"
        aria-label="Stiker"
        orientation="horizontal"
        loop
        class="grid grid-cols-6 gap-1.5 sm:grid-cols-7"
      >
        <RadioGroupItem
          v-for="item in letter.stickers"
          :key="item.id"
          :value="item.id"
          :aria-label="item.label"
          :title="item.label"
          class="sticker-option aspect-square rounded-[12px] p-1.5"
        >
          <img :src="item.src" alt="" class="size-full" draggable="false" />
        </RadioGroupItem>
      </RadioGroupRoot>
    </StepCard>

    <StepCard
      :step="3"
      title="Bingkai foto"
      description="Cara tiap foto dicetak saat kantong dibuka"
      variant="card"
    >
      <RadioGroupRoot
        v-model="frame"
        aria-label="Bingkai foto"
        orientation="horizontal"
        loop
        class="grid grid-cols-3 gap-2"
      >
        <RadioGroupItem
          v-for="item in frameOptions"
          :key="item.id"
          :value="item.id"
          class="frame-option flex flex-col items-center gap-1 rounded-[14px] px-2 pt-3 pb-2.5 text-center"
        >
          <span
            class="frame-option__art grid h-[74px] w-full place-items-center"
            aria-hidden="true"
          >
            <PhotoFrame
              :variant="item.variant"
              :color="frameHex"
              :src="previewPhoto ?? undefined"
              :class="item.id === 'ticket' ? 'w-[78%]' : 'w-[46%]'"
            >
              <span />
            </PhotoFrame>
          </span>
          <span class="text-[13px] leading-tight font-bold">{{ item.label }}</span>
          <span class="text-[11px] leading-snug text-ink-muted">{{ item.hint }}</span>
        </RadioGroupItem>
      </RadioGroupRoot>

      <p class="mt-4 mb-2 text-[13px] font-semibold">
        Warna bingkai
        <span class="ml-1 font-normal text-ink-muted">
          {{
            frameColor === 'custom' ? 'Warna sendiri' : byId(pocket.frameColors, frameColor)?.label
          }}
        </span>
      </p>
      <div class="flex flex-wrap items-center gap-2.5">
        <SwatchGroup v-model="frameColor" label="Warna bingkai" :options="frameColorOptions" check>
          <Swatch
            v-for="item in frameColorOptions"
            :key="item.value"
            :value="item.value"
            :label="item.label"
            :color="item.color"
            check
          />
          <Swatch value="custom" label="Warna sendiri" check>
            <span class="custom-swatch" :style="{ '--custom': customColor }" aria-hidden="true" />
          </Swatch>
        </SwatchGroup>
        <label
          v-if="frameColor === 'custom'"
          class="inline-flex items-center gap-2 text-caption text-ink-muted"
        >
          Pilih warna
          <input v-model="customColor" type="color" class="h-8 w-10 rounded" />
        </label>
      </div>
    </StepCard>

    <StepCard
      :step="4"
      title="Foto hari ini"
      :description="photoCount ? `${photoCount} foto terselip` : 'Belum ada foto di kantong ini'"
      variant="card"
    >
      <button
        type="button"
        class="add-photos flex w-full items-center gap-3 rounded-[14px] px-3.5 py-3 text-left"
        :disabled="busy"
        @click="fileInput?.click()"
      >
        <Icon name="image-plus" :size="20" />
        <span class="min-w-0 flex-1">
          <span class="block text-body font-semibold">
            {{ preparing ? 'Menyiapkan foto…' : 'Tambah foto' }}
          </span>
          <span class="block text-[11.5px] text-ink-muted">
            JPG, PNG, HEIC, dan lainnya. Hanya tersimpan di perangkat ini.
          </span>
        </span>
        <Icon name="plus" :size="18" />
      </button>

      <ul
        v-if="existing?.moments.length || added.length"
        class="mt-3 flex flex-wrap gap-2"
        aria-label="Foto di kantong"
      >
        <li
          v-for="(id, index) in existing?.moments ?? []"
          :key="id"
          class="relative size-16 overflow-hidden rounded-[10px] bg-fill"
          :class="{ 'is-removed': removed.has(id) }"
        >
          <img v-if="keptUrls[id]" :src="keptUrls[id]!" alt="" class="size-full object-cover" />
          <button
            v-if="removed.has(id)"
            type="button"
            class="thumb-remove"
            :aria-label="`Kembalikan foto ${index + 1} ke kantong`"
            @click="restoreKept(id)"
          >
            <Icon name="undo" :size="12" />
          </button>
          <button
            v-else
            type="button"
            class="thumb-remove"
            :aria-label="`Keluarkan foto ${index + 1} dari kantong`"
            @click="removeKept(id)"
          >
            <Icon name="close" :size="12" />
          </button>
        </li>
        <li
          v-for="(item, index) in added"
          :key="item.url"
          class="relative size-16 overflow-hidden rounded-[10px]"
        >
          <img :src="item.url" alt="" class="size-full object-cover" />
          <button
            type="button"
            class="thumb-remove"
            :aria-label="`Hapus foto ${index + 1}`"
            @click="removeAdded(index)"
          >
            <Icon name="close" :size="12" />
          </button>
        </li>
      </ul>
      <p v-if="preparing" class="mt-2 text-caption text-ink-muted" aria-live="polite">
        Foto HEIC butuh beberapa detik.
      </p>
      <p v-if="removed.size" class="mt-2 text-caption text-ink-muted">
        {{ removed.size }} foto dikeluarkan saat disimpan. Ketuk panahnya untuk mengembalikan.
      </p>
      <p v-if="error" role="alert" class="mt-2 text-caption text-ink-muted">{{ error }}</p>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="sr-only"
        tabindex="-1"
        aria-label="Pilih foto momen"
        data-testid="moment-upload"
        @change="onFiles"
      />
    </StepCard>

    <template #footer>
      <template v-if="confirmDelete">
        <p class="mr-auto text-body font-semibold" role="alert">
          {{ deleteQuestion }}
          <span class="block text-caption font-normal text-ink-muted">
            Foto yang sudah masuk CD di Memori TV ikut terhapus.
          </span>
        </p>
        <button
          type="button"
          class="min-h-10 px-1 text-body whitespace-nowrap text-ink-muted hover:text-ink"
          @click="confirmDelete = false"
        >
          Batal
        </button>
        <button
          type="button"
          class="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-body font-semibold whitespace-nowrap text-white disabled:opacity-50"
          :disabled="busy"
          @click="removePocket"
        >
          <Icon name="trash" :size="15" /> Hapus
        </button>
      </template>
      <template v-else>
        <!-- Di HP cukup ikonnya, supaya tombol simpan tidak terjepit. -->
        <button
          v-if="existing"
          type="button"
          class="mr-auto inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 text-body whitespace-nowrap text-ink-muted hover:text-ink"
          :disabled="busy"
          @click="confirmDelete = true"
        >
          <Icon name="trash" :size="16" /> <span class="max-sm:sr-only">Hapus kantong</span>
        </button>
        <button
          type="button"
          class="min-h-10 px-1 text-body whitespace-nowrap text-ink-muted hover:text-ink"
          @click="setOpen(false)"
        >
          Batal
        </button>
        <button
          type="button"
          class="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-body font-semibold whitespace-nowrap text-white disabled:opacity-50"
          :disabled="busy"
          @click="save"
        >
          <Icon name="check" :size="15" /> {{ saveLabel }}
        </button>
      </template>
    </template>
  </Modal>
</template>

<style scoped>
.sticker-option {
  background-color: var(--color-fill);
  transition:
    background-color 150ms,
    box-shadow 150ms;
}

.sticker-option:hover {
  background-color: var(--color-line-soft);
}

.sticker-option[data-state='checked'] {
  background-color: var(--color-surface);
  box-shadow: inset 0 0 0 1.5px var(--color-pocket-ink);
}

.frame-option {
  background-color: var(--color-fill);
  transition:
    background-color 150ms,
    box-shadow 150ms;
}

.frame-option:hover {
  background-color: var(--color-line-soft);
}

.frame-option[data-state='checked'] {
  background-color: var(--color-surface);
  box-shadow: inset 0 0 0 1.5px var(--color-pocket-ink);
}

.add-photos {
  border: 1.5px dashed var(--color-line);
  background-color: var(--color-panel);
  color: var(--color-pocket-ink);
  transition: background-color 150ms;
}

.add-photos:hover {
  background-color: var(--color-fill);
}

.is-removed img {
  opacity: 0.35;
  filter: grayscale(1);
}

.custom-swatch {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--spectrum);
}

/* Titik warna pilihan di tengah cincin pelangi. */
.custom-swatch::after {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  background-color: var(--custom);
  box-shadow: 0 0 0 1.5px var(--color-surface);
}

.thumb-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-ink) 72%, transparent);
  color: var(--color-white);
}
</style>
