<script setup lang="ts">
import { letter, type FoilColor, type Paper } from '@postpocket/presets'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { PHOTO_FRONT } from '~/utils/letter-draft'

/**
 * Langkah 1 Letter: pilih ilustrasi dari library atau upload foto sendiri.
 * Drop dan paste ditangani halaman, supaya bisa dilakukan di mana saja.
 */
defineProps<{
  foil: FoilColor
  paper: Paper
  photoUrl: string | null
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{ file: [file: File] }>()
const model = defineModel<string>({ required: true })
const input = ref<HTMLInputElement | null>(null)

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) emit('file', file)
  target.value = ''
}
</script>

<template>
  <div class="flex gap-4">
    <RadioGroupRoot
      v-model="model"
      aria-label="Gambar depan"
      orientation="horizontal"
      loop
      class="flex shrink-0 flex-wrap gap-2"
    >
      <RadioGroupItem
        v-for="item in letter.illustrations"
        :key="item.id"
        :value="item.id"
        :aria-label="item.label"
        :title="item.label"
        class="front-tile"
      >
        <FoilThumb
          :art="item.art"
          :foil-mask="item.foil"
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
      >
        <img
          :src="photoUrl"
          alt=""
          class="size-full rounded-[4px] object-cover"
          draggable="false"
        />
      </RadioGroupItem>
    </RadioGroupRoot>
  </div>

  <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
    <button
      type="button"
      class="inline-flex h-9 items-center gap-2 rounded-control bg-surface px-3.5 text-body font-semibold inset-ring inset-ring-line hover:bg-panel disabled:opacity-50"
      :disabled="busy"
      @click="input?.click()"
    >
      <Icon name="upload" :size="15" />
      {{ busy ? 'Menyiapkan foto…' : 'Upload foto' }}
    </button>
    <input
      ref="input"
      type="file"
      accept="image/*"
      class="sr-only"
      tabindex="-1"
      aria-label="Upload foto untuk gambar depan"
      data-testid="front-upload"
      @change="onChange"
    />
    <p class="min-w-0 flex-1 text-caption text-ink-muted">
      atau drop / paste foto. Foto tetap di browser sampai kamu membuat link.
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
.front-tile {
  width: 52px;
  aspect-ratio: 0.72;
  padding: 2px;
  border-radius: 7px;
  transition: box-shadow 150ms;
  box-shadow: 0 0 0 1px var(--color-line);
}

.front-tile[data-state='checked'] {
  box-shadow: 0 0 0 1.5px var(--color-ink);
}
</style>
