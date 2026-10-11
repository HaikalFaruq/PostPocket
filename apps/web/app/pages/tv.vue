<script setup lang="ts">
import { byId, tv } from '@postpocket/presets'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { BOOTH_LAYOUTS, beep, captureShot, type BoothLayout } from '~/utils/booth'
import { readExifDate } from '~/utils/exif'
import { PhotoError, decodePhoto, preparePhoto } from '~/utils/front-image'
import { dayAlbum, dayKey, type AlbumView } from '~/utils/memories'

useSeoMeta({ title: 'Memori TV · PostPocket', robots: 'noindex' })

/**
 * TV clay (PRD modul 3, referensi Memory TV): pilih album di arsip CD, masukkan ke slot, lalu
 * TV memutar slideshow dengan filter retro. Album bulanan dibuat otomatis dari Pocket.
 */
const memories = useMemories()
const route = useRoute()
onMounted(() => memories.load())

const CLAY_KEY = 'postpocket:tv-clay'
const clay = ref(tv.clayColors[0]!.id)
onMounted(() => {
  try {
    const saved = localStorage.getItem(CLAY_KEY)
    if (saved && byId(tv.clayColors, saved)) clay.value = saved
  } catch {
    // Warna clay hanya kenyamanan; tanpa localStorage tetap pink.
  }
})
watch(clay, (value) => {
  try {
    localStorage.setItem(CLAY_KEY, value)
  } catch {
    // Abaikan.
  }
})
const clayColor = computed(() => byId(tv.clayColors, clay.value)?.color ?? tv.clayColors[0]!.color)
const clayOptions = tv.clayColors.map((item) => ({
  value: item.id,
  label: item.label,
  color: item.color,
}))

const filterId = ref(tv.filters[0]!.id)
const filter = computed(() => byId(tv.filters, filterId.value) ?? tv.filters[0]!)

// Rak CD. Kalau belum ada kenangan, satu CD kosong "Album baru" siap diisi.
const NEW_ALBUM: AlbumView = {
  id: 'baru',
  title: 'Album baru',
  emoji: '📀',
  color: '#c9d6e8',
  moments: [],
  kind: 'custom',
}
// "Putar di TV" dari Pocket (/tv?hari=YYYY-MM-DD): isi kantong hari itu jadi CD paling depan.
const pocketDay = computed(() =>
  typeof route.query.hari === 'string' ? memories.data.days[route.query.hari] : undefined,
)
const pocketCd = computed(() =>
  pocketDay.value?.moments.length ? dayAlbum(pocketDay.value) : null,
)
const albums = computed(() => {
  const list = pocketCd.value ? [pocketCd.value, ...memories.shelf] : memories.shelf
  return list.length ? list : [NEW_ALBUM]
})
const shelfIndex = ref(0)
const playingId = ref<string | null>(null)
const playing = computed(() => albums.value.find((album) => album.id === playingId.value))

// Kantongnya langsung diputar, begitu halaman dibuka atau begitu data di perangkat terbaca.
watch(
  () => pocketCd.value?.id,
  (id) => {
    if (!id) return
    shelfIndex.value = 0
    playingId.value = id
  },
  { immediate: true },
)

function insert(album: AlbumView) {
  playingId.value = album.id
}

// "+ Foto": foto disimpan sebagai momen hari ini (di bulan album itu, atau di kantong yang sedang
// diputar), lalu masuk album.
const fileInput = ref<HTMLInputElement | null>(null)
const target = ref<AlbumView | null>(null)
const adding = ref(false)
const error = ref('')

function addPhotos(album: AlbumView) {
  target.value = album
  fileInput.value?.click()
}

async function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  const album = target.value ?? current.value
  if (!files.length || !album) return
  adding.value = true
  error.value = ''
  try {
    const photos = []
    for (const file of files) {
      const takenAt = (await readExifDate(file)) ?? undefined
      photos.push({ photo: await preparePhoto(file), takenAt })
    }
    const today = dayKey(new Date())
    const month = album.kind === 'month' ? album.id.slice(6) : null
    const day =
      album.kind === 'day'
        ? album.id.slice(5)
        : month && !today.startsWith(month)
          ? `${month}-01`
          : today
    const ids = await memories.addMoments(photos, { day, source: 'upload' })
    const pocket = memories.data.days[day]
    if (album.id === NEW_ALBUM.id) await memories.createAlbum('Album pertama', '📀', ids)
    else if (album.kind === 'custom') await memories.addToAlbum(album.id, ids)
    else if (album.kind === 'day' && pocket)
      await memories.saveDay({ ...pocket, moments: [...pocket.moments, ...ids] })
  } catch (problem) {
    error.value = problem instanceof PhotoError ? problem.message : 'Foto gagal disimpan.'
  } finally {
    adding.value = false
  }
}

