<script setup lang="ts">
import { byId, letter, type Illustration } from '@postpocket/presets'
import { BottomSheet, SidePanel } from '#components'
import type { FrameStats } from '~/utils/card-motion'

useSeoMeta({ title: 'Lab kartu foil · PostPocket', robots: 'noindex' })

const isDesktop = useMediaQuery('(min-width: 1024px)')

const illustration = ref('meadow')
const foilColor = ref('gold')
const paper = ref('white')
const foilBorder = ref(false)
const open = ref(false)
const expanded = ref(true)

const card = ref<{
  benchmark: (ms?: number) => Promise<FrameStats>
  turnBy: (degrees: number) => void
} | null>(null)
const running = ref(false)
const result = ref<FrameStats | null>(null)
const copied = ref(false)

const front = computed(
  () => byId(letter.illustrations, illustration.value) ?? (letter.illustrations[0] as Illustration),
)
const foil = computed(() => byId(letter.foilColors, foilColor.value) ?? letter.foilColors[0]!)
const paperPreset = computed(() => byId(letter.papers, paper.value) ?? letter.papers[0]!)

const illustrationOptions = letter.illustrations.map((item) => ({
  value: item.id,
  label: item.label,
}))
const paperOptions = letter.papers.map((item) => ({
  value: item.id,
  label: item.label,
  color: item.color,
}))

const panelProps = computed(() =>
  isDesktop.value
    ? { label: 'Opsi kartu' }
    : {
        label: 'Opsi kartu',
        expanded: expanded.value,
        'onUpdate:expanded': (value: boolean) => (expanded.value = value),
      },
)

const device = computed(() =>
  import.meta.client
    ? `${navigator.userAgent} · DPR ${window.devicePixelRatio} · ${window.innerWidth}×${window.innerHeight}`
    : '',
)

async function runBenchmark() {
  if (!card.value || running.value) return
  open.value = false
  running.value = true
  result.value = await card.value.benchmark(4000)
  running.value = false
}

// Untuk uji di perangkat tanpa input otomatis (simulator, HP): ?flip=1, ?open=1, ?bench=1
const route = useRoute()
onMounted(() => {
  setTimeout(() => {
    if (route.query.flip) card.value?.turnBy(180)
    if (route.query.open) open.value = true
    if (route.query.bench) runBenchmark()
  }, 900)
})

async function copyResult() {
  if (!result.value) return
  const r = result.value
  await navigator.clipboard.writeText(
    `PostPocket foil benchmark: ${r.fps} fps, p95 ${r.p95} ms, ${(r.slowShare * 100).toFixed(1)}% frame >20 ms, ${r.frames} frame\n${device.value}`,
  )
  copied.value = true
  setTimeout(() => (copied.value = false), 1600)
}
</script>

