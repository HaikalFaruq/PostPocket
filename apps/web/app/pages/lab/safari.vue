<script setup lang="ts">
import { tv } from '@postpocket/presets'

useSeoMeta({ title: 'Cek Safari · PostPocket', robots: 'noindex' })

type Status = 'ok' | 'warn' | 'fail'
interface Check {
  id: string
  label: string
  status: Status
  detail: string
}

const checks = ref<Check[]>([])
const copied = ref(false)

/** Gambar warna polos lewat drawImage dengan `ctx.filter`, lalu lihat apakah pikselnya berubah. */
function filterChangesPixels(filter: string): boolean {
  const source = document.createElement('canvas')
  source.width = source.height = 8
  const sctx = source.getContext('2d')
  if (!sctx) return false
  sctx.fillStyle = 'rgb(200, 60, 40)'
  sctx.fillRect(0, 0, 8, 8)
  const target = document.createElement('canvas')
  target.width = target.height = 8
  const ctx = target.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.filter = filter
  ctx.drawImage(source, 0, 0)
  const [r, g, b] = ctx.getImageData(4, 4, 1, 1).data
  return !(r === 200 && g === 60 && b === 40)
}

async function indexedDbWorks(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('postpocket-lab', 1)
      request.onsuccess = () => {
        request.result.close()
        resolve(true)
      }
      request.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

async function runChecks() {
  const list: Check[] = []
  const add = (id: string, label: string, status: Status, detail: string) =>
    list.push({ id, label, status, detail })

  add(
    'secure',
    'Konteks aman (HTTPS)',
    window.isSecureContext ? 'ok' : 'warn',
    window.isSecureContext
      ? 'Kamera boleh dipakai.'
      : 'Buka lewat HTTPS atau localhost supaya kamera bisa dipakai.',
  )

  const hasFilter = 'filter' in CanvasRenderingContext2D.prototype
  const grayscale = hasFilter && filterChangesPixels('grayscale(1)')
  add(
    'ctx-filter',
    'ctx.filter di kanvas',
    grayscale ? 'ok' : 'fail',
    grayscale
      ? 'Filter diterapkan ke piksel.'
      : hasFilter
        ? 'Properti ada tapi piksel tidak berubah: siapkan jalur shader WebGL.'
        : 'Tidak didukung: siapkan jalur shader WebGL.',
  )

  for (const filter of tv.filters) {
    const changed = filterChangesPixels(filter.css)
    const expected = filter.css !== 'none'
    add(
      `filter-${filter.id}`,
      `Filter ${filter.label}`,
      changed === expected ? 'ok' : 'fail',
      `${filter.css} → ${changed ? 'piksel berubah' : 'piksel tetap'}`,
    )
  }

  const offscreen =
    typeof OffscreenCanvas !== 'undefined' &&
    typeof OffscreenCanvasRenderingContext2D !== 'undefined' &&
    'filter' in OffscreenCanvasRenderingContext2D.prototype
  add(
    'offscreen',
    'OffscreenCanvas + filter',
    offscreen ? 'ok' : 'warn',
    offscreen ? 'Bisa memproses foto di Web Worker.' : 'Proses foto di thread utama saja.',
  )

  const webgl2 = !!document.createElement('canvas').getContext('webgl2')
  add(
    'webgl2',
    'WebGL2',
    webgl2 ? 'ok' : 'warn',
    webgl2 ? 'Jalur shader cadangan tersedia.' : 'Tidak ada WebGL2.',
  )

  const camera = !!navigator.mediaDevices?.getUserMedia
  add(
    'camera',
    'getUserMedia',
    camera ? 'ok' : 'fail',
    camera ? 'API kamera ada.' : 'API kamera tidak ada.',
  )

  const persist = typeof navigator.storage?.persist === 'function'
  const persisted = persist ? await navigator.storage.persisted() : false
  add(
    'persist',
    'navigator.storage.persist',
    persist ? 'ok' : 'warn',
    persist
      ? `Tersedia; status sekarang: ${persisted ? 'persisten' : 'belum persisten'}.`
      : 'Tidak tersedia.',
  )

  const idb = await indexedDbWorks()
  add(
    'indexeddb',
    'IndexedDB',
    idb ? 'ok' : 'fail',
    idb ? 'Bisa membuka database.' : 'Gagal membuka database.',
  )

  add(
    'bitmap',
    'createImageBitmap',
    typeof createImageBitmap === 'function' ? 'ok' : 'warn',
    typeof createImageBitmap === 'function' ? 'Tersedia.' : 'Tidak tersedia.',
  )

  checks.value = list
}

// Bandingkan jalur cadangan (matriks warna di JS) dengan ctx.filter asli browser.
interface Accuracy {
  id: string
  label: string
  max: number
  mean: number
}
const accuracy = ref<Accuracy[]>([])
const nativeFilter = ref(false)

function testImage(width = 96, height = 64): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  for (let x = 0; x < width; x++) {
    const hue = (x / width) * 360
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, `hsl(${hue} 90% 88%)`)
    gradient.addColorStop(0.5, `hsl(${hue} 80% 50%)`)
    gradient.addColorStop(1, `hsl(${hue} 70% 12%)`)
    ctx.fillStyle = gradient
    ctx.fillRect(x, 0, 1, height)
  }
  return canvas
}

