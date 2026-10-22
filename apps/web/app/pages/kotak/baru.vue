<script setup lang="ts">
import { kotak } from '@postpocket/presets'
import { fromLocalInput, scheduleRange, toLocalInput } from '~/utils/box-time'
import { LetterApiError, errorMessage } from '~/utils/letter-api'
import { BOX_TEXT_LIMIT, boxText } from '~/utils/letter-draft'
import type { CreatedBox } from '~/utils/box-api'
import { rememberBox } from '~/utils/my-boxes'
import { isInAppBrowser } from '~/utils/pwa'

/**
 * Bikin kotak bareng (kontrak 0.3.0): judul, nama penerima, seni folder, dan kapan dibuka.
 * Hasilnya dua link di halaman kelola: link titip untuk teman-teman dan link buka untuk penerima.
 */
if (!useRuntimeConfig().public.kotakBareng) {
  throw createError({ statusCode: 404, statusMessage: 'Kotak bareng belum tersedia', fatal: true })
}
useSeoMeta({ title: 'Bikin kotak bareng · PostPocket', robots: 'noindex' })

const api = useBoxApi()
const to = ref('')
const title = ref('')
const design = ref(kotak.folders[0]!.id)
const when = ref<'manual' | 'scheduled'>('manual')
const opensAt = ref('')
const busy = ref(false)
const error = ref('')
const toField = ref<HTMLInputElement | null>(null)
// Kotak dikelola lewat token yang disimpan di browser ini saja. Browser bawaan aplikasi lain
// (Instagram, LINE, …) menyimpannya terpisah, jadi kotaknya tidak bisa dikelola lagi dari Chrome
// atau Safari.
const inApp = ref(false)
onMounted(() => (inApp.value = isInAppBrowser(navigator.userAgent)))

const shownTitle = computed(() => title.value.trim() || `Untuk ${to.value.trim() || 'dia'}`)
// Rentang jadwal ikut bergeser selama halaman terbuka.
const now = ref(Date.now())
useIntervalFn(() => (now.value = Date.now()), 30_000)
const range = computed(() => scheduleRange(now.value, now.value))
/** Kotak yang sudah dibuat tapi tidak bisa dicatat di browser ini: link-nya ditampilkan di sini. */
const unsaved = ref<CreatedBox | null>(null)
const whenOptions = [
  { value: 'manual', label: 'Saat aku buka' },
  { value: 'scheduled', label: 'Tanggal tertentu' },
]
watch(when, (value) => {
  // Jadwal bawaan: besok jam 19.00, supaya ada waktu mengumpulkan surat.
  if (value !== 'scheduled' || opensAt.value) return
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(19, 0, 0, 0)
  opensAt.value = toLocalInput(tomorrow)
})

/** Pilihan seni folder sebagai gradien dari warna resepnya. */
const artOptions = kotak.folders.map((folder) => ({
  id: folder.id,
  label: folder.label,
  background: `linear-gradient(135deg, ${folder.colors.join(', ')})`,
}))

const { width: windowWidth } = useWindowSize()
// Di HP pratinjaunya di atas formulir, jadi dibuat lebih kecil supaya isian tetap dekat.
const previewWidth = computed(() =>
  windowWidth.value >= 1024 ? 320 : Math.max(220, Math.min(280, windowWidth.value - 32)),
)