// Edit album buatan sendiri: nama, emoji, atau hapus.
const editing = ref(false)
const editTitle = ref('')
const editEmoji = ref('📀')
const EMOJIS = ['📀', '💖', '🌸', '🌊', '🎂', '✈️', '🐱', '🌙']
const current = computed(() => albums.value[shelfIndex.value])
const canEdit = computed(
  () => current.value?.kind === 'custom' && current.value.id !== NEW_ALBUM.id,
)

function startEdit() {
  if (!current.value) return
  editTitle.value = current.value.title
  editEmoji.value = current.value.emoji
  editing.value = true
}

async function saveEdit() {
  if (!current.value) return
  await memories.updateAlbum(current.value.id, {
    title: editTitle.value.trim().slice(0, 40) || current.value.title,
    emoji: editEmoji.value,
  })
  editing.value = false
}

async function removeAlbum() {
  if (!current.value || !window.confirm(`Hapus album "${current.value.title}"? Fotonya tetap ada.`))
    return
  if (playingId.value === current.value.id) playingId.value = null
  await memories.deleteAlbum(current.value.id)
  editing.value = false
}

// Booth (PRD): layar TV jadi kamera dengan filter aktif. /tv?booth=1 langsung membukanya.
const booth = ref(false)
const facing = ref<'user' | 'environment'>('user')
const cameraReady = ref(false)
const cameraError = ref('')
const layout = ref<BoothLayout>('strip')
const layoutOptions = BOOTH_LAYOUTS.map(({ value, label }) => ({ value, label }))
const recording = ref(false)
const countdown = ref<number | null>(null)
const flash = ref(0)
const shots = ref<HTMLCanvasElement[] | null>(null)
const camera = ref<{ video: HTMLVideoElement | null } | null>(null)
const boothInput = ref<HTMLInputElement | null>(null)
onMounted(() => {
  if (route.query.booth !== undefined) openBooth()
})

function openBooth() {
  booth.value = true
  cameraReady.value = false
  cameraError.value = ''
}

function closeBooth() {
  booth.value = false
  cameraReady.value = false
}

function switchCamera() {
  facing.value = facing.value === 'user' ? 'environment' : 'user'
  cameraReady.value = false
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Hitung mundur 3-2-1 dengan bunyi klik, lalu jepret berjeda 1 detik (PRD). */
async function record() {
  const video = camera.value?.video
  if (!video || recording.value) return
  recording.value = true
  try {
    for (const second of [3, 2, 1]) {
      countdown.value = second
      beep(660)
      await sleep(1000)
    }
    countdown.value = null
    const total = BOOTH_LAYOUTS.find((item) => item.value === layout.value)?.shots ?? 4
    const taken: HTMLCanvasElement[] = []
    for (let shot = 0; shot < total; shot++) {
      flash.value++
      beep(1320, 0.05)
      taken.push(captureShot(video, filter.value, facing.value === 'user'))
      if (shot < total - 1) await sleep(1000)
    }
    shots.value = taken
  } finally {
    recording.value = false
    countdown.value = null
  }
}

/** Kamera ditolak: foto dari galeri dipakai sebagai jepretan, dengan filter yang sama. */
async function onBoothFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])].slice(0, 4)
  input.value = ''
  const taken: HTMLCanvasElement[] = []
  for (const file of files) {
    try {
      const bitmap = await decodePhoto(file)
      taken.push(captureShot(bitmap, filter.value, false))
      bitmap.close()
    } catch {
      // Lewati foto yang tidak bisa dibaca.
    }
  }
  if (!taken.length) return
  if (taken.length === 1) layout.value = 'single'
  shots.value = taken
}

const marquee = computed(() =>
  booth.value
    ? '● PHOTO BOOTH · PILIH TATA LETAK LALU TEKAN REKAM'
    : playing.value
      ? `♪ SEDANG DIPUTAR · ${playing.value.title.toUpperCase()} · ${playing.value.moments.length} FOTO ♪`
      : 'BELUM ADA CD · PILIH ALBUM DI ARSIP LALU MASUKKAN',
)
</script>