function compareFallback() {
  nativeFilter.value = canvasFilterSupported()
  if (!nativeFilter.value) return
  const source = testImage()
  const { width, height } = source
  const read = (draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return new Uint8ClampedArray()
    draw(ctx)
    return ctx.getImageData(0, 0, width, height).data
  }
  accuracy.value = tv.filters.map((filter) => {
    const native = read((ctx) => {
      ctx.filter = filter.css
      ctx.drawImage(source, 0, 0)
    })
    const fallback = read((ctx) => ctx.drawImage(source, 0, 0))
    applyFilterSteps(fallback, width, height, parseCssFilter(filter.css))
    // Tepi 4 px dilewati: blur asli memudar ke transparan di luar gambar.
    let max = 0
    let sum = 0
    let count = 0
    for (let y = 4; y < height - 4; y++) {
      for (let x = 4; x < width - 4; x++) {
        for (let ch = 0; ch < 3; ch++) {
          const i = (y * width + x) * 4 + ch
          const diff = Math.abs((native[i] ?? 0) - (fallback[i] ?? 0))
          max = Math.max(max, diff)
          sum += diff
          count++
        }
      }
    }
    return { id: filter.id, label: filter.label, max, mean: Math.round((sum / count) * 100) / 100 }
  })
}

onMounted(() => {
  runChecks()
  compareFallback()
})

// Uji kamera: filter CSS di video dibandingkan dengan hasil ekspor kanvas memakai ctx.filter.
const filterId = ref('kodak')
const filterCss = computed(() => tv.filters.find((f) => f.id === filterId.value)?.css ?? 'none')
const filterOptions = tv.filters.map((f) => ({ value: f.id, label: f.label }))
const facing = ref<'user' | 'environment'>('user')
const video = ref<HTMLVideoElement | null>(null)
const stream = shallowRef<MediaStream | null>(null)
const cameraError = ref('')
const capture = ref('')

async function startCamera() {
  stopCamera()
  cameraError.value = ''
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing.value },
      audio: false,
    })
    if (video.value) {
      video.value.srcObject = stream.value
      await video.value.play()
    }
  } catch (error) {
    const name = error instanceof DOMException ? error.name : ''
    cameraError.value =
      name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Kamu tetap bisa upload foto di bawah.'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'Kamera tidak ditemukan di perangkat ini.'
          : `Kamera gagal dibuka (${name || 'tidak diketahui'}).`
  }
}

function stopCamera() {
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
}

async function switchCamera() {
  facing.value = facing.value === 'user' ? 'environment' : 'user'
  if (stream.value) await startCamera()
}

function drawWithFilter(source: CanvasImageSource, width: number, height: number, mirror: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  drawFiltered(ctx, source, width, height, filterCss.value, { mirror })
  capture.value = canvas.toDataURL('image/jpeg', 0.9)
}

function takePhoto() {
  const el = video.value
  if (!el || !el.videoWidth) return
  drawWithFilter(el, el.videoWidth, el.videoHeight, facing.value === 'user')
}

async function onUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  drawWithFilter(bitmap, Math.round(bitmap.width * scale), Math.round(bitmap.height * scale), false)
  bitmap.close()
}

onBeforeUnmount(stopCamera)

async function copyResults() {
  const lines = checks.value.map((c) => `${c.status.toUpperCase()}  ${c.label}: ${c.detail}`)
  await navigator.clipboard.writeText(
    `PostPocket cek Safari\n${navigator.userAgent}\n\n${lines.join('\n')}`,
  )
  copied.value = true
  setTimeout(() => (copied.value = false), 1600)
}

