<script setup lang="ts">
/**
 * Kartu langkah bernomor.
 * - `section`: gaya Foil Studio, nomor di lingkaran hitam, dipisah garis tipis (Letter).
 * - `card`: gaya Day Pocket, nomor "01" monospace di kartu putih (Pocket).
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
const number = computed(() =>
  props.variant === 'card' ? String(props.step).padStart(2, '0') : String(props.step),
)
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
    class="rounded-[20px] bg-surface p-4 shadow-[0_1px_2px_rgb(17_17_20/0.04)]"
  >
    <div class="flex items-start gap-3">
      <span
        class="grid size-8 shrink-0 place-items-center rounded-full bg-fill font-mono text-[11px] font-medium"
        aria-hidden="true"
        >{{ number }}</span
      >
      <div class="min-w-0">
        <h2 :id="headingId" class="text-body font-semibold">
          <span class="sr-only">Langkah {{ step }}: </span>{{ title }}
        </h2>
        <p v-if="description" class="text-caption text-ink-muted">{{ description }}</p>
      </div>
      <div v-if="$slots.action" class="ml-auto">
        <slot name="action" />
      </div>
    </div>
    <div class="mt-3 sm:pl-11">
      <slot />
    </div>
  </section>
</template>
