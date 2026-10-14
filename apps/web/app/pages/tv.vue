<script setup lang="ts">
import { byId, tv } from '@postpocket/presets'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { BOOTH_LAYOUTS, beep, captureShot, type BoothLayout } from '~/utils/booth'
import { ejectKeyframes, followPointer, inside, insertKeyframes, type Box } from '~/utils/cd-flight'
import { photoTime } from '~/utils/exif'
import { PhotoError, decodePhoto, preparePhoto } from '~/utils/front-image'
import { dayAlbum, dayKey, type AlbumView } from '~/utils/memories'

useSeoMeta({ title: 'Memori TV · PostPocket', robots: 'noindex' })
// Sama dengan --color-tv-page di main.css.
usePageTint('bg-tv-page', '#f1f4f8')

/**
 * TV clay (PRD modul 3, referensi Memory TV): pilih album di arsip CD, keluarkan piringannya,
 * lalu seret ke TV atau tekan "Masukkan CD"; piringan terbang ke slot dan TV memutar slideshow
 * dengan filter retro. Album bulanan dibuat otomatis dari Pocket.
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
    // Warna TV hanya kenyamanan; tanpa localStorage tetap pink.
  }
})
watch(clay, (value) => {
  try {
    localStorage.setItem(CLAY_KEY, value)
  } catch {
    // Abaikan.
  }
})
const clayItem = computed(() => byId(tv.clayColors, clay.value) ?? tv.clayColors[0]!)
const clayOptions = tv.clayColors.map((item) => ({
  value: item.id,
  label: item.label,
  color: item.color,
}))

const filterId = ref(tv.filters[0]!.id)
const filter = computed(() => byId(tv.filters, filterId.value) ?? tv.filters[0]!)
// Ganti filter selalu terlihat di layar, juga saat belum ada CD.
const filterOsd = ref('')
let osdTimer: ReturnType<typeof setTimeout> | undefined
watch(filterId, () => {
  filterOsd.value = `FILTER ${filter.value.label.toUpperCase()}`
  clearTimeout(osdTimer)
  osdTimer = setTimeout(() => (filterOsd.value = ''), 1400)
})

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
const shelfOpen = ref(false)
const playingId = ref<string | null>(null)
const playing = computed(() => albums.value.find((album) => album.id === playingId.value))
const current = computed(() => albums.value[shelfIndex.value])

// Sampul tiap CD: foto pertamanya. Dipakai rak dan piringan yang terbang.
const covers = ref<Record<string, string | null>>({})
watch(
  () => albums.value.map((album) => `${album.id}:${album.moments[0] ?? ''}`).join(),
  async () => {
    for (const album of albums.value) {
      const first = album.moments[0]
      const cover = first ? await memories.photoUrl(first) : null
      if (covers.value[album.id] !== cover) covers.value = { ...covers.value, [album.id]: cover }
    }
  },
  { immediate: true },
)

// Slot CD di badan TV: kosong, terbuka (siap menelan piringan), atau berisi.
const slotState = ref<'idle' | 'open' | 'loaded'>('idle')
const busy = ref(false)
watch(playingId, (id) => {
  if (!busy.value) slotState.value = id ? 'loaded' : 'idle'
})

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

// "Putar di TV" dari Kotak surat (/tv?album=<id>): CD foto surat-surat itu langsung diputar.
const albumCd = computed(() =>
  typeof route.query.album === 'string'
    ? albums.value.find((album) => album.id === route.query.album && album.moments.length)
    : undefined,
)
watch(
  () => albumCd.value?.id,
  (id) => {
    if (!id || pocketCd.value) return
    shelfIndex.value = Math.max(
      0,
      albums.value.findIndex((album) => album.id === id),
    )
    playingId.value = id
  },
  { immediate: true },
)

const tvSet = ref<{
  root: HTMLElement | null
  slotEl: HTMLElement | null
  screenEl: HTMLElement | null
} | null>(null)
const shelf = ref<{ disc: HTMLElement | null } | null>(null)
const tvRef = ref<HTMLElement | null>(null)

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const wait = (ms: number) => (reduceMotion() ? Promise.resolve() : sleep(ms))
function boxOf(element: Element): Box {
  const rect = element.getBoundingClientRect()
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

/**
 * Piringan yang sedang diseret atau terbang. Selama itu, piringan di rak disembunyikan supaya
 * tidak ada dua piringan yang sama.
 */