<template>
  <div class="min-h-dvh bg-tv-page">
    <div class="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <header class="py-4">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-1 text-caption text-ink-muted hover:text-ink"
        >
          <Icon name="chevron-left" :size="14" /> PostPocket
        </NuxtLink>
      </header>

      <div class="text-center">
        <h1 class="font-tv text-[clamp(40px,10vw,64px)] leading-none tracking-[0.22em]">
          MEMORI <span class="text-tv-accent">TV</span>
        </h1>
        <p class="mt-2 font-mono text-[11px] tracking-[0.3em] text-ink-muted uppercase">
          Putar kenangan dari kantongmu
        </p>
      </div>

      <TvSet class="mt-6" :clay="clayColor">
        <template #screen>
          <template v-if="booth">
            <BoothCamera
              v-if="!cameraError"
              ref="camera"
              :filter="filter"
              :facing="facing"
              :countdown="countdown"
              :flash="flash"
              @ready="cameraReady = true"
              @error="cameraError = $event"
            />
            <div
              v-else
              class="absolute inset-0 grid place-items-center p-6 text-center"
              data-testid="booth-denied"
            >
              <div>
                <p class="font-tv text-[30px] tracking-[0.14em] text-white">KAMERA MATI</p>
                <p class="mt-2 text-caption text-white/80">
                  {{ cameraError }} Kamu tetap bisa pakai foto dari galeri.
                </p>
                <button
                  type="button"
                  class="mt-4 h-10 rounded-control bg-white px-4 text-body font-semibold text-ink"
                  @click="boothInput?.click()"
                >
                  Pilih foto dari galeri
                </button>
              </div>
            </div>
          </template>
          <TvSlideshow v-else-if="playing" :album="playing" :filter="filter" />
          <TvIdle v-else />
        </template>
        <template #panel>
          <div class="overflow-hidden rounded-[10px] bg-black/40 py-1.5" aria-live="polite">
            <p
              class="tv-marquee font-tv text-[18px] tracking-[0.12em] whitespace-nowrap text-tv-accent"
            >
              {{ marquee }}
            </p>
          </div>
          <RadioGroupRoot
            v-model="filterId"
            aria-label="Filter TV"
            class="grid grid-cols-4 gap-1.5 sm:grid-cols-2"
            loop
          >
            <RadioGroupItem
              v-for="item in tv.filters"
              :key="item.id"
              :value="item.id"
              class="tv-filter h-9 rounded-[10px] font-tv text-[17px] tracking-[0.1em] uppercase"
            >
              {{ item.label }}
            </RadioGroupItem>
          </RadioGroupRoot>
          <div class="mt-auto flex flex-col gap-2">
            <template v-if="booth">
              <RadioGroupRoot
                v-model="layout"
                aria-label="Tata letak Booth"
                class="grid grid-cols-3 gap-1.5"
                loop
              >
                <RadioGroupItem
                  v-for="item in layoutOptions"
                  :key="item.value"
                  :value="item.value"
                  class="tv-filter h-9 rounded-[10px] font-tv text-[15px] tracking-[0.06em] uppercase"
                >
                  {{ item.label }}
                </RadioGroupItem>
              </RadioGroupRoot>
              <button
                type="button"
                class="h-11 rounded-[12px] bg-tv-accent font-tv text-[20px] tracking-[0.16em] text-white disabled:opacity-50"
                :disabled="!cameraReady || recording"
                data-testid="booth-record"
                @click="record"
              >
                ● {{ recording ? 'MEREKAM' : 'REKAM' }}
              </button>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  class="tv-control"
                  :disabled="recording || !!cameraError"
                  @click="switchCamera"
                >
                  GANTI KAMERA
                </button>
                <button type="button" class="tv-control" :disabled="recording" @click="closeBooth">
                  KELUAR
                </button>
              </div>
            </template>
            <template v-else>
              <button v-if="playing" type="button" class="tv-control" @click="playingId = null">
                KELUARKAN CD
              </button>
              <button
                type="button"
                class="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] font-tv text-[20px] tracking-[0.16em] text-tv-accent inset-ring-2 inset-ring-tv-accent hover:bg-tv-accent/10"
                @click="openBooth"
              >
                <Icon name="camera" :size="18" /> PHOTO BOOTH
              </button>
            </template>
          </div>
        </template>
      </TvSet>

      <div class="mt-6 flex justify-center">
        <div
          class="flex flex-col items-center gap-2 rounded-[24px] bg-surface px-4 py-3 shadow-raised sm:flex-row sm:gap-3 sm:rounded-full sm:py-2 sm:pr-3"
        >
          <span class="font-mono text-[11px] tracking-[0.2em] text-ink-muted">CLAY</span>
          <SwatchGroup v-model="clay" label="Warna TV" :options="clayOptions" size="sm" />
        </div>
      </div>

      <section class="mt-10" aria-labelledby="arsip-title">
        <div class="mb-2 flex items-center gap-2">
          <h2 id="arsip-title" class="font-mono text-[12px] tracking-[0.24em] text-ink-muted">
            ARSIP
          </h2>
          <button
            v-if="canEdit"
            type="button"
            class="rounded-full bg-surface px-3 py-0.5 font-mono text-[11px] tracking-[0.16em] inset-ring inset-ring-line hover:bg-panel"
            @click="editing ? (editing = false) : startEdit()"
          >
            {{ editing ? 'TUTUP' : 'EDIT' }}
          </button>
        </div>
        <ClientOnly>
          <CdShelf
            v-model="shelfIndex"
            :albums="albums"
            :playing="playingId"
            @insert="insert"
            @add="addPhotos"
          />
        </ClientOnly>
        <p v-if="adding" class="mt-3 text-center text-caption text-ink-muted">Menyimpan foto…</p>
        <p v-if="error" role="alert" class="mt-3 text-center text-caption text-ink-muted">
          {{ error }}
        </p>

        <form
          v-if="editing && canEdit"
          class="mx-auto mt-5 max-w-sm space-y-3 rounded-[20px] bg-surface p-4 shadow-raised"
          @submit.prevent="saveEdit"
        >
          <label class="block text-caption text-ink-muted">
            Nama album
            <input
              v-model="editTitle"
              maxlength="40"
              class="mt-1 block h-10 w-full rounded-control bg-panel px-3 text-body text-ink inset-ring inset-ring-line"
            />
          </label>
          <div class="flex flex-wrap gap-1.5" role="group" aria-label="Emoji album">
            <button
              v-for="emoji in EMOJIS"
              :key="emoji"
              type="button"
              class="grid size-9 place-items-center rounded-control text-[18px]"
              :class="emoji === editEmoji ? 'bg-ink/10 inset-ring inset-ring-ink' : 'hover:bg-fill'"
              :aria-pressed="emoji === editEmoji"
              @click="editEmoji = emoji"
            >
              {{ emoji }}
            </button>
          </div>
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="text-caption text-ink-muted underline underline-offset-2"
              @click="removeAlbum"
            >
              Hapus album
            </button>
            <button
              type="submit"
              class="h-9 rounded-control bg-ink px-4 text-body font-semibold text-white"
            >
              Simpan
            </button>
          </div>
        </form>
      </section>

      <input
        ref="boothInput"
        type="file"
        accept="image/*"
        multiple
        class="sr-only"
        tabindex="-1"
        aria-label="Pilih foto untuk Booth"
        data-testid="booth-upload"
        @change="onBoothFiles"
      />
      <Teleport to="body">
        <BoothResult
          v-if="shots"
          :shots="shots"
          :layout="layout"
          @close="shots = null"
          @retake="shots = null"
        />
      </Teleport>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="sr-only"
        tabindex="-1"
        aria-label="Tambah foto ke album"
        data-testid="album-upload"
        @change="onFiles"
      />
      <p class="mt-10 text-center text-caption text-ink-subtle">
        Semua foto disimpan di perangkat ini saja.
      </p>
    </div>
  </div>
</template>

<style scoped>
.tv-marquee {
  display: inline-block;
  padding-left: 100%;
  animation: tv-marquee 14s linear infinite;
}

@keyframes tv-marquee {
  to {
    transform: translateX(-100%);
  }
}

.tv-filter {
  background-color: rgb(255 255 255 / 0.06);
  color: var(--color-tv-panel-ink);
  transition: background-color 150ms;
}

.tv-filter:hover {
  background-color: rgb(255 255 255 / 0.12);
}

.tv-control {
  height: 40px;
  border-radius: 12px;
  font-family: var(--font-tv);
  font-size: 17px;
  letter-spacing: 0.12em;
  color: var(--color-tv-panel-ink);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.25);
}

.tv-control:hover:not(:disabled) {
  background-color: rgb(255 255 255 / 0.05);
}

.tv-control:disabled {
  opacity: 0.45;
}

.tv-filter[data-state='checked'] {
  background-color: var(--color-tv-accent);
  color: var(--color-white);
}

@media (prefers-reduced-motion: reduce) {
  .tv-marquee {
    padding-left: 0;
    animation: none;
  }
}
</style>
