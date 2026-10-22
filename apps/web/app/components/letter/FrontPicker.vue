<script setup lang="ts">
import {
  illustrationArt,
  offeredIllustrations,
  type FoilColor,
  type Paper,
  type Shape,
} from '@postpocket/presets'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  RadioGroupItem,
  RadioGroupRoot,
} from 'reka-ui'
import { PHOTO_MAX_SIDE, idealPhotoSize, ratioLabel } from '~/utils/front-image'
import { PHOTO_FRONT } from '~/utils/letter-draft'

/**
 * Langkah 1 Letter: pilih ilustrasi dari library atau upload foto sendiri.
 * Thumbnail-nya memakai bentuk kartu yang dipilih, jadi yang terlihat di sini sama dengan
 * sampulnya nanti. Drop dan paste ditangani halaman, supaya bisa dilakukan di mana saja.
 */
const props = defineProps<{
  foil: FoilColor
  paper: Paper
  /** Bentuk kartu yang dipilih. */
  shape: Shape
  photoUrl: string | null
  /** Lebar dibagi tinggi foto depan, untuk thumbnail-nya di bentuk Asli. */
  photoRatio?: number
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{ file: [file: File] }>()
const illustrations = offeredIllustrations()
const model = defineModel<string>({ required: true })
const input = ref<HTMLInputElement | null>(null)
// Surat titipan tidak dibuatkan link, jadi keterangan fotonya menyebut menitip.
const titip = computed(() => !!useLetterDraft().box)

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) emit('file', file)
  target.value = ''
}

/**
 * Thumbnail setinggi 60 px, lebarnya mengikuti rasio kartu. Foto panorama atau sangat tinggi di
 * bentuk Asli dibatasi 1:2 sampai 2:1, supaya thumbnail-nya tidak melebar keluar layar HP.
 */
function tileStyle(ratio: number) {
  const shown = Math.min(2, Math.max(0.5, props.shape.ratio ?? ratio))
  return { aspectRatio: String(shown) }
}

/** Saran ukuran foto untuk bentuk yang dipilih; bentuk Asli mengikuti fotonya sendiri. */
const sizeHint = computed(() => {
  const ratio = props.shape.ratio
  if (!ratio) return null
  return { ratio: ratioLabel(ratio), ...idealPhotoSize(ratio) }
})

// Keterangan ukuran: terbuka saat ikonnya disorot mouse, atau diketuk di layar sentuh (dan lewat
// keyboard). Yang dibuka karena disorot tetap terbuka selama mouse di atas ikon atau di atas
// keterangannya, dan tidak memindahkan fokus saat dibuka maupun ditutup. Escape selalu menutupnya.
const infoOpen = ref(false)
let hovering = false
let byHover = false
let closing: ReturnType<typeof setTimeout> | undefined
function setInfoOpen(value: boolean) {
  if (!value && hovering) return
  if (value) byHover = false
  infoOpen.value = value
}
function onInfoEnter(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  clearTimeout(closing)
  hovering = true
  if (!infoOpen.value) byHover = true
  infoOpen.value = true
}
/** Ditutup sebentar kemudian, supaya mouse sempat pindah dari ikon ke keterangannya. */
function onInfoLeave(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  hovering = false
  clearTimeout(closing)
  closing = setTimeout(() => {
    if (byHover) infoOpen.value = false
  }, 200)
}
function onInfoEscape() {
  hovering = false
  clearTimeout(closing)
}
function keepFocusIfHover(event: Event) {
  if (byHover) event.preventDefault()
}
onBeforeUnmount(() => clearTimeout(closing))

// Thumbnail yang dipilih selalu terlihat di barisnya, misalnya foto kamu di ujung kanan.
const row = ref<{ $el: HTMLElement } | null>(null)
function showChecked() {
  const el = row.value?.$el
  const tile = el?.querySelector<HTMLElement>('[data-state="checked"]')
  if (!el || !tile) return
  const left = tile.offsetLeft - el.offsetLeft
  if (left < el.scrollLeft) el.scrollLeft = left - 4
  else if (left + tile.offsetWidth > el.scrollLeft + el.clientWidth) {
    el.scrollLeft = left + tile.offsetWidth - el.clientWidth + 4
  }
}
watch([model, () => props.shape.id], () => nextTick(showChecked))
onMounted(showChecked)
</script>