const flying = ref<{ album: AlbumView; box: Box; held: boolean } | null>(null)
const tilt = ref({ x: 0, y: 0 })
const flyer = ref<HTMLElement | null>(null)
const dropActive = ref(false)

/** Terbangkan piringan dari kotak `from` dengan keyframe yang dibuat dari kotak itu. */
async function fly(album: AlbumView, from: Box, frames: (from: Box) => Keyframe[], ms: number) {
  flying.value = { album, box: from, held: false }
  await nextTick()
  const element = flyer.value
  if (!element || reduceMotion()) return
  await element.animate(frames(from), { duration: ms, fill: 'forwards' }).finished.catch(() => {})
}

/** Di HP, rak ada di bawah TV: gulir sampai slot CD kelihatan sebelum piringan terbang. */
async function revealSlot() {
  const slot = tvSet.value?.slotEl
  if (!slot) return
  const rect = slot.getBoundingClientRect()
  if (rect.top >= 60 && rect.bottom <= innerHeight - 40) return
  tvRef.value?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
  await wait(450)
}

/** Setelah CD masuk, layar TV digulir ke pandangan supaya terlihat menyala. */
async function revealScreen() {
  const screen = tvSet.value?.screenEl
  if (!screen) return
  const rect = screen.getBoundingClientRect()
  if (rect.top >= 0 && rect.bottom <= innerHeight) return
  tvRef.value?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
  await wait(420)
}

/** Masukkan CD: piringan keluar dari case, terbang ke slot, lalu TV memutar albumnya. */
async function insert(album: AlbumView) {
  if (busy.value || playingId.value === album.id) return
  // CD kosong tidak bisa diputar: piringannya kembali, dan user diarahkan menambah foto.
  if (!album.moments.length) {
    warn(album, 'CD ini masih kosong. Tambah foto dulu.')
    if (flying.value?.album.id === album.id) await returnDisc(album)
    return
  }
  if (booth.value) closeBooth()
  busy.value = true
  try {
    const fromDrag = flying.value?.album.id === album.id ? flying.value.box : null
    if (playingId.value) {
      // Ganti CD: piringan lama kembali ke case-nya tanpa diterbangkan.
      playingId.value = null
      slotState.value = 'idle'
    }
    let from = fromDrag
    if (!from) {
      // Dari tombol atau keyboard: buka case dulu supaya piringannya terlihat keluar.
      if (current.value?.id === album.id && !shelfOpen.value) {
        shelfOpen.value = true
        await wait(560)
      }
      await revealSlot()
      const disc = current.value?.id === album.id ? shelf.value?.disc : null
      from = disc
        ? boxOf(disc)
        : { left: innerWidth / 2 - 80, top: innerHeight, width: 160, height: 160 }
    }
    const slot = tvSet.value?.slotEl
    slotState.value = 'open'
    if (slot) await fly(album, from, (box) => insertKeyframes(box, boxOf(slot)), 950)
    // Piringannya sudah di dalam TV: tetap tak terlihat di rak sampai TV memutarnya.
    flying.value = { album, box: { left: 0, top: 0, width: 0, height: 0 }, held: false }
    shelfOpen.value = false
    slotState.value = 'loaded'
    await revealScreen()
    playingId.value = album.id
  } finally {
    flying.value = null
    busy.value = false
  }
}

