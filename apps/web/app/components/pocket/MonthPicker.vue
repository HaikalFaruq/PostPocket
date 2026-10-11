<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { monthTitle } from '~/utils/memories'

/**
 * Tombol bulan berikon kalender (PRD Pocket): popover kecil untuk lompat ke bulan dan tahun mana
 * pun. Dibuat sendiri karena `<input type="month">` tidak ada di Safari dan Firefox desktop.
 */
const props = defineProps<{ year: number; month: number }>()
const emit = defineEmits<{ pick: [year: number, month: number] }>()

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const open = ref(false)
const shownYear = ref(props.year)
watch(open, (isOpen) => {
  if (isOpen) shownYear.value = props.year
})

const isShown = (index: number) => shownYear.value === props.year && index + 1 === props.month
const label = (index: number) =>
  monthTitle(`${shownYear.value}-${String(index + 1).padStart(2, '0')}`)

function pick(index: number) {
  emit('pick', shownYear.value, index + 1)
  open.value = false
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <IconButton label="Pilih bulan">
        <Icon name="calendar" :size="17" />
      </IconButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="end"
        :side-offset="8"
        :collision-padding="16"
        aria-label="Pilih bulan dan tahun"
        class="z-50 w-[264px] rounded-[20px] bg-surface p-3 text-pocket-ink shadow-raised"
      >
        <div class="flex items-center justify-between">
          <IconButton label="Tahun sebelumnya" size="sm" variant="ghost" @click="shownYear--">
            <Icon name="chevron-left" :size="16" />
          </IconButton>
          <p class="font-mono text-[13px] tracking-[0.12em]" aria-live="polite">{{ shownYear }}</p>
          <IconButton label="Tahun berikutnya" size="sm" variant="ghost" @click="shownYear++">
            <Icon name="chevron-right" :size="16" />
          </IconButton>
        </div>
        <div class="mt-2 grid grid-cols-4 gap-1">
          <button
            v-for="(short, index) in MONTHS"
            :key="short"
            type="button"
            class="h-9 rounded-full text-body"
            :class="isShown(index) ? 'bg-pocket-ink text-white' : 'hover:bg-fill'"
            :aria-label="label(index)"
            :aria-current="isShown(index) ? 'true' : undefined"
            @click="pick(index)"
          >
            {{ short }}
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
