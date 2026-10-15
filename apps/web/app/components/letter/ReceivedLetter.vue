<script setup lang="ts">
import { cardRatio } from '~/utils/letter-draft'
import type { ShownLetter } from '~/utils/letter-view'

/**
 * Kartu surat untuk penerima: sampul dari desain dan cover pengirim, lalu isi surat saat
 * dibuka. Dipakai halaman surat, kotak bareng, dan Kotak surat. Hanya dirender di browser
 * karena peta foil dibuat di kanvas.
 */
const props = withDefaults(defineProps<{ letter: ShownLetter; label?: string }>(), {
  label: 'Surat untukmu',
})
const open = defineModel<boolean>('open', { default: false })
/** Tampilan baca selebar layar (LetterReader). */
const reading = defineModel<boolean>('reading', { default: false })

const design = computed(() => props.letter.design)
const coverUrl = computed(() => props.letter.cover?.url ?? null)
const { foil, paper, art, mask } = useCardFront(design, coverUrl)
const ratio = computed(() => cardRatio(props.letter.design, props.letter.cover))
</script>

<template>
  <LetterReader
    v-model:open="reading"
    :content="letter.content"
    :photo-urls="letter.photoUrls"
    :photo-placeholder="letter.photoPlaceholder"
    :paper="paper"
    :ratio="ratio"
    :title="letter.from ? `Dari ${letter.from}` : undefined"
  />
  <FoilCard
    v-model:open="open"
    :art="art"
    :foil-mask="mask"
    :foil="foil"
    :paper="paper"
    :ratio="ratio"
    :foil-border="letter.design.foilBorder"
    :label="label"
  >
    <template #inside>
      <LetterPage
        :content="letter.content"
        :photo-urls="letter.photoUrls"
        :photo-placeholder="letter.photoPlaceholder"
      />
    </template>
    <template v-if="letter.from" #inside-cover>
      <p class="from-note" data-testid="letter-from">Dari {{ letter.from }}</p>
    </template>
  </FoilCard>
</template>

<style scoped>
/* Nama pengirim ditulis tangan di balik sampul, seperti di kartu ucapan. */
.from-note {
  position: absolute;
  inset: auto 10% 12% 10%;
  font-family: var(--font-letter);
  word-spacing: var(--letter-word-spacing);
  font-size: 11cqw;
  line-height: 1.1;
  text-align: center;
  overflow-wrap: anywhere;
}
</style>