/** Keluarkan CD: piringan keluar dari slot dan kembali ke case-nya di rak, setengah terbuka. */
async function eject() {
  const album = playing.value
  if (busy.value || !album) return
  busy.value = true
  try {
    slotState.value = 'open'
    playingId.value = null
    const index = albums.value.findIndex((item) => item.id === album.id)
    if (index >= 0) shelfIndex.value = index
    await nextTick()
    shelfOpen.value = true
    // Piringannya disembunyikan di rak selama terbang; tunggu case selesai terbuka.
    flying.value = { album, box: { left: 0, top: 0, width: 0, height: 0 }, held: false }
    await wait(560)
    const disc = shelf.value?.disc
    const slot = tvSet.value?.slotEl
    if (disc && slot) {
      const home = boxOf(disc)
      const visible = home.top < innerHeight && home.top + home.height > 0
      // Rak di luar layar (misalnya di HP setelah menonton): jangan terbangkan piringan ke tempat
      // yang tidak terlihat. Piringan keluar dari slot, turun sedikit, lalu menghilang.
      const mouth = boxOf(slot)
      const to = visible
        ? home
        : {
            left: mouth.left + mouth.width / 2 - home.width / 2,
            top: mouth.top + mouth.height + 24,
            width: home.width,
            height: home.height,
          }
      await fly(
        album,
        to,
        (box) => {
          const frames = ejectKeyframes(boxOf(slot), box)
          if (!visible) frames[frames.length - 1] = { ...frames.at(-1)!, opacity: 0 }
          return frames
        },
        850,
      )
      if (!visible) warn(album, 'CD dikeluarkan dan kembali ke Arsip CD.', 'ok')
    }
    slotState.value = 'idle'
  } finally {
    flying.value = null
    busy.value = false
  }
}

// Seret piringan ke TV. Ketukan tanpa geser langsung memasukkan CD.
let drag: {
  album: AlbumView
  pointerId: number
  start: { x: number; y: number }
  grab: { x: number; y: number }
  origin: Box
  last: { x: number; y: number; t: number }
  moved: boolean
} | null = null
let scrollFrame = 0

function onGrab(album: AlbumView, event: PointerEvent, element: HTMLElement) {
  if (busy.value || drag || event.button !== 0) return
  event.preventDefault()
  const origin = boxOf(element)
  drag = {
    album,
    pointerId: event.pointerId,
    start: { x: event.clientX, y: event.clientY },
    grab: { x: event.clientX - origin.left, y: event.clientY - origin.top },
    origin,
    last: { x: event.clientX, y: event.clientY, t: performance.now() },
    moved: false,
  }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragCancel)
  window.addEventListener('keydown', onDragKey)
}

function overTv(point: { x: number; y: number }) {
  const root = tvSet.value?.root
  return !!root && inside(point, boxOf(root), 16)
}

function onDragMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return
  const point = { x: event.clientX, y: event.clientY }
  if (!drag.moved) {
    if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < 6) return
    drag.moved = true
    flying.value = { album: drag.album, box: drag.origin, held: true }
  }
  // Piringan sedikit miring mengikuti arah gerakan, seperti dipegang.
  const now = performance.now()
  const dt = Math.max(16, now - drag.last.t)
  const clamp = (value: number) => Math.max(-16, Math.min(16, value))
  tilt.value = {
    x: clamp((-(point.y - drag.last.y) / dt) * 14),
    y: clamp(((point.x - drag.last.x) / dt) * 14),
  }
  drag.last = { ...point, t: now }
  if (flying.value)
    flying.value = { ...flying.value, box: followPointer(flying.value.box, drag.grab, point) }
  dropActive.value = overTv(point)
  slotState.value = dropActive.value ? 'open' : playingId.value ? 'loaded' : 'idle'
  autoScroll(point)
}

/** Seret ke dekat tepi atas atau bawah layar: halaman ikut bergulir (TV di HP ada di atas rak). */
function autoScroll(point: { x: number; y: number }) {
  cancelAnimationFrame(scrollFrame)
  const edge = 72
  const speed =
    point.y < edge
      ? -(edge - point.y) / 4
      : point.y > innerHeight - edge
        ? (point.y - innerHeight + edge) / 4
        : 0
  if (!speed) return
  const step = () => {
    if (!drag?.moved) return
    window.scrollBy(0, speed)
    dropActive.value = overTv(point)
    scrollFrame = requestAnimationFrame(step)
  }
  scrollFrame = requestAnimationFrame(step)
}

function stopDrag() {
  cancelAnimationFrame(scrollFrame)
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragCancel)
  window.removeEventListener('keydown', onDragKey)
  tilt.value = { x: 0, y: 0 }
}