<template>
  <!-- Satu baris yang bisa digeser: tingginya tetap saat thumbnail melebar di bentuk Mendatar,
       jadi pilihan Bentuk di bawahnya tidak berpindah di bawah jari. -->
  <RadioGroupRoot
    ref="row"
    v-model="model"
    aria-label="Gambar depan"
    orientation="horizontal"
    loop
    class="front-row"
  >
    <RadioGroupItem
      v-for="item in illustrations"
      :key="item.id"
      :value="item.id"
      :aria-label="item.label"
      :title="item.label"
      class="front-tile"
      :style="tileStyle(item.ratio)"
    >
      <FoilThumb
        :art="illustrationArt(item, shape.id).art"
        :foil-mask="illustrationArt(item, shape.id).foil"
        :foil="foil"
        :paper="paper"
        class="size-full"
      />
    </RadioGroupItem>
    <RadioGroupItem
      v-if="photoUrl"
      :value="PHOTO_FRONT"
      aria-label="Foto kamu"
      title="Foto kamu"
      class="front-tile"
      :style="tileStyle(photoRatio ?? 0.75)"
    >
      <img :src="photoUrl" alt="" class="size-full rounded-[4px] object-cover" draggable="false" />
    </RadioGroupItem>
  </RadioGroupRoot>

  <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-control bg-surface px-3.5 text-body font-semibold inset-ring inset-ring-line hover:bg-panel disabled:opacity-50"
        :disabled="busy"
        @click="input?.click()"
      >
        <Icon name="upload" :size="15" />
        {{ busy ? 'Menyiapkan foto…' : 'Unggah foto' }}
      </button>
      <PopoverRoot :open="infoOpen" @update:open="setInfoOpen">
        <PopoverTrigger as-child>
          <button
            type="button"
            class="relative grid size-9 place-items-center rounded-full text-ink-muted before:absolute before:-inset-1 before:content-[''] hover:bg-fill hover:text-ink"
            aria-label="Ukuran foto yang pas"
            data-testid="photo-size-info"
            @pointerenter="onInfoEnter"
            @pointerleave="onInfoLeave"
          >
            <Icon name="info" :size="17" />
          </button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            side="top"
            align="start"
            :side-offset="6"
            :collision-padding="16"
            class="z-[60] w-[min(288px,calc(100vw-32px))] rounded-control bg-surface p-3.5 text-caption text-ink-muted shadow-raised data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
            data-testid="photo-size-hint"
            @open-auto-focus="keepFocusIfHover"
            @close-auto-focus="keepFocusIfHover"
            @escape-key-down="onInfoEscape"
            @pointerenter="onInfoEnter"
            @pointerleave="onInfoLeave"
          >
            <template v-if="sizeHint">
              <p class="text-body font-semibold text-ink">
                Foto yang pas untuk bentuk {{ shape.label }}
              </p>
              <p class="mt-1">
                <span class="font-semibold text-ink tabular-nums"
                  >{{ sizeHint.width }} × {{ sizeHint.height }} px</span
                >, atau foto lain dengan rasio {{ sizeHint.ratio }}. Foto yang bentuknya lain
                dipotong di tepinya, bagian tengahnya tetap utuh.
              </p>
            </template>
            <template v-else>
              <p class="text-body font-semibold text-ink">Bentuk Asli mengikuti fotomu</p>
              <p class="mt-1">
                Kartunya ikut bentuk foto, jadi ukuran apa pun pas dan tidak ada yang terpotong.
                Foto disimpan sampai {{ PHOTO_MAX_SIDE }} px di sisi terpanjangnya.
              </p>
            </template>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
    </div>
    <input
      ref="input"
      type="file"
      accept="image/*"
      class="sr-only"
      tabindex="-1"
      aria-label="Unggah foto untuk gambar depan"
      data-testid="front-upload"
      @change="onChange"
    />
    <p class="min-w-0 flex-1 basis-40 text-caption text-ink-muted">
      <span class="pointer-coarse:hidden">atau tarik ke halaman ini, atau tempel. </span>Foto tetap
      di perangkatmu sampai kamu {{ titip ? 'menitipkannya' : 'membuat link' }}.
    </p>
  </div>
  <p
    v-if="error"
    role="alert"
    class="mt-2 rounded-control bg-[#fbefd2] px-3 py-2 text-caption text-[#7a5a14]"
  >
    {{ error }}
  </p>
</template>

<style scoped>
.front-row {
  display: flex;
  gap: 8px;
  /* Ruang untuk cincin pilihan dan fokus keyboard, yang terpotong di tepi wadah yang digeser. */
  margin: -4px;
  padding: 4px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
}

@media (pointer: coarse) {
  .front-row {
    scrollbar-width: none;
  }

  .front-row::-webkit-scrollbar {
    display: none;
  }
}

.front-tile {
  flex: none;
  scroll-snap-align: start;
  height: 60px;
  padding: 2px;
  border-radius: 7px;
  transition: box-shadow 150ms;
  box-shadow: 0 0 0 1px var(--color-line);
}

.front-tile[data-state='checked'] {
  box-shadow: 0 0 0 1.5px var(--color-ink);
}
</style>
