<script setup lang="ts">
import type { LetterContent } from '@postpocket/presets'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

/**
 * Halaman surat selebar layar, untuk dibaca dengan nyaman di HP. Di dalam kartu yang terbuka,
 * halamannya hanya separuh lebar kartu sehingga tulisannya kecil. Bisa diperbesar dengan dua jari.
 */
withDefaults(
  defineProps<{
    content: LetterContent
    photoUrls: Record<string, string>
    photoPlaceholder?: string
    /** Warna kertas dan tintanya. */
    paper: { color: string; textColor: string }
    /** Lebar dibagi tinggi halaman. */
    ratio: number
    title?: string
  }>(),
  { photoPlaceholder: undefined, title: 'Surat untukmu' },
)
const open = defineModel<boolean>('open', { default: false })

// Back di HP menutup tampilan baca, bukan meninggalkan halaman surat.
useBackToClose(open, () => {
  open.value = false
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-40 bg-[rgb(24_32_74/0.94)] backdrop-blur-sm data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <DialogContent
        class="fixed inset-0 z-50 overflow-y-auto overscroll-contain px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
        :aria-describedby="undefined"
        data-testid="letter-reader"
        data-surface="dark"
      >
        <div class="mx-auto flex w-full max-w-[560px] items-center justify-between gap-3">
          <DialogTitle class="text-body font-semibold text-white">{{ title }}</DialogTitle>
          <DialogClose as-child>
            <IconButton label="Tutup">
              <Icon name="close" :size="18" />
            </IconButton>
          </DialogClose>
        </div>
        <div
          class="reader-page mx-auto mt-4 w-full max-w-[560px]"
          :style="{ aspectRatio: ratio, '--paper': paper.color, '--paper-ink': paper.textColor }"
        >
          <div class="reader-page__grain" />
          <div class="reader-page__content">
            <LetterPage
              :content="content"
              :photo-urls="photoUrls"
              :photo-placeholder="photoPlaceholder"
            />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.reader-page {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background-color: var(--paper);
  color: var(--paper-ink);
  box-shadow: var(--shadow-raised);
  container-type: size;
}

/* Sama dengan .foil-content di FoilCard, supaya isi surat tampil persis seperti di kartu. */
.reader-page__content {
  position: absolute;
  inset: 0;
  font-family: var(--font-letter);
  font-size: 8cqw;
  line-height: 1.25;
}

.reader-page__grain {
  position: absolute;
  inset: 0;
  background-image: var(--texture-paper);
  background-size: 160px;
  opacity: 0.1;
  mix-blend-mode: multiply;
  pointer-events: none;
}
</style>
