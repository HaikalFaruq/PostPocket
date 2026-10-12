<script setup lang="ts">
import { byId, letter, pocket } from '@postpocket/presets'
import type { LinePhoto } from '~/components/pocket/PhotoLine.vue'
import { isPocketDay, longDate, shortDate } from '~/utils/calendar'
import { readExifDate } from '~/utils/exif'
import { PhotoError, preparePhoto } from '~/utils/front-image'
import { dayKey } from '~/utils/memories'
import { sendPhotoToLetter } from '~/utils/pending-photo'

useSeoMeta({ title: 'Kantong · PostPocket', robots: 'noindex' })
// Sama dengan --color-pocket-page di main.css.
usePageTint('bg-pocket-page', '#f1f4f8')

// Tanggal yang tidak ada atau belum datang kembali ke kalender.
definePageMeta({
  middleware: (to) => {
    if (!isPocketDay(String(to.params.date))) return navigateTo('/pocket', { replace: true })
  },
})

/**
 * Isi satu hari Pocket (PRD): ketuk kantong untuk menyobeknya, foto keluar dan dijepit di tali
 * dalam bingkai pilihan. Dari sini bisa tambah foto, ganti desain, kirim foto yang sedang di
 * tengah tali sebagai surat, atau putar di TV.
 */
const route = useRoute()
const day = computed(() => String(route.params.date))
const memories = useMemories()
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

const clock = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })

/** Foto di tali: jamnya ditulis di bingkai, asalnya di keterangan bawah tali. */
const linePhotos = computed<LinePhoto[]>(() =>
  (saved.value?.moments ?? []).map((id) => {
    const moment = memories.data.moments[id]
    const taken = moment ? new Date(moment.takenAt) : null
    const time = taken && !Number.isNaN(taken.getTime()) ? clock.format(taken) : null
    const takenDay = taken && time ? dayKey(taken) : day.value
    const caption =
      moment?.source === 'booth'
        ? 'Dari Booth'
        : takenDay !== day.value
          ? `Diambil ${shortDate(takenDay)}`
          : undefined
    return {
      id,
      src: urls.value[id] ?? null,
      note: time ?? undefined,
      title: time ? `Pukul ${time}` : 'Foto kenangan',
      caption,
    }
  }),
)

const torn = ref(false)
/** Foto yang sedang di tengah tali; dipakai "Kirim sebagai surat". */
const active = ref(0)
const selected = computed(() => saved.value?.moments[active.value] ?? null)
const packet = ref<{ el: HTMLElement | null } | null>(null)
const packetEl = computed(() => packet.value?.el ?? null)
const actions = ref<HTMLElement | null>(null)
function tear() {
  torn.value = true
  // Di HP yang pendek, foto dan tombolnya muncul di bawah kantong; gulir sampai kelihatan setelah
  // fotonya selesai keluar dari kantong.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  window.setTimeout(
    () =>
      actions.value?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' }),
    reduced ? 0 : 900,
  )
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
    const before = saved.value.moments.length
    const ids = await memories.addMoments(photos, { day: day.value, source: 'upload' })
    await memories.saveDay({ ...saved.value, moments: [...saved.value.moments, ...ids] })
    // Tali bergeser ke foto pertama yang baru, jadi kelihatan fotonya sudah masuk dan langsung
    // bisa dikirim sebagai surat.
    if (ids.length) active.value = before
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
  if (photo) await sendPhotoToLetter(photo, `Pocket ${shortDate(day.value)}`)
}

const editOpen = ref(false)
</script>

<template>
  <div class="min-h-dvh bg-pocket-page text-pocket-ink">
    <main class="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
      <header class="py-4">
        <NuxtLink
          to="/pocket"
          class="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-body text-pocket-muted hover:text-pocket-ink"
        >
          <Icon name="chevron-left" :size="14" /> Kalender
        </NuxtLink>
      </header>

      <h1 class="mt-1 text-[clamp(26px,7vw,34px)] leading-tight font-bold tracking-[-0.03em]">
        {{ longDate(day) }}
      </h1>

      <template v-if="memories.ready && saved">
        <div class="mt-6 flex flex-col items-center" data-testid="pocket-day" :data-torn="torn">
          <TearablePacket
            ref="packet"
            class="relative z-20 w-[min(58%,250px)]"
            :color="color"
            :sticker="sticker"
            :opened="torn"
            @open="tear"
          />
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
    </main>

    <template v-if="memories.ready && saved && torn">
      <!-- Tali selebar layar: foto tetangga mengintip dari tepi. -->
      <PhotoLine
        v-if="linePhotos.length"
        v-model:index="active"
        class="mt-4"
        :photos="linePhotos"
        :frame="frame"
        :frame-color="frameColor"
        :from="packetEl"
        :from-y="0.2"
      />
      <p
        v-else
        class="mt-6 pb-6 text-center text-caption text-pocket-muted"
        data-testid="pocket-no-photos"
      >
        Kantong ini masih kosong. Tambahkan foto pertamamu.
      </p>

      <div class="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <div ref="actions" class="mt-6 flex scroll-mb-6 flex-wrap justify-center gap-2">
          <button type="button" class="pocket-action" :disabled="busy" @click="fileInput?.click()">
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
    <SaveDayModal v-model:open="editOpen" :day="day" @deleted="navigateTo('/pocket')" />
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
</style>