<template>
  <div class="flex h-dvh flex-col bg-surface lg:flex-row">
    <main class="relative min-h-0 flex-1">
      <NuxtLink
        to="/lab"
        class="absolute top-4 left-4 z-10 inline-flex items-center gap-1 text-caption text-ink-muted hover:text-ink"
      >
        <Icon name="chevron-left" :size="14" /> Lab
      </NuxtLink>
      <p
        v-if="result || running"
        class="absolute top-3.5 right-4 z-10 rounded-full bg-ink px-3 py-1 font-mono text-[11px] text-white"
        data-testid="benchmark-badge"
        aria-live="polite"
      >
        {{ running ? 'mengukur…' : `${result?.fps} fps · p95 ${result?.p95} ms` }}
      </p>
      <FoilCard
        ref="card"
        v-model:open="open"
        :art="front.art"
        :foil-mask="front.foil"
        :foil="foil"
        :paper="paperPreset"
        :ratio="front.ratio"
        :foil-border="foilBorder"
      >
        <template #inside>
          <p>Halo!</p>
          <p>Ini kartu percobaan dari spike Sprint 0.</p>
          <p class="mt-[4cqw]">Coba putar sampai kelihatan bagian belakangnya.</p>
        </template>
      </FoilCard>
      <p
        v-if="isDesktop"
        class="pointer-events-none absolute inset-x-0 bottom-6 text-center text-caption text-ink-subtle"
      >
        Tap kartu untuk membuka · geser untuk memutar
      </p>
    </main>

    <component :is="isDesktop ? SidePanel : BottomSheet" v-bind="panelProps">
      <template #peek>
        <p class="text-caption text-ink-subtle">Tap kartu untuk membuka</p>
      </template>

      <div class="px-6 pt-6 pb-1">
        <h1 class="text-title font-semibold">Lab kartu foil</h1>
        <p class="mt-1 text-ink-muted">
          Spike Sprint 0: kartu foil dengan CSS 3D. Ganti opsinya, putar kartunya, lalu jalankan uji
          performa di HP sungguhan.
        </p>
      </div>

      <StepCard :step="1" title="Gambar depan">
        <PillGroup v-model="illustration" label="Gambar depan" :options="illustrationOptions" />
      </StepCard>

      <StepCard :step="2" title="Bagian foil" hint="Sesuai desain">
        <label class="flex items-center gap-2 text-body">
          <input v-model="foilBorder" type="checkbox" class="size-4 accent-ink" />
          Bingkai foil di tepi
        </label>
      </StepCard>

      <StepCard :step="3" title="Warna foil" :hint="foil.label">
        <SwatchGroup v-model="foilColor" label="Warna foil" size="lg">
          <Swatch
            v-for="item in letter.foilColors"
            :key="item.id"
            :value="item.id"
            :label="item.label"
            size="lg"
          >
            <FoilSwatchIcon :foil="item" />
          </Swatch>
        </SwatchGroup>
      </StepCard>

      <StepCard
        :step="4"
        title="Kertas"
        :hint="paperPreset.label"
        description="Satu kertas untuk depan, dalam, dan belakang kartu."
      >
        <SwatchGroup v-model="paper" label="Kertas" :options="paperOptions" />
      </StepCard>

      <StepCard
        :step="5"
        title="Uji performa"
        description="Kartu diputar mengikuti lintasan tetap selama 4 detik. Gerbang PRD: di atas 50 fps di HP Android kelas menengah."
      >
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-control bg-surface px-3.5 text-body font-medium inset-ring inset-ring-line hover:bg-panel disabled:opacity-50"
            :disabled="running"
            data-testid="benchmark"
            @click="runBenchmark"
          >
            {{ running ? 'Mengukur…' : 'Jalankan uji 4 detik' }}
          </button>
          <button
            v-if="result"
            type="button"
            class="h-9 px-2 text-caption text-ink-muted underline underline-offset-2 hover:text-ink"
            @click="copyResult"
          >
            {{ copied ? 'Tersalin' : 'Salin hasil' }}
          </button>
        </div>
        <dl
          v-if="result"
          class="mt-3 grid grid-cols-4 gap-2 text-center"
          data-testid="benchmark-result"
        >
          <div class="rounded-control bg-fill py-2">
            <dt class="text-[10.5px] text-ink-muted">fps</dt>
            <dd class="text-body font-semibold" :class="result.fps < 50 && 'text-tv-accent'">
              {{ result.fps }}
            </dd>
          </div>
          <div class="rounded-control bg-fill py-2">
            <dt class="text-[10.5px] text-ink-muted">p95 ms</dt>
            <dd class="text-body font-semibold">{{ result.p95 }}</dd>
          </div>
          <div class="rounded-control bg-fill py-2">
            <dt class="text-[10.5px] text-ink-muted">&gt;20 ms</dt>
            <dd class="text-body font-semibold">{{ (result.slowShare * 100).toFixed(1) }}%</dd>
          </div>
          <div class="rounded-control bg-fill py-2">
            <dt class="text-[10.5px] text-ink-muted">frame</dt>
            <dd class="text-body font-semibold">{{ result.frames }}</dd>
          </div>
        </dl>
        <p v-if="result" class="mt-2 text-[11px] break-words text-ink-subtle">{{ device }}</p>
      </StepCard>

      <template #footer>
        <StickyCTA @click="open = !open">{{ open ? 'Tutup kartu' : 'Buka kartu' }}</StickyCTA>
      </template>
    </component>
  </div>
</template>
