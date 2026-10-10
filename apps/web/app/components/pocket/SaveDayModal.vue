<script setup lang="ts">
import { byId, letter, pocket } from '@postpocket/presets'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { longDate } from '~/utils/calendar'
import { readExifDate } from '~/utils/exif'
import { PhotoError, preparePhoto } from '~/utils/front-image'
import type { DraftPhoto } from '~/utils/letter-draft'
import type { PocketDay } from '~/utils/memories'

/**
 * Modal "Simpan satu hari kecil" (PRD Pocket): warna kantong, stiker, bingkai foto, dan momen.
 * Preview kantong berubah langsung. Dipakai juga untuk mengganti desain kantong yang sudah ada.
 */
const props = defineProps<{ day: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [day: PocketDay] }>()
const memories = useMemories()

const existing = computed(() => memories.data.days[props.day])
const packet = ref(pocket.packetColors[0]!.id)
const sticker = ref(letter.stickers[0]!.id)
const frame = ref(pocket.frames[0]!.id)
const frameColor = ref(pocket.frameColors[0]!.id)
const customColor = ref('#c8a2c8')
const added = shallowRef<{ photo: DraftPhoto; url: string; takenAt?: string }[]>([])
const busy = ref(false)
const error = ref('')
const existingUrl = ref<string | null>(null)

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
  error.value = ''
  existingUrl.value = day?.moments[0] ? await memories.photoUrl(day.moments[0]) : null
})

const packetColor = computed(
  () => byId(pocket.packetColors, packet.value) ?? pocket.packetColors[0]!,
)
const stickerItem = computed(() => byId(letter.stickers, sticker.value))
const frameVariant = computed(() => frame.value as 'polaroid' | 'stamp' | 'ticket')
const frameHex = computed(() =>
  frameColor.value === 'custom'
    ? customColor.value
    : (byId(pocket.frameColors, frameColor.value)?.color ?? '#fbf6ec'),
)
const comboName = computed(() =>
  `${packetColor.value.flavor} / ${stickerItem.value?.label ?? ''}`.toUpperCase(),
)
const previewPhoto = computed(() => added.value[0]?.url ?? existingUrl.value)

const packetOptions = pocket.packetColors.map((item) => ({
  value: item.id,
  label: item.label,
  color: item.color,
}))
const frameOptions = pocket.frames.map((item) => ({ value: item.id, label: item.label }))
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
  error.value = ''
  const next = [...added.value]
  for (const file of files) {
    try {
      const takenAt = (await readExifDate(file)) ?? undefined
      const photo = await preparePhoto(file)
      next.push({ photo, url: URL.createObjectURL(photo.blob), takenAt })
    } catch (problem) {
      error.value = problem instanceof PhotoError ? problem.message : 'Ada foto yang gagal dibaca.'
    }
  }
  added.value = next
  busy.value = false
}

function removeAdded(index: number) {
  const item = added.value[index]
  if (item) URL.revokeObjectURL(item.url)
  added.value = added.value.filter((_, i) => i !== index)
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
      moments: [...(existing.value?.moments ?? []), ...ids],
      savedAt: existing.value?.savedAt ?? new Date().toISOString(),
    }
    await memories.saveDay(day)
    clearAdded()
    open.value = false
    emit('saved', day)
  } catch {
    error.value = 'Gagal menyimpan di perangkat ini. Coba lagi.'
  } finally {
    busy.value = false
  }
}

onBeforeUnmount(clearAdded)
</script>

<template>
  <Modal
    v-model:open="open"
    tone="pocket"
    eyebrow="Kapsul waktu kecilmu"
    :title="existing ? 'Ganti desain kantong' : 'Simpan satu hari kecil'"
    :description="longDate(day)"
  >
    <template #preview>
      <div class="grid h-full place-items-center" data-testid="packet-preview">
        <div class="w-[min(62%,300px)] pt-6">
          <SnackPacket
            :color="packetColor.color"
            :sticker="stickerItem"
            :frame="frameVariant"
            :frame-color="frameHex"
            :photo-url="previewPhoto"
          />
        </div>
      </div>
      <p
        class="absolute bottom-5 left-6 font-mono text-[11px] tracking-[0.18em] text-pocket-muted"
        data-testid="combo-name"
      >
        {{ comboName }}
      </p>
    </template>

    <StepCard :step="1" title="Warna kantong" :hint="packetColor.label" variant="card">
      <SwatchGroup
        v-model="packet"
        label="Warna kantong"
        :options="packetOptions"
        size="md"
        check
      />
    </StepCard>

    <StepCard :step="2" title="Stiker" :hint="stickerItem?.label" variant="card">
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

    <StepCard :step="3" title="Bingkai foto" variant="card">
      <PillGroup v-model="frame" label="Bingkai foto" :options="frameOptions" />
      <div class="mt-3 flex flex-wrap items-center gap-2.5">
        <SwatchGroup v-model="frameColor" label="Warna bingkai" :options="frameColorOptions" check>
          <Swatch
            v-for="item in frameColorOptions"
            :key="item.value"
            :value="item.value"
            :label="item.label"
            :color="item.color"
            check
          />
          <Swatch value="custom" label="Warna sendiri" :color="customColor" check />
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
      title="Tambah momen"
      variant="card"
      description="Pilih beberapa foto sekaligus: JPG, PNG, atau HEIC. Tanggalnya diambil dari foto bila ada."
    >
      <div class="flex flex-wrap gap-2">
        <div
          v-for="(item, index) in added"
          :key="item.url"
          class="relative size-16 overflow-hidden rounded-[10px]"
        >
          <img :src="item.url" alt="" class="size-full object-cover" />
          <button
            type="button"
            class="absolute top-0.5 right-0.5 grid size-6 place-items-center rounded-full bg-ink/70 text-white"
            :aria-label="`Hapus foto ${index + 1}`"
            @click="removeAdded(index)"
          >
            <Icon name="close" :size="12" />
          </button>
        </div>
        <button
          type="button"
          class="grid size-16 place-items-center rounded-[10px] border border-dashed border-line text-ink-muted hover:bg-fill"
          :disabled="busy"
          aria-label="Tambah foto"
          @click="fileInput?.click()"
        >
          <Icon name="plus" :size="18" />
        </button>
      </div>
      <p v-if="existing?.moments.length" class="mt-2 text-caption text-ink-muted">
        Sudah ada {{ existing.moments.length }} foto di kantong ini.
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
      <button type="button" class="text-body text-ink-muted hover:text-ink" @click="open = false">
        Nanti saja
      </button>
      <button
        type="button"
        class="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-body font-semibold text-white disabled:opacity-50"
        :disabled="busy"
        @click="save"
      >
        <Icon name="check" :size="15" /> Simpan
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.sticker-option {
  transition: background-color 150ms;
}

.sticker-option:hover {
  background-color: var(--color-fill);
}

.sticker-option[data-state='checked'] {
  background-color: var(--color-surface);
  box-shadow: inset 0 0 0 1.5px var(--color-pocket-ink);
}
</style>
