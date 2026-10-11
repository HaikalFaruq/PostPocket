<script setup lang="ts">
import { byId, letter, pocket } from '@postpocket/presets'
import { WEEKDAYS, longDate, monthGrid, shiftMonth } from '~/utils/calendar'
import { dayKey, monthTitle } from '~/utils/memories'

useSeoMeta({ title: 'Pocket · PostPocket', robots: 'noindex' })

/**
 * Kalender Pocket (PRD modul 2, referensi Day Pocket): setiap hari bisa diisi foto lalu dibungkus
 * dalam kantong kecil berstiker. Data hanya di perangkat ini.
 */
const memories = useMemories()
onMounted(() => memories.load())

const now = new Date()
const today = dayKey(now)
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const monthKey = computed(() => `${year.value}-${String(month.value).padStart(2, '0')}`)
const title = computed(() => monthTitle(monthKey.value))
const cells = computed(() => monthGrid(year.value, month.value))
const savedThisMonth = computed(
  () => Object.keys(memories.data.days).filter((day) => day.startsWith(monthKey.value)).length,
)

function show(nextYear: number, nextMonth: number) {
  year.value = nextYear
  month.value = nextMonth
}

function go(step: number) {
  const next = shiftMonth(year.value, month.value, step)
  show(next.year, next.month)
}

function packetOf(day: string) {
  const saved = memories.data.days[day]
  if (!saved) return null
  return {
    color: byId(pocket.packetColors, saved.packet)?.color ?? pocket.packetColors[0]!.color,
    sticker: byId(letter.stickers, saved.sticker),
  }
}

const modalDay = ref(today)
const modalOpen = ref(false)
function openDay(day: string) {
  if (memories.data.days[day]) return navigateTo(`/pocket/${day}`)
  modalDay.value = day
  modalOpen.value = true
}
</script>

