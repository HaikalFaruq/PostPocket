<script setup lang="ts">
import { DEFAULT_FEEDBACK_URL, feedbackHref, feedbackText } from '~/utils/feedback'

/**
 * Tautan "Lapor masalah" untuk tester. Alamatnya bisa dibuka tanpa JavaScript; dengan JavaScript,
 * isi laporannya dilengkapi halaman, versi aplikasi, dan perangkat.
 */
const config = useRuntimeConfig().public
const route = useRoute()
const template = computed(() => config.feedbackUrl || DEFAULT_FEEDBACK_URL)
const href = computed(() => feedbackHref(template.value, ''))

function report(event: MouseEvent) {
  event.preventDefault()
  const text = feedbackText({
    path: route.path,
    version: config.appVersion,
    device: navigator.userAgent,
    isPublic: !config.feedbackUrl,
  })
  window.open(feedbackHref(template.value, text), '_blank', 'noopener')
}
</script>

<template>
  <a :href="href" target="_blank" rel="noopener" data-testid="feedback-link" @click="report">
    <slot>Lapor masalah</slot>
  </a>
</template>