async function onDragEnd(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return
  const { album, moved } = drag
  drag = null
  stopDrag()
  if (!moved) return insert(album)
  const over = dropActive.value
  dropActive.value = false
  if (over) return insert(album)
  await returnDisc(album)
}

function onDragCancel(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return
  const { album, moved } = drag
  drag = null
  stopDrag()
  dropActive.value = false
  if (moved) returnDisc(album)
}

function onDragKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !drag) return
  const { album, moved } = drag
  drag = null
  stopDrag()
  dropActive.value = false
  if (moved) returnDisc(album)
}

/** Dilepas di luar TV: piringan kembali ke tempatnya di luar case. */
async function returnDisc(album: AlbumView) {
  slotState.value = playingId.value ? 'loaded' : 'idle'
  const from = flying.value?.box
  const disc = shelf.value?.disc
  if (from && disc) {
    const to = boxOf(disc)
    await fly(
      album,
      from,
      () => [
        { transform: 'translate(0, 0) scale(1.06)' },
        { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(1)` },
      ],
      320,
    )
  }
  flying.value = null
}

onBeforeUnmount(stopDrag)

/** Dari layar TV yang kosong ke rak CD; CD yang terpilih melonjak kecil supaya kelihatan. */
const nudge = ref(0)
async function goToShelf() {
  const heading = document.getElementById('arsip-title')
  heading?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
  await wait(400)
  ;(document.querySelector('[data-testid="cd-shelf"]') as HTMLElement | null)?.focus({
    preventScroll: true,
  })
  nudge.value++
}

// "+ Foto": foto disimpan sebagai momen hari ini (di bulan album itu, atau di kantong yang sedang
// diputar), lalu masuk album. Hasilnya diberitahukan, dan fotonya tampil di deretan isi CD.
const fileInput = ref<HTMLInputElement | null>(null)
const target = ref<AlbumView | null>(null)
const adding = ref(false)
const fresh = ref<string[]>([])
let noticeTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Kabar di bawah tombol rak, milik satu CD: kalau user pindah CD, kabarnya tidak ikut tampil.
 * `ok` untuk kabar berhasil (bercentang), `warn` untuk yang perlu dilakukan user.
 */
const status = ref<{ albumId: string; text: string; tone: 'ok' | 'warn' } | null>(null)
function warn(album: AlbumView, text: string, tone: 'ok' | 'warn' = 'warn') {
  status.value = { albumId: album.id, text, tone }
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    status.value = null
    fresh.value = []
  }, 6000)
}

/** Kabar foto yang baru masuk CD, dan tandai fotonya di deretan isi CD. */
function announce(ids: string[], album: AlbumView) {
  fresh.value = ids
  warn(album, `${ids.length} foto masuk ke ${album.title}.`, 'ok')
}

/** Hasil Booth masuk CD: rak memilih CD itu supaya langsung kelihatan setelah keluar Booth. */
async function onBoothCd(albumId: string, ids: string[]) {
  await nextTick()
  const index = albums.value.findIndex((item) => item.id === albumId)
  if (index >= 0) shelfIndex.value = index
  const album = albums.value[index]
  if (album) announce(ids, album)
}

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
  status.value = null
  try {
    const photos = []
    for (const file of files) {
      const takenAt = await photoTime(file)
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
    // CD kosong pertama (rak belum berisi apa-apa) menjadi CD bulan ini, bukan album kedua yang
    // isinya sama.
    const selectId = album.id === NEW_ALBUM.id ? `bulan-${day.slice(0, 7)}` : album.id
    if (album.kind === 'custom' && album.id !== NEW_ALBUM.id)
      await memories.addToAlbum(album.id, ids)
    else if (album.kind === 'day' && pocket)
      await memories.saveDay({ ...pocket, moments: [...pocket.moments, ...ids] })
    // Rak tetap menunjuk CD yang baru diisi, walaupun urutan rak berubah.
    await nextTick()
    const index = albums.value.findIndex((item) => item.id === selectId)
    if (index >= 0) shelfIndex.value = index
    const filled = albums.value[index]
    if (filled) announce(ids, filled)
  } catch (problem) {
    warn(album, problem instanceof PhotoError ? problem.message : 'Foto gagal disimpan.')
  } finally {
    adding.value = false
  }
}

// Edit album buatan sendiri: nama, emoji, atau hapus.
const editing = ref(false)
const editTitle = ref('')
const editEmoji = ref('📀')
const EMOJIS = ['📀', '💖', '🌸', '🌊', '🎂', '✈️', '🐱', '🌙']
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

/** CD buatan sendiri (PRD: album sendiri), langsung dipilih dan siap diberi nama. */
async function newAlbum() {
  const created = await memories.createAlbum('CD baru', '📀')
  await nextTick()
  const index = albums.value.findIndex((item) => item.id === created.id)
  if (index >= 0) shelfIndex.value = index
  await nextTick()
  startEdit()
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
const recording = ref(false)
const countdown = ref<number | null>(null)
/** Jepretan ke berapa dari berapa, selama Booth memotret. */
const progress = ref<{ shot: number; total: number } | null>(null)
const recordButton = ref<HTMLButtonElement | null>(null)
const flash = ref(0)
const shots = ref<HTMLCanvasElement[] | null>(null)
/** Jepretan yang sudah diambil, kecil, untuk pratinjau tata letak di layar. */
const captured = ref<string[]>([])
const camera = ref<{ video: HTMLVideoElement | null } | null>(null)
const boothInput = ref<HTMLInputElement | null>(null)
onMounted(() => {
  if (route.query.booth !== undefined) openBooth()
})
watch(layout, () => (captured.value = []))

function openBooth() {
  booth.value = true
  cameraReady.value = false
  cameraError.value = ''
  captured.value = []
}

// Di layar HP yang pendek, tombol REKAM ada di bawah layar kamera; gulir sampai kelihatan.
function onCameraReady() {
  cameraReady.value = true
  nextTick(() =>
    recordButton.value?.scrollIntoView({
      behavior: reduceMotion() ? 'auto' : 'smooth',
      block: 'nearest',
    }),
  )
}

function closeBooth() {
  booth.value = false
  cameraReady.value = false
}

// Back di HP menutup Booth dan kembali ke TV, bukan meninggalkan halaman. Selama merekam, Back
// diabaikan supaya jepretan tidak terpotong.
useBackToClose(booth, () => {
  if (recording.value) return false
  closeBooth()
})

function switchCamera() {
  facing.value = facing.value === 'user' ? 'environment' : 'user'
  cameraReady.value = false
}

/** Gambar kecil satu jepretan untuk petak pratinjau. */
function thumbnail(shot: HTMLCanvasElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = Math.round((160 * shot.height) / shot.width)
  canvas.getContext('2d')?.drawImage(shot, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.7)
}

/** Hitung mundur 3-2-1 dengan bunyi klik, lalu jepret berjeda 1 detik (PRD). */
async function record() {
  const video = camera.value?.video
  if (!video || recording.value) return
  recording.value = true
  captured.value = []
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
      progress.value = { shot: shot + 1, total }
      flash.value++
      beep(1320, 0.05)
      const canvas = captureShot(video, filter.value, facing.value === 'user')
      taken.push(canvas)
      captured.value = [...captured.value, thumbnail(canvas)]
      if (shot < total - 1) await sleep(1000)
    }
    // Petak terakhir sempat terlihat terisi sebelum hasilnya muncul.
    await sleep(400)
    shots.value = taken
  } finally {
    recording.value = false
    countdown.value = null
    progress.value = null
  }
}

function closeResult() {
  shots.value = null
  captured.value = []
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

const boothHint = computed(() =>
  !booth.value
    ? 'Putar kenangan dari kantongmu'
    : cameraError.value
      ? 'Kamera mati, pakai foto dari galeri'
      : 'Pilih tata letak, lalu tekan Rekam',
)

const marquee = computed(() =>
  booth.value
    ? progress.value
      ? `● MEMOTRET · FOTO ${progress.value.shot} DARI ${progress.value.total}`
      : countdown.value !== null
        ? '● BERSIAP · LIHAT KE KAMERA'
        : cameraError.value
          ? '● KAMERA MATI · PILIH FOTO DARI GALERI'
          : '● PHOTO BOOTH · PILIH TATA LETAK LALU TEKAN REKAM'
    : dropActive.value
      ? '▼ LEPAS DI SINI UNTUK MEMUTAR'
      : playing.value
        ? `♪ SEDANG DIPUTAR · ${playing.value.title.toUpperCase()} · ${playing.value.moments.length} FOTO ♪`
        : 'BELUM ADA CD · PILIH ALBUM DI ARSIP LALU MASUKKAN',
)
// Kecepatan teks berjalan tetap, berapa pun panjangnya.
const marqueeSeconds = computed(() => Math.max(8, marquee.value.length * 0.3))
</script>

<template>
  <div class="min-h-dvh bg-tv-page">
    <main class="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <header class="py-4">
        <NuxtLink
          to="/"
          class="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-body text-ink-muted hover:text-ink"
        >
          <Icon name="chevron-left" :size="14" /> PostPocket
        </NuxtLink>
      </header>

      <div class="text-center">
        <!-- Halaman yang sama dipakai TV dan Booth; judulnya mengikuti yang sedang dibuka. -->
        <h1 class="text-[clamp(36px,10vw,56px)] leading-none font-bold tracking-[-0.035em]">
          {{ booth ? 'Booth' : 'Memori TV' }}
        </h1>
        <p class="mt-3 text-[14px] text-ink-muted" data-testid="tv-subtitle">
          {{ boothHint }}
        </p>
      </div>

      <div ref="tvRef" class="scroll-mt-4">
        <TvSet
          ref="tvSet"
          class="mt-6"
          :clay="clayItem.color"
          :slot-state="slotState"
          :drop="dropActive"
        >
          <template #screen>
            <template v-if="booth">
              <BoothCamera
                v-if="!cameraError"
                ref="camera"
                :filter="filter"
                :facing="facing"
                :countdown="countdown"
                :progress="progress"
                :flash="flash"
                :layout="layout"
                :captured="captured"
                @ready="onCameraReady"
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
            <template v-else>
              <TvIdle />
              <!-- Layar kosong diketuk: bawa ke rak CD, tempat CD dipilih. -->
              <button
                type="button"
                class="absolute inset-0 z-[1] cursor-pointer"
                aria-label="Pilih CD di Arsip CD"
                data-testid="tv-pick-cd"
                @click="goToShelf"
              />
            </template>
            <p v-if="filterOsd" class="tv-filter-osd" aria-hidden="true">{{ filterOsd }}</p>
            <!-- Piringan diseret di atas TV: layar memberi tahu bahwa ia siap menerima. -->
            <div v-if="dropActive" class="tv-drop-hint" aria-hidden="true">
              <span>LEPAS UNTUK MEMUTAR</span>
            </div>
          </template>
          <template #panel>
            <div class="overflow-hidden rounded-[10px] bg-black/40 py-1.5" aria-live="polite">
              <span class="sr-only">{{ marquee }}</span>
              <div
                class="tv-marquee font-tv text-[18px] tracking-[0.12em] whitespace-nowrap text-tv-glow"
                :style="{ animationDuration: `${marqueeSeconds}s` }"
                aria-hidden="true"
              >
                <span>{{ marquee }}</span>
                <span>{{ marquee }}</span>
              </div>
            </div>
            <p class="-mb-1 font-tv text-[14px] tracking-[0.2em] text-white/55" aria-hidden="true">
              FILTER
            </p>
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
                <!-- Tiap pilihan tata letak menunjukkan bentuk hasilnya. -->
                <RadioGroupRoot
                  v-model="layout"
                  aria-label="Tata letak Booth"
                  class="grid grid-cols-3 gap-1.5"
                  loop
                  :disabled="recording"
                >
                  <RadioGroupItem
                    v-for="item in BOOTH_LAYOUTS"
                    :key="item.value"
                    :value="item.value"
                    :aria-label="item.label"
                    class="tv-filter tv-layout"
                  >
                    <span class="tv-layout__shape" :class="`is-${item.value}`" aria-hidden="true">
                      <span v-for="n in item.shots" :key="n" />
                    </span>
                    <span aria-hidden="true">{{ item.label }}</span>
                  </RadioGroupItem>
                </RadioGroupRoot>
                <button
                  ref="recordButton"
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
                    aria-label="Ganti kamera"
                    @click="switchCamera"
                  >
                    ⇄ KAMERA
                  </button>
                  <button
                    type="button"
                    class="tv-control"
                    :disabled="recording"
                    @click="closeBooth"
                  >
                    KELUAR
                  </button>
                </div>
              </template>
              <template v-else>
                <button
                  v-if="playing"
                  type="button"
                  class="tv-control inline-flex items-center justify-center gap-2"
                  :disabled="busy"
                  @click="eject"
                >
                  <Icon name="eject" :size="15" /> KELUARKAN CD
                </button>
                <button
                  type="button"
                  class="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] font-tv text-[20px] tracking-[0.16em] text-tv-glow inset-ring-2 inset-ring-tv-glow hover:bg-tv-glow/10"
                  @click="openBooth"
                >
                  <Icon name="camera" :size="18" /> PHOTO BOOTH
                </button>
              </template>
            </div>
          </template>
        </TvSet>
      </div>

      <div class="mt-6 flex justify-center">
        <div
          class="flex flex-col items-center gap-2 rounded-[24px] bg-surface px-4 py-3 shadow-raised sm:flex-row sm:gap-3 sm:rounded-full sm:py-2 sm:pr-3"
        >
          <p class="text-caption text-ink-muted">
            Warna TV <span class="font-semibold text-ink">{{ clayItem.label }}</span>
          </p>
          <SwatchGroup
            v-model="clay"
            label="Warna TV"
            :options="clayOptions"
            size="sm"
            class="max-sm:gap-1.5"
          />
        </div>
      </div>

      <section class="mt-10" aria-labelledby="arsip-title">
        <div class="mb-2 flex items-center gap-2">
          <h2 id="arsip-title" class="text-[17px] font-bold tracking-[-0.02em]">Arsip CD</h2>
          <button
            type="button"
            class="ml-auto inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-caption font-semibold text-ink-muted hover:bg-fill hover:text-ink"
            @click="newAlbum"
          >
            <Icon name="plus" :size="13" /> CD baru
          </button>
          <button
            v-if="canEdit"
            type="button"
            class="rounded-full bg-surface px-3 py-1 text-caption font-semibold inset-ring inset-ring-line hover:bg-panel"
            @click="editing ? (editing = false) : startEdit()"
          >
            {{ editing ? 'Selesai' : 'Ubah' }}
          </button>
        </div>
        <ClientOnly>
          <CdShelf
            ref="shelf"
            v-model="shelfIndex"
            v-model:open="shelfOpen"
            :albums="albums"
            :covers="covers"
            :playing="playingId"
            :away="flying?.album.id ?? null"
            :fresh="fresh"
            :nudge="nudge"
            :booth-open="booth"
            :busy="busy"
            @insert="insert"
            @eject="eject"
            @add="addPhotos"
            @grab="onGrab"
          >
            <!-- Kabar "+ Foto" tepat di bawah tombolnya, di atas deretan foto yang baru masuk. -->
            <template #status>
              <div class="mt-3 min-h-5 text-center text-caption" aria-live="polite">
                <p v-if="adding" class="text-ink-muted">Menyimpan foto…</p>
                <p
                  v-else-if="status && status.albumId === current?.id"
                  class="inline-flex items-center gap-1.5 font-semibold text-ink"
                  :data-tone="status.tone"
                  data-testid="cd-notice"
                >
                  <Icon v-if="status.tone === 'ok'" name="check" :size="14" />
                  {{ status.text }}
                </p>
              </div>
            </template>
          </CdShelf>
        </ClientOnly>

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
              class="-ml-1 min-h-10 px-1 text-caption text-ink-muted underline underline-offset-2"
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
          @close="closeResult"
          @retake="closeResult"
          @cd="onBoothCd"
        />
        <!-- Piringan yang sedang diseret atau terbang ke slot TV. -->
        <div
          v-if="flying && flying.box.width"
          ref="flyer"
          class="cd-flyer"
          :class="{ 'is-held': flying.held }"
          :style="{
            left: `${flying.box.left}px`,
            top: `${flying.box.top}px`,
            width: `${flying.box.width}px`,
            '--tilt-x': `${tilt.x}deg`,
            '--tilt-y': `${tilt.y}deg`,
          }"
          aria-hidden="true"
        >
          <CdDisc
            :cover="covers[flying.album.id] ?? null"
            :emoji="flying.album.emoji"
            :spinning="flying.held"
          />
        </div>
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
      <p class="mt-10 text-center text-caption text-ink-muted">
        Semua foto disimpan di perangkat ini saja.
      </p>
    </main>
  </div>
</template>

<style scoped>
/* Teks berjalan dua salinan yang bersambung, jadi tidak pernah ada jeda kosong. */
.tv-marquee {
  display: flex;
  width: max-content;
  animation: tv-marquee 14s linear infinite;
}

.tv-marquee span {
  padding-right: 3em;
}

@keyframes tv-marquee {
  to {
    transform: translateX(-50%);
  }
}

.tv-filter-osd {
  position: absolute;
  top: 9%;
  left: 50%;
  z-index: 3;
  margin: 0;
  padding: 2px 12px;
  border-radius: 6px;
  background: rgb(0 0 0 / 0.55);
  font-family: var(--font-tv);
  font-size: clamp(16px, 3vw, 22px);
  letter-spacing: 0.14em;
  color: #7dffb6;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}

.tv-drop-hint {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: end center;
  padding-bottom: 7%;
  background: linear-gradient(to top, rgb(0 0 0 / 0.55), transparent 45%);
  font-family: var(--font-tv);
  font-size: clamp(18px, 3.4vw, 26px);
  letter-spacing: 0.12em;
  color: var(--color-white);
  pointer-events: none;
}

.tv-drop-hint span {
  animation: drop-blink 1s steps(2, jump-none) infinite;
}

@keyframes drop-blink {
  50% {
    opacity: 0.35;
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

.tv-filter[data-state='checked'] {
  background-color: var(--color-tv-accent);
  color: var(--color-white);
}

.tv-filter[data-disabled] {
  opacity: 0.6;
}

/* Pilihan tata letak Booth: gambar kecil bentuk hasilnya, lalu namanya. */
.tv-layout {
  display: flex;
  min-height: 58px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-radius: 10px;
  padding: 6px 4px;
  font-family: var(--font-tv);
  font-size: 14px;
  letter-spacing: 0.04em;
  line-height: 1;
  text-transform: uppercase;
}

.tv-layout__shape {
  display: grid;
  gap: 2px;
  padding: 2px 2px 4px;
  border-radius: 2px;
  background: rgb(255 255 255 / 0.85);
}

.tv-layout__shape span {
  border-radius: 1px;
  background: rgb(24 32 74 / 0.55);
}

.tv-layout__shape.is-strip {
  grid-template-rows: repeat(4, 5px);
  width: 12px;
}

.tv-layout__shape.is-grid {
  grid-template-columns: repeat(2, 9px);
  grid-template-rows: repeat(2, 7px);
}

.tv-layout__shape.is-single {
  grid-template-columns: 20px;
  grid-template-rows: 15px;
}

.tv-control {
  height: 40px;
  border-radius: 12px;
  font-family: var(--font-tv);
  font-size: 16px;
  letter-spacing: 0.08em;
  white-space: nowrap;
  color: var(--color-tv-panel-ink);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.25);
}

.tv-control:hover:not(:disabled) {
  background-color: rgb(255 255 255 / 0.05);
}

.tv-control:disabled {
  opacity: 0.45;
}

/* Piringan di tangan: sedikit membesar, berbayang, dan miring mengikuti gerakan. */
.cd-flyer {
  position: fixed;
  z-index: 60;
  pointer-events: none;
  will-change: transform;
}

.cd-flyer.is-held {
  filter: drop-shadow(0 24px 22px rgb(24 32 74 / 0.35));
  transform: perspective(800px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y)) scale(1.07);
  transition: transform 90ms linear;
}

@media (prefers-reduced-motion: reduce) {
  .tv-marquee {
    animation: none;
  }

  .tv-marquee span + span {
    display: none;
  }

  .tv-drop-hint span {
    animation: none;
  }

  .cd-flyer.is-held {
    transition: none;
  }
}
</style>