async function create() {
  error.value = ''
  const name = boxText(to.value).trim()
  if (!name) {
    error.value = 'Tulis nama penerimanya dulu.'
    toField.value?.focus()
    return
  }
  let schedule: string | null = null
  if (when.value === 'scheduled') {
    const date = fromLocalInput(opensAt.value)
    const { min, max } = scheduleRange(Date.now())
    if (!date || date.getTime() < min || date.getTime() > max) {
      error.value = 'Pilih waktu buka antara 10 menit lagi dan 30 hari dari sekarang.'
      return
    }
    schedule = date.toISOString()
  }
  busy.value = true
  try {
    const box = await api.create({
      title: boxText(title.value).trim() || boxText(`Untuk ${name}`),
      to: name,
      design: design.value,
      opensAt: schedule,
    })
    if (await rememberBox(box)) await navigateTo(`/kotak/${box.id}`, { replace: true })
    else unsaved.value = box
  } catch (problem) {
    const minutes =
      problem instanceof LetterApiError && problem.retryAfter
        ? Math.max(1, Math.ceil(problem.retryAfter / 60))
        : null
    error.value =
      problem instanceof LetterApiError && problem.code === 'rate_limited'
        ? `Terlalu banyak kotak dari jaringan ini. Coba lagi ${minutes ? `dalam ${minutes} menit` : 'sebentar lagi'}.`
        : errorMessage(problem)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6" data-testid="box-new">
    <header class="py-4">
      <NuxtLink
        to="/kotak"
        class="inline-flex min-h-11 items-center gap-1 text-body text-ink-muted hover:text-ink"
      >
        <Icon name="chevron-left" :size="14" /> Kotak surat
      </NuxtLink>
      <h1 class="mt-2 text-[34px] leading-none font-bold tracking-[-0.035em]">
        Bikin kotak bareng
      </h1>
      <p class="mt-2 max-w-md text-pretty text-ink-muted">
        Kumpulkan surat dan foto Booth dari teman-teman untuk satu orang, sampai 20 surat dan 40
        foto. Kamu dapat dua link: satu untuk teman yang mau titip, satu untuk penerimanya.
      </p>
    </header>

    <main class="grid flex-1 gap-10 pb-12 lg:grid-cols-[1fr_380px] lg:items-start">
      <!-- Kotak jadi, tapi browser ini menolak menyimpannya: tanpa catatan itu halaman kelola tidak
           bisa dibuka, jadi kedua link-nya ditampilkan sekarang. -->
      <section v-if="unsaved" class="max-w-md" data-testid="box-unsaved" aria-live="polite">
        <h2 class="text-title">Kotaknya sudah jadi</h2>
        <p class="mt-2 text-pretty text-ink-muted">
          Tapi browser ini menolak menyimpannya, jadi kotak ini tidak bisa dikelola lagi dari sini.
          Simpan kedua link ini sekarang.
        </p>
        <label class="mt-4 block text-body font-semibold" for="unsaved-invite">
          Link titip untuk teman-teman
        </label>
        <input
          id="unsaved-invite"
          :value="unsaved.inviteUrl"
          readonly
          class="mt-1 h-11 w-full rounded-control bg-panel px-3 text-body inset-ring inset-ring-line"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <label class="mt-3 block text-body font-semibold" for="unsaved-open">
          Link untuk {{ unsaved.to }}
        </label>
        <input
          id="unsaved-open"
          :value="unsaved.url"
          readonly
          class="mt-1 h-11 w-full rounded-control bg-panel px-3 text-body inset-ring inset-ring-line"
          @focus="($event.target as HTMLInputElement).select()"
        />
      </section>
      <form v-else class="max-w-md space-y-6" novalidate @submit.prevent="create">
        <div>
          <label for="box-to" class="block text-body font-semibold">Untuk siapa?</label>
          <input
            id="box-to"
            ref="toField"
            v-model="to"
            :maxlength="BOX_TEXT_LIMIT"
            autocomplete="off"
            placeholder="Misalnya Rani"
            class="mt-1.5 h-11 w-full rounded-control bg-surface px-3.5 text-body inset-ring inset-ring-line placeholder:text-ink-subtle focus:outline-2 focus:outline-ink"
            data-testid="box-to"
          />
        </div>
        <div>
          <label for="box-title" class="block text-body font-semibold">Judul kotak</label>
          <input
            id="box-title"
            v-model="title"
            :maxlength="BOX_TEXT_LIMIT"
            autocomplete="off"
            :placeholder="`${shownTitle}, atau Ultah ke-20 ${to.trim() || 'Rani'}`"
            class="mt-1.5 h-11 w-full rounded-control bg-surface px-3.5 text-body inset-ring inset-ring-line placeholder:text-ink-subtle focus:outline-2 focus:outline-ink"
            data-testid="box-title"
          />
          <p class="mt-1 text-caption text-ink-muted">
            Tampil di folder dan di link untuk teman-teman.
          </p>
        </div>
        <fieldset>
          <legend class="text-body font-semibold">Kapan dibuka?</legend>
          <PillGroup v-model="when" label="Kapan dibuka" :options="whenOptions" class="mt-2" />
          <p v-if="when === 'manual'" class="mt-2 text-caption text-ink-muted">
            Kamu yang menekan Buka sekarang di halaman kelola. Kalau belum kamu buka, kotaknya
            terbuka sendiri 30 hari lagi. Sebelum itu, teman-teman bisa terus menitip.
          </p>
          <template v-else>
            <label for="box-opens" class="mt-3 block text-caption text-ink-muted">
              Kotak terbuka sendiri pada
            </label>
            <input
              id="box-opens"
              v-model="opensAt"
              type="datetime-local"
              :min="toLocalInput(range.min)"
              :max="toLocalInput(range.max)"
              class="mt-1 h-11 w-full rounded-control bg-surface px-3.5 text-body inset-ring inset-ring-line focus:outline-2 focus:outline-ink"
              data-testid="box-opens"
            />
            <p class="mt-1 text-caption text-ink-muted">
              Titipan ditutup saat itu juga. Waktunya mengikuti jam HP ini.
            </p>
          </template>
        </fieldset>
        <fieldset>
          <legend class="text-body font-semibold">Seni folder</legend>
          <SwatchGroup v-model="design" label="Seni folder" size="lg" class="mt-2">
            <Swatch
              v-for="item in artOptions"
              :key="item.id"
              :value="item.id"
              :label="item.label"
              size="lg"
            >
              <span
                class="size-[34px] rounded-full inset-ring inset-ring-line"
                :style="{ background: item.background }"
              />
            </Swatch>
          </SwatchGroup>
        </fieldset>
        <p class="text-caption text-ink-muted" data-testid="box-browser-note">
          Kotak ini hanya bisa dikelola dari browser ini, lewat Kotak surat.
          <template v-if="inApp">
            Link ini terbuka di dalam aplikasi lain, jadi buka PostPocket di Chrome atau Safari dulu
            supaya kotaknya ketemu lagi nanti.
          </template>
        </p>
        <p
          v-if="error"
          role="alert"
          class="text-caption font-semibold text-[#7a5a14]"
          data-testid="box-error"
        >
          {{ error }}
        </p>
        <button
          type="submit"
          class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-control bg-ink text-[15px] font-semibold text-white hover:bg-ink/90 disabled:opacity-70 sm:w-auto sm:px-8"
          :disabled="busy"
          data-testid="box-create"
        >
          <span
            v-if="busy"
            class="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden="true"
          />
          {{ busy ? 'Membuat kotak…' : 'Bikin kotak' }}
        </button>
      </form>

      <!-- Pratinjau langsung: judul, penerima, dan seni folder yang dipilih. Tidak bisa disentuh. -->
      <figure
        class="order-first flex flex-col items-center lg:order-none lg:sticky lg:top-6 lg:pt-6"
        inert
      >
        <GlassFolder
          :label="shownTitle"
          :meta="`untuk ${to.trim() || '…'}`"
          :art="design"
          :seed="7"
          :width="previewWidth"
          :files="[]"
        />
        <figcaption class="mt-3 text-caption text-ink-muted">Pratinjau folder kotakmu</figcaption>
      </figure>
    </main>
  </div>
</template>
