<script setup lang="ts">
import { byId, letter, pocket } from '@postpocket/presets'
import { isPocketDay, longDate } from '~/utils/calendar'
import { readExifDate } from '~/utils/exif'
import { PhotoError, preparePhoto } from '~/utils/front-image'

useSeoMeta({ title: 'Kantong · PostPocket', robots: 'noindex' })

// Tanggal yang tidak ada atau belum datang kembali ke kalender.
definePageMeta({
  middleware: (to) => {
    if (!isPocketDay(String(to.params.date))) return navigateTo('/pocket', { replace: true })
  },
})

/**
 * Isi satu hari Pocket (PRD): ketuk kantong untuk menyobeknya, foto keluar berjajar dalam bingkai
 * pilihan. Dari sini bisa tambah foto, ganti desain, kirim sebagai surat, atau putar di TV.
 */
const route = useRoute()
const day = computed(() => String(route.params.date))
const memories = useMemories()
const draft = useLetterDraft()
onMounted(() => memories.load())

const saved = computed(() => memories.data.days[day.value])
const color = computed(
  () =>
    byId(pocket.packetColors, saved.value?.packet ?? '')?.color ?? pocket.packetColors[0]!.color,
)
const sticker = computed(() => byId(letter.stickers, saved.value?.sticker ?? ''))
const frame = computed(() => (saved.value?.frame ?? 'polaroid') as 'polaroid' | 'stamp' | 'ticket')
const frameColor = computed(() => {
  const value = saved.value?.frameColor ?? ''
  return value.startsWith('#') ? value : (byId(pocket.frameColors, value)?.color ?? '#fbf6ec')
})

const urls = ref<Record<string, string | null>>({})
watch(
  () => saved.value?.moments,
  async (ids) => {
    for (const id of ids ?? []) {
      if (!(id in urls.value)) urls.value = { ...urls.value, [id]: await memories.photoUrl(id) }
    }
  },
  { immediate: true },
)

const torn = ref(false)
const selected = ref<string | null>(null)
function tear() {
  torn.value = true
  selected.value ??= saved.value?.moments[0] ?? null
}

const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref('')

async function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length || !saved.value) return
  busy.value = true
  error.value = ''
  try {
    const photos = []
    for (const file of files) {
      const takenAt = (await readExifDate(file)) ?? undefined
      photos.push({ photo: await preparePhoto(file), takenAt })
    }
    const ids = await memories.addMoments(photos, { day: day.value, source: 'upload' })
    await memories.saveDay({ ...saved.value, moments: [...saved.value.moments, ...ids] })
  } catch (problem) {
    error.value = problem instanceof PhotoError ? problem.message : 'Foto gagal disimpan.'
  } finally {
    busy.value = false
  }
}

/** Foto terpilih jadi foto isi surat, lalu buka editor surat. */
async function sendAsLetter() {
  const id = selected.value
  if (!id) return
  const photo = await memories.photo(id)
  if (!photo) return
  await draft.load()
  if (!draft.addPhoto(photo)) {
    error.value = 'Surat sudah berisi 4 foto. Hapus satu dulu di editor isi surat.'
    return
  }
  await draft.save()
  await navigateTo('/letter/new')
}

const editOpen = ref(false)
</script>

