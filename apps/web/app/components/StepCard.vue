<script setup lang="ts">
/**
 * Bagian formulir.
 * - `section`: langkah bernomor yang dipisah garis tipis (editor surat, urutannya memang langkah).
 * - `card`: bagian tanpa nomor untuk pilihan yang bebas urutan (modal Pocket); dipisah garis di
 *   dalam satu lembar putih, bukan kartu-kartu yang seragam.
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

  <section v-else :aria-labelledby="headingId" class="px-4 py-4 sm:px-5">
    <div class="flex items-start gap-3">
      <div class="min-w-0">
        <h2 :id="headingId" class="text-[15px] font-bold tracking-[-0.01em]">
          {{ title }}
          <span v-if="hint" class="ml-1 font-normal text-ink-muted">{{ hint }}</span>
        </h2>
        <p v-if="description" class="text-caption text-ink-muted">{{ description }}</p>
      </div>
      <div v-if="$slots.action" class="ml-auto">
        <slot name="action" />
      </div>
    </div>
    <div class="mt-3">
      <slot />
    </div>
  </section>
</template>