<template>
  <div class="min-h-dvh bg-pocket-page text-pocket-ink">
    <div class="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <header class="flex items-center justify-between gap-3 py-5">
        <NuxtLink to="/" class="flex items-center gap-3">
          <img src="/favicon.svg" alt="" class="size-8" />
          <div>
            <p class="text-[17px] leading-none font-bold tracking-[-0.02em]">PostPocket</p>
            <p class="mt-1 text-caption text-pocket-muted">kantong kecil untuk momen-momenmu</p>
          </div>
        </NuxtLink>
        <div class="flex items-center gap-2">
          <p
            class="hidden font-mono text-[11px] tracking-[0.16em] text-pocket-muted uppercase sm:block"
            data-testid="saved-count"
          >
            {{ memories.savedDays }} hari tersimpan
          </p>
          <MonthPicker :year="year" :month="month" @pick="show" />
        </div>
      </header>

      <div class="flex items-center justify-center gap-3">
        <IconButton label="Bulan sebelumnya" size="sm" @click="go(-1)">
          <Icon name="chevron-left" :size="16" />
        </IconButton>
        <p
          class="min-w-[150px] rounded-full bg-surface px-4 py-1.5 text-center text-body font-semibold shadow-raised"
          data-testid="month-label"
        >
          {{ title }}
        </p>
        <IconButton label="Bulan berikutnya" size="sm" @click="go(1)">
          <Icon name="chevron-right" :size="16" />
        </IconButton>
      </div>

      <section class="mt-5 rounded-[30px] bg-surface p-4 shadow-raised sm:p-7">
        <div class="flex flex-wrap items-start justify-between gap-3 px-1 sm:px-0">
          <div>
            <p class="font-mono text-[11px] tracking-[0.2em] text-pocket-muted uppercase">
              Kapsul waktu kecilmu
            </p>
            <h1 class="mt-1 text-[clamp(28px,7vw,40px)] font-semibold tracking-[-0.035em]">
              {{ title }}
            </h1>
            <p class="mt-1 text-body text-pocket-muted">
              Simpan satu hal kecil setiap hari, lalu buka kantongnya kapan saja.
            </p>
          </div>
          <p class="flex items-center gap-2 text-caption text-pocket-muted sm:mt-2 sm:text-body">
            <span class="size-2.5 rounded-full bg-pocket-ok" aria-hidden="true" />
            <span class="sm:hidden" data-testid="saved-count-mobile"
              >{{ memories.savedDays }} hari tersimpan</span
            >
            <span class="hidden sm:inline">{{
              savedThisMonth
                ? `${savedThisMonth} kenangan bulan ini`
                : 'Siap untuk kenangan pertama?'
            }}</span>
          </p>
        </div>

        <!-- Tiap tombol hari berlabel tanggal lengkap, jadi nama hari di atas cukup untuk mata. -->
        <div class="mt-5 grid grid-cols-7 border-t border-l border-line-soft">
          <div
            v-for="weekday in WEEKDAYS"
            :key="weekday"
            class="border-r border-b border-line-soft py-2 text-center font-mono text-[10px] tracking-[0.14em] text-pocket-muted uppercase"
            aria-hidden="true"
          >
            {{ weekday }}
          </div>
          <div
            v-for="cell in cells"
            :key="cell.day"
            class="pocket-cell relative aspect-[0.78] border-r border-b border-line-soft sm:aspect-[0.9]"
            :class="{ 'is-outside': !cell.inMonth, 'is-today': cell.day === today }"
          >
            <button
              v-if="cell.inMonth && cell.day <= today"
              type="button"
              class="absolute inset-0 flex flex-col items-center"
              :aria-label="`${longDate(cell.day)}${cell.day === today ? ', hari ini' : ''}${packetOf(cell.day) ? ', sudah tersimpan' : ''}`"
              :data-day="cell.day"
              :data-saved="packetOf(cell.day) ? 'true' : undefined"
              @click="openDay(cell.day)"
            >
              <!-- Di HP selnya sempit: hari ini cukup ditebalkan, pil hanya di layar lebar. -->
              <span
                class="absolute top-1 left-1 font-mono text-[11px] sm:top-1.5 sm:left-1.5"
                :class="
                  cell.day === today &&
                  'font-bold sm:rounded-full sm:bg-pocket-ink sm:px-1.5 sm:font-normal sm:text-white'
                "
                >{{ cell.date }}</span
              >
              <span v-if="packetOf(cell.day)" class="mt-[50%] w-[54%] sm:mt-[26%]">
                <SnackPacket
                  :color="packetOf(cell.day)!.color"
                  :sticker="packetOf(cell.day)!.sticker"
                  mini
                />
              </span>
              <template v-else>
                <span
                  class="pocket-clip mt-[16%] h-3.5 w-1.5 sm:mt-[14%] sm:h-[18px] sm:w-[7px]"
                  aria-hidden="true"
                />
                <span
                  class="mt-auto mb-[8%] grid size-5 place-items-center rounded-full bg-fill text-pocket-muted sm:mb-[14%] sm:size-6"
                  aria-hidden="true"
                >
                  <Icon name="plus" :size="13" />
                </span>
              </template>
            </button>
            <span
              v-else
              class="absolute top-1 left-1 font-mono text-[11px] text-pocket-muted/60 sm:top-1.5 sm:left-1.5"
              aria-hidden="true"
              >{{ cell.date }}</span
            >
          </div>
        </div>
      </section>

      <p
        class="mx-auto mt-6 max-w-md rounded-[16px] bg-surface/70 px-4 py-3 text-center text-caption text-pocket-ink"
      >
        Foto dan kantongmu hanya tersimpan di perangkat ini. Kalau data browser dihapus, isinya ikut
        hilang.
      </p>
    </div>

    <SaveDayModal v-model:open="modalOpen" :day="modalDay" />
  </div>
</template>

<style scoped>
.pocket-cell.is-outside {
  background-color: var(--color-pocket-outside);
}

.pocket-cell.is-today {
  background-color: var(--color-pocket-today);
}

.pocket-cell button {
  transition: background-color 150ms;
}

.pocket-cell button:hover {
  background-color: rgb(74 59 48 / 0.03);
}

.pocket-clip {
  border-radius: 2px;
  background: var(--color-pocket-wood);
  box-shadow: 0 1px 2px rgb(74 59 48 / 0.25);
}
</style>