const badge: Record<Status, string> = {
  ok: 'bg-[#e3f2dc] text-[#2f5d22]',
  warn: 'bg-[#fbefd2] text-[#7a5a14]',
  fail: 'bg-[#f8dcdc] text-[#8a2323]',
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <NuxtLink
      to="/lab"
      class="inline-flex items-center gap-1 text-caption text-ink-muted hover:text-ink"
    >
      <Icon name="chevron-left" :size="14" /> Lab
    </NuxtLink>
    <h1 class="mt-3 text-title font-semibold">Cek Safari: kanvas dan kamera</h1>
    <p class="mt-1 text-ink-muted">
      Buka halaman ini di Safari iOS dan Chrome Android. Hasilnya dipakai untuk memutuskan apakah
      filter Booth cukup memakai <code class="font-mono">ctx.filter</code> atau perlu shader WebGL.
    </p>

    <section
      aria-labelledby="checks-title"
      class="mt-6 overflow-hidden rounded-card bg-surface shadow-raised"
    >
      <div class="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3">
        <h2 id="checks-title" class="text-body font-semibold">Fitur browser</h2>
        <button
          type="button"
          class="text-caption text-ink-muted underline underline-offset-2 hover:text-ink"
          @click="copyResults"
        >
          {{ copied ? 'Tersalin' : 'Salin hasil' }}
        </button>
      </div>
      <ul class="divide-y divide-line-soft" data-testid="checks">
        <li
          v-for="check in checks"
          :key="check.id"
          class="flex items-start gap-3 px-5 py-2.5"
          :data-check="check.id"
          :data-status="check.status"
        >
          <span
            class="mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase"
            :class="badge[check.status]"
            >{{ check.status }}</span
          >
          <div class="min-w-0">
            <p class="font-medium">{{ check.label }}</p>
            <p class="text-caption break-words text-ink-muted">{{ check.detail }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section
      aria-labelledby="fallback-title"
      class="mt-6 rounded-card bg-surface p-5 shadow-raised"
    >
      <h2 id="fallback-title" class="text-body font-semibold">Jalur cadangan filter</h2>
      <p class="mt-1 text-caption text-ink-muted">
        Browser tanpa <code class="font-mono">ctx.filter</code> memakai matriks warna di JS (<code
          class="font-mono"
          >drawFiltered</code
        >). Di browser yang punya <code class="font-mono">ctx.filter</code>, hasil keduanya
        dibandingkan per piksel (selisih 0–255).
      </p>
      <p
        v-if="!nativeFilter"
        class="mt-3 rounded-control bg-fill px-3 py-2 text-caption text-ink-muted"
        data-testid="fallback-active"
      >
        Browser ini tidak punya ctx.filter, jadi ekspor foto di bawah memakai jalur cadangan.
      </p>
      <table v-else class="mt-3 w-full text-left text-caption" data-testid="fallback-table">
        <thead class="text-ink-subtle">
          <tr>
            <th class="py-1 font-medium">Filter</th>
            <th class="py-1 font-medium">Selisih maks</th>
            <th class="py-1 font-medium">Rata-rata</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in accuracy"
            :key="row.id"
            class="border-t border-line-soft"
            :data-fallback="row.id"
            :data-max="row.max"
          >
            <td class="py-1.5">{{ row.label }}</td>
            <td class="py-1.5 font-mono">{{ row.max }}</td>
            <td class="py-1.5 font-mono">{{ row.mean }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section aria-labelledby="camera-title" class="mt-6 rounded-card bg-surface p-5 shadow-raised">
      <h2 id="camera-title" class="text-body font-semibold">Kamera dan filter</h2>
      <p class="mt-1 text-caption text-ink-muted">
        Kiri: video dengan CSS filter. Kanan: hasil ambil foto lewat
        <code class="font-mono">ctx.filter</code>. Keduanya harus terlihat sama.
      </p>
      <div class="mt-3">
        <PillGroup v-model="filterId" label="Filter foto" :options="filterOptions" />
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          class="h-9 rounded-control bg-ink px-3.5 text-body font-medium text-white"
          @click="startCamera"
        >
          {{ stream ? 'Mulai ulang kamera' : 'Nyalakan kamera' }}
        </button>
        <button
          type="button"
          class="h-9 rounded-control bg-surface px-3.5 text-body inset-ring inset-ring-line"
          @click="switchCamera"
        >
          Ganti ke kamera {{ facing === 'user' ? 'belakang' : 'depan' }}
        </button>
        <button
          type="button"
          class="h-9 rounded-control bg-surface px-3.5 text-body inset-ring inset-ring-line disabled:opacity-40"
          :disabled="!stream"
          @click="takePhoto"
        >
          Ambil foto
        </button>
      </div>
      <p
        v-if="cameraError"
        role="alert"
        class="mt-3 rounded-control bg-[#fbefd2] px-3 py-2 text-caption text-[#7a5a14]"
      >
        {{ cameraError }}
      </p>
      <label class="mt-3 inline-flex cursor-pointer items-center gap-2 text-caption text-ink-muted">
        <Icon name="upload" :size="14" /> Atau upload foto
        <input type="file" accept="image/*" capture="user" class="sr-only" @change="onUpload" />
      </label>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="aspect-[3/4] overflow-hidden rounded-control bg-fill">
          <video
            ref="video"
            class="size-full object-cover"
            :class="facing === 'user' && '-scale-x-100'"
            :style="{ filter: filterCss }"
            muted
            playsinline
            autoplay
          />
        </div>
        <div
          class="grid aspect-[3/4] place-items-center overflow-hidden rounded-control bg-fill text-caption text-ink-subtle"
        >
          <img
            v-if="capture"
            :src="capture"
            alt="Hasil foto dengan filter"
            class="size-full object-cover"
          />
          <span v-else>Hasil ekspor muncul di sini</span>
        </div>
      </div>
    </section>
  </div>
</template>
