<script setup lang="ts">
/**
 * Wadah panel opsi di HP: sheet putih bersudut besar yang bisa dilipat lewat tombol chevron.
 * Diletakkan di bagian bawah layout kolom (bukan fixed), jadi area di atasnya ikut membesar
 * saat sheet dilipat. Hanya isi opsi yang dilipat; `footer` (tombol utama) tetap terlihat.
 * Di desktop pakai <SidePanel>.
 */
defineProps<{ label: string }>()

const expanded = defineModel<boolean>('expanded', { default: true })
const bodyId = useId()
</script>

<template>
  <div class="relative flex flex-col">
    <div class="flex items-center gap-3 px-4 pb-3">
      <div class="min-w-0 flex-1 pl-11 text-center">
        <slot name="peek" />
      </div>
      <IconButton
        size="lg"
        :label="expanded ? 'Sembunyikan opsi' : 'Tampilkan opsi'"
        :aria-expanded="expanded"
        :aria-controls="bodyId"
        @click="expanded = !expanded"
      >
        <Icon :name="expanded ? 'chevron-down' : 'chevron-up'" :size="20" />
      </IconButton>
    </div>
    <div class="flex min-h-0 flex-col overflow-hidden rounded-t-card bg-panel shadow-sheet">
      <section
        :id="bodyId"
        :aria-label="label"
        :inert="!expanded"
        class="grid transition-[grid-template-rows] duration-300 ease-sheet"
        :class="expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
      >
        <div class="min-h-0 overflow-hidden">
          <!-- Di layar pendek, sheet menyisakan sekitar 220 px untuk kartu supaya tidak tertimpa. -->
          <div
            class="max-h-[max(160px,min(56dvh,560px,calc(100dvh_-_368px)))] overflow-y-auto overscroll-contain"
          >
            <slot />
          </div>
        </div>
      </section>
      <!-- Tombol utama tidak ikut dilipat. Penguji di HP sempat tidak menemukan "Buat link"
           karena tombolnya hilang bersama opsi. -->
      <slot name="footer" />
    </div>
  </div>
</template>
