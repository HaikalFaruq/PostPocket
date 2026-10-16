<script setup lang="ts">
// Foto contoh hanya untuk halaman lab, jadi ikut chunk halaman ini, tidak disajikan dari public/.
import samplePhoto from '~/assets/lab/contoh-foto.svg?url'
import { letter, pocket } from '@postpocket/presets'

useSeoMeta({ title: 'Lab komponen · PostPocket', robots: 'noindex' })

const shape = ref('original')
const foilMode = ref('design')
const foilColor = ref('gold')
const paper = ref('white')
const packet = ref('blue')
const frame = ref('polaroid')
const frameColor = ref('cream')
const sheetExpanded = ref(true)
const modalOpen = ref(false)

const paperOptions = letter.papers.map((p) => ({ value: p.id, label: p.label, color: p.color }))
const packetOptions = pocket.packetColors.map((p) => ({
  value: p.id,
  label: p.label,
  color: p.color,
}))
const frameColorOptions = pocket.frameColors.map((c) => ({
  value: c.id,
  label: c.label,
  color: c.color,
}))
const shapeOptions = letter.shapes.map((s) => ({ value: s.id, label: s.label }))
const frameOptions = pocket.frames.map((f) => ({ value: f.id, label: f.label }))

const paperLabel = computed(() => letter.papers.find((p) => p.id === paper.value)?.label)
const packetPreset = computed(() => pocket.packetColors.find((p) => p.id === packet.value))
const frameColorHex = computed(
  () => pocket.frameColors.find((c) => c.id === frameColor.value)?.color ?? '#fbf6ec',
)
const frameVariant = computed(() => frame.value as 'polaroid' | 'stamp' | 'ticket')
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="font-mono text-[11px] tracking-[0.2em] text-ink-subtle uppercase">Sprint 0</p>
        <h1 class="mt-1 text-display font-semibold">Lab komponen</h1>
        <p class="mt-2 max-w-xl text-ink-muted">
          Semua komponen bersama dari PRD, memakai token dan preset yang sama dengan halaman asli.
        </p>
      </div>
      <nav class="flex gap-2" aria-label="Halaman lab">
        <NuxtLink
          to="/lab/foil"
          class="inline-flex h-9 items-center rounded-full bg-ink px-4 text-body font-medium text-white"
          >Kartu foil</NuxtLink
        >
        <NuxtLink
          to="/lab/safari"
          class="inline-flex h-9 items-center rounded-full bg-surface px-4 text-body font-medium inset-ring inset-ring-line"
          >Cek Safari</NuxtLink
        >
        <NuxtLink
          to="/lab/kirim"
          class="inline-flex h-9 items-center rounded-full bg-surface px-4 text-body font-medium inset-ring inset-ring-line"
          >Uji kirim</NuxtLink
        >
      </nav>
    </header>

    <div class="mt-8 grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="lab-letter"
        class="overflow-hidden rounded-card bg-panel shadow-raised"
      >
        <h2
          id="lab-letter"
          class="px-6 pt-5 font-mono text-[11px] tracking-[0.2em] text-ink-subtle uppercase"
        >
          StepCard section · PillGroup · SwatchGroup · StickyCTA
        </h2>
        <StepCard :step="1" title="Gambar depan">
          <p class="mb-2 text-caption text-ink-muted">Bentuk</p>
          <PillGroup v-model="shape" label="Bentuk kartu" :options="shapeOptions" />
        </StepCard>
        <StepCard :step="2" title="Bagian foil">
          <template #action>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-caption font-medium underline underline-offset-2"
            >
              <Icon name="shuffle" :size="13" /> Surprise me
            </button>
          </template>
          <PillGroup
            v-model="foilMode"
            label="Bagian foil"
            :options="letter.foilModes.map((m) => ({ value: m.id, label: m.label }))"
          />
        </StepCard>
        <StepCard
          :step="3"
          title="Warna foil"
          :hint="letter.foilColors.find((f) => f.id === foilColor)?.label"
        >
          <SwatchGroup v-model="foilColor" label="Warna foil" size="lg">
            <Swatch
              v-for="f in letter.foilColors"
              :key="f.id"
              :value="f.id"
              :label="f.label"
              size="lg"
            >
              <FoilSwatchIcon :foil="f" />
            </Swatch>
          </SwatchGroup>
        </StepCard>
        <StepCard :step="4" title="Kertas" :hint="paperLabel">
          <SwatchGroup v-model="paper" label="Kertas" :options="paperOptions" />
        </StepCard>
        <StickyCTA>Buat link untuk dikirim</StickyCTA>
      </section>

      <section
        aria-labelledby="lab-pocket"
        class="space-y-3 rounded-card bg-canvas p-4 shadow-raised"
      >
        <h2
          id="lab-pocket"
          class="px-2 pt-1 font-mono text-[11px] tracking-[0.2em] text-ink-subtle uppercase"
        >
          StepCard card · Swatch dengan centang · PhotoFrame
        </h2>
        <StepCard
          variant="card"
          :step="1"
          title="Warna kantong"
          description="Bungkus kecil untuk hari ini"
        >
          <SwatchGroup
            v-model="packet"
            label="Warna kantong"
            size="md"
            check
            :options="packetOptions"
            style="--swatch-gap: var(--color-surface)"
          />
        </StepCard>
        <StepCard
          variant="card"
          :step="3"
          title="Bingkai foto"
          description="Cara tiap momen dipotong"
        >
          <PillGroup v-model="frame" label="Bingkai foto" :options="frameOptions" />
          <div class="mt-3">
            <SwatchGroup
              v-model="frameColor"
              label="Warna bingkai"
              :options="frameColorOptions"
              style="--swatch-gap: var(--color-surface)"
            />
          </div>
        </StepCard>
        <div class="flex flex-wrap items-start justify-center gap-6 px-2 py-4">
          <PhotoFrame
            class="w-40"
            :variant="frameVariant"
            :color="frameColorHex"
            :src="samplePhoto"
            alt="Contoh foto pantai saat senja"
            caption="10 Okt 2026"
          />
          <PhotoFrame class="w-40" :variant="frameVariant" :color="frameColorHex" />
        </div>
        <p class="px-2 font-mono text-[11px] tracking-[0.2em] text-pocket-muted uppercase">
          {{ packetPreset?.flavor }} / {{ frame }}
        </p>
      </section>

      <section aria-labelledby="lab-buttons" class="rounded-card bg-panel p-6 shadow-raised">
        <h2
          id="lab-buttons"
          class="font-mono text-[11px] tracking-[0.2em] text-ink-subtle uppercase"
        >
          IconButton · Modal
        </h2>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <IconButton label="Bulan sebelumnya"><Icon name="chevron-left" /></IconButton>
          <IconButton label="Bulan berikutnya"><Icon name="chevron-right" /></IconButton>
          <IconButton label="Tutup" size="lg"><Icon name="close" :size="20" /></IconButton>
          <IconButton label="Tampilkan opsi" size="lg"
            ><Icon name="chevron-up" :size="20"
          /></IconButton>
          <IconButton label="Sebelumnya" size="sm" variant="ghost"
            ><Icon name="arrow-left" :size="16"
          /></IconButton>
          <IconButton label="Tambah foto" variant="ink"><Icon name="plus" /></IconButton>
        </div>
        <button
          type="button"
          class="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-body font-semibold text-white"
          data-testid="open-modal"
          @click="modalOpen = true"
        >
          <Icon name="calendar" :size="16" /> Buka modal Simpan hari
        </button>
      </section>

      <section aria-labelledby="lab-sheet" class="rounded-card bg-panel p-6 shadow-raised">
        <h2 id="lab-sheet" class="font-mono text-[11px] tracking-[0.2em] text-ink-subtle uppercase">
          BottomSheet (bingkai HP)
        </h2>
        <div
          class="mx-auto mt-4 flex h-[560px] w-full max-w-[360px] flex-col overflow-hidden rounded-[32px] border-[6px] border-ink bg-surface"
          data-testid="phone-frame"
        >
          <div class="grid flex-1 place-items-center text-caption text-ink-subtle">Area kartu</div>
          <BottomSheet v-model:expanded="sheetExpanded" label="Opsi contoh">
            <template #peek
              ><p class="text-caption text-ink-subtle">Tap kartu untuk membuka</p></template
            >
            <div class="px-6 pt-5 pb-2">
              <h3 class="text-[19px] font-bold">PostPocket</h3>
              <p class="text-ink-muted">Sheet ini bisa dilipat lewat tombol chevron.</p>
            </div>
            <StepCard :step="1" title="Bentuk">
              <PillGroup v-model="shape" label="Bentuk kartu di sheet" :options="shapeOptions" />
            </StepCard>
            <template #footer><StickyCTA>Buat link untuk dikirim</StickyCTA></template>
          </BottomSheet>
        </div>
      </section>
    </div>

    <Modal
      v-model:open="modalOpen"
      tone="pocket"
      eyebrow="Bikin kapsul waktu kecil"
      title="Simpan satu hari kecil"
      description="Sabtu, 10 Oktober 2026"
    >
      <template #preview>
        <div class="grid h-full place-items-center">
          <div
            class="h-60 w-44 rounded-[18px] shadow-float"
            :style="{ backgroundColor: packetPreset?.color }"
            aria-hidden="true"
          />
          <PhotoFrame
            class="absolute right-8 bottom-10 w-36 rotate-6"
            :variant="frameVariant"
            :color="frameColorHex"
          />
          <p
            class="absolute bottom-4 left-6 font-mono text-[11px] tracking-[0.2em] text-pocket-muted uppercase"
          >
            {{ packetPreset?.flavor }} / Daisy
          </p>
        </div>
      </template>
      <StepCard
        variant="card"
        :step="1"
        title="Warna kantong"
        description="Bungkus kecil untuk hari ini"
      >
        <SwatchGroup
          v-model="packet"
          label="Warna kantong di modal"
          size="md"
          check
          :options="packetOptions"
          style="--swatch-gap: var(--color-surface)"
        />
      </StepCard>
      <StepCard
        variant="card"
        :step="3"
        title="Bingkai foto"
        description="Cara tiap momen dipotong"
      >
        <PillGroup v-model="frame" label="Bingkai foto di modal" :options="frameOptions" />
      </StepCard>
      <template #footer>
        <button type="button" class="h-10 px-3 text-body font-medium" @click="modalOpen = false">
          Nanti saja
        </button>
        <button
          type="button"
          class="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-body font-semibold text-white"
          @click="modalOpen = false"
        >
          <Icon name="check" :size="16" /> Simpan
        </button>
      </template>
    </Modal>
  </div>
</template>
