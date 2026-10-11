<script setup lang="ts">
import type { Letter } from '~/utils/letter-api'
import { cardRatio } from '~/utils/letter-draft'

/**
 * Kartu surat untuk penerima: sampul dari desain dan cover pengirim, lalu isi surat saat
 * dibuka. Hanya dirender di browser karena peta foil dibuat di kanvas.
 */
const props = defineProps<{ letter: Letter }>()
const open = defineModel<boolean>('open', { default: false })

const design = computed(() => props.letter.design)
const coverUrl = computed(() => props.letter.cover?.url ?? null)
const { foil, paper, art, mask } = useCardFront(design, coverUrl)
const ratio = computed(() => cardRatio(props.letter.design, props.letter.cover))
const photoUrls = computed(() =>
  Object.fromEntries(Object.entries(props.letter.photos).map(([key, asset]) => [key, asset.url])),
)
</script>

<template>
  <FoilCard
    v-model:open="open"
    :art="art"
    :foil-mask="mask"
    :foil="foil"
    :paper="paper"
    :ratio="ratio"
    :foil-border="letter.design.foilBorder"
    label="Surat untukmu"
  >
    <template #inside>
      <LetterPage
        :content="letter.content"
        :photo-urls="photoUrls"
        :photo-placeholder="letter.photosDeletedAt ? 'Foto sudah dihapus' : undefined"
      />
    </template>
  </FoilCard>
</template>