<template>
  <div class="min-h-dvh bg-pocket-page text-pocket-ink">
    <div class="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <header class="py-4">
        <NuxtLink
          to="/pocket"
          class="inline-flex items-center gap-1 text-caption text-pocket-muted hover:text-pocket-ink"
        >
          <Icon name="chevron-left" :size="14" /> Kalender
        </NuxtLink>
      </header>

      <p class="font-mono text-[11px] tracking-[0.2em] text-pocket-muted uppercase">Isi kantong</p>
      <h1 class="mt-1 text-[clamp(24px,6vw,32px)] font-semibold tracking-[-0.03em]">
        {{ longDate(day) }}
      </h1>

      <template v-if="memories.ready && saved">
        <div class="mt-8 flex flex-col items-center" data-testid="pocket-day" :data-torn="torn">
          <button
            type="button"
            class="w-[min(56%,240px)] pt-4"
            :aria-label="torn ? 'Kantong sudah dibuka' : 'Buka kantong'"
            :disabled="torn"
            @click="tear"
          >
            <SnackPacket :color="color" :sticker="sticker" :torn="torn" />
          </button>
          <p v-if="!torn" class="mt-4 text-caption text-pocket-muted">
            Ketuk kantong untuk menyobeknya
          </p>
        </div>

        <div v-if="torn" class="mt-6">
          <!-- Ruang lebih di sekeliling foto supaya bayangan bingkainya tidak terpotong. -->
          <div class="-mx-4 snap-x overflow-x-auto sm:-mx-6">
            <div
              class="mx-auto flex w-max gap-4 px-6 pt-3 pb-8"
              role="listbox"
              aria-label="Foto di kantong"
            >
              <button
                v-for="(id, index) in saved.moments"
                :key="id"
                type="button"
                role="option"
                :aria-selected="selected === id"
                class="moment w-36 shrink-0 snap-center rounded-[6px] outline-offset-4 sm:w-40"
                :class="{ 'is-selected': selected === id }"
                :style="{ '--delay': `${index * 90}ms`, '--tilt': `${index % 2 ? 3 : -3}deg` }"
                data-testid="moment"
                @click="selected = id"
              >
                <PhotoFrame :variant="frame" :color="frameColor" :src="urls[id] ?? undefined" />
              </button>
            </div>
          </div>
          <p
            v-if="!saved.moments.length"
            class="pb-6 text-center text-caption text-pocket-muted"
            data-testid="pocket-no-photos"
          >
            Kantong ini masih kosong. Tambahkan foto pertamamu.
          </p>

          <div class="mt-2 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              class="pocket-action"
              :disabled="busy"
              @click="fileInput?.click()"
            >
              <Icon name="plus" :size="15" /> {{ busy ? 'Menyiapkan foto…' : 'Tambah foto' }}
            </button>
            <button type="button" class="pocket-action" @click="editOpen = true">
              Ganti desain kantong
            </button>
            <button type="button" class="pocket-action" :disabled="!selected" @click="sendAsLetter">
              <Icon name="link" :size="15" /> Kirim sebagai surat
            </button>
            <NuxtLink
              v-if="saved.moments.length"
              :to="`/tv?hari=${day}`"
              class="pocket-action pocket-action--primary"
            >
              <Icon name="play" :size="15" /> Putar di TV
            </NuxtLink>
          </div>
          <p v-if="error" role="alert" class="mt-3 text-center text-caption text-pocket-muted">
            {{ error }}
          </p>
        </div>
      </template>

      <div v-else-if="memories.ready" class="mt-10 text-center" data-testid="pocket-empty">
        <p class="text-body text-pocket-muted">Belum ada kantong untuk tanggal ini.</p>
        <button
          type="button"
          class="mt-4 h-10 rounded-full bg-ink px-5 text-body font-semibold text-white"
          @click="editOpen = true"
        >
          Buat kantong
        </button>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="sr-only"
        tabindex="-1"
        aria-label="Tambah foto ke kantong"
        data-testid="pocket-upload"
        @change="onFiles"
      />
    </div>
    <SaveDayModal v-model:open="editOpen" :day="day" />
  </div>
</template>

<style scoped>
.pocket-action {
  display: inline-flex;
  height: 40px;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 0 16px;
  background-color: var(--color-surface);
  box-shadow: inset 0 0 0 1px var(--color-line);
  font-size: var(--text-body);
  font-weight: 600;
}

.pocket-action--primary {
  background-color: var(--color-pocket-ink);
  box-shadow: none;
  color: var(--color-white);
}

.pocket-action:disabled {
  opacity: 0.45;
}

/* Foto keluar dari kantong satu per satu. */
.moment {
  animation: moment-out 520ms var(--ease-card) both;
  animation-delay: var(--delay);
  transform: rotate(var(--tilt));
}

.moment.is-selected {
  outline: 2px solid var(--color-pocket-ink);
}

@keyframes moment-out {
  from {
    opacity: 0;
    transform: translateY(-40px) rotate(0deg) scale(0.9);
  }
}

@media (prefers-reduced-motion: reduce) {
  .moment {
    animation: none;
  }
}
</style>
