<script setup lang="ts">
/**
 * Bagian formulir.
 * - `section`: langkah bernomor yang dipisah garis tipis (editor surat).
 * - `card`: kartu putih bernomor "01", "02", dan seterusnya dengan keterangan kecil di bawah
 *   judulnya (modal Pocket, mengikuti Day Pocket).
 */
const props = withDefaults(
  defineProps<{
    step: number
    title: string
    /** Teks abu-abu di samping judul, misalnya nama warna yang sedang dipilih. */
    hint?: string
    description?: string
    variant?: 'section' | 'card'
  }>(),
  { variant: 'section', hint: undefined, description: undefined },
)

const headingId = useId()
const number = computed(() => String(props.step))
const padded = computed(() => String(props.step).padStart(2, '0'))
</script>

<template>
  <section
    v-if="variant === 'section'"
    :aria-labelledby="headingId"
    class="border-b border-line-soft px-6 py-5 last:border-b-0"
  >
    <div class="flex items-center gap-2">
      <span
        class="grid size-[18px] shrink-0 place-items-center rounded-full bg-ink text-[10.5px] font-semibold text-white"
        aria-hidden="true"
        >{{ number }}</span
      >
      <h2 :id="headingId" class="text-body font-semibold">
        <span class="sr-only">Langkah {{ step }}: </span>{{ title }}
        <span v-if="hint" class="ml-1 font-normal text-ink-muted">{{ hint }}</span>
      </h2>
      <div v-if="$slots.action" class="ml-auto">
        <slot name="action" />
      </div>
    </div>
    <p v-if="description" class="mt-1 text-caption text-ink-muted">{{ description }}</p>
    <div class="mt-3">
      <slot />
    </div>
  </section>

  <section
    v-else
    :aria-labelledby="headingId"
    class="rounded-[18px] bg-surface px-4 py-4 shadow-[0_0_0_1px_var(--color-line-soft)] sm:px-5"
  >
    <div class="flex items-start gap-3">
      <span
        class="mt-px grid size-7 shrink-0 place-items-center rounded-full bg-fill text-[11px] font-semibold text-ink-muted tabular-nums"
        aria-hidden="true"
        >{{ padded }}</span
      >
      <div class="min-w-0">
        <h2 :id="headingId" class="text-[15px] font-bold tracking-[-0.01em]">
          <span class="sr-only">Langkah {{ step }}: </span>{{ title }}
          <span v-if="hint" class="ml-1 font-normal text-ink-muted">{{ hint }}</span>
        </h2>
        <p v-if="description" class="text-caption text-ink-muted">{{ description }}</p>
      </div>
      <div v-if="$slots.action" class="ml-auto">
        <slot name="action" />
      </div>
    </div>
    <div class="mt-3.5">
      <slot />
    </div>
  </section>
</template>
