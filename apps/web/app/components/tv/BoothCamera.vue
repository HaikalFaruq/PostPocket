<script setup lang="ts">
import type { PhotoFilter } from '@postpocket/presets'
import type { BoothLayout } from '~/utils/booth'

/**
 * Pratinjau kamera Booth di layar TV, dengan filter aktif dan efeknya. Kamera depan dicerminkan
 * seperti cermin, dan hasil jepretan dicerminkan dengan cara yang sama.
 */
const props = defineProps<{
  filter: PhotoFilter
  facing: 'user' | 'environment'
  countdown: number | null
  /** Jepretan ke berapa dari berapa, selama memotret. */
  progress?: { shot: number; total: number } | null
  flash: number
  /** Tata letak hasil dan jepretan yang sudah diambil, untuk pratinjau di pojok layar. */
  layout: BoothLayout
  captured: string[]
}>()
const emit = defineEmits<{ ready: []; error: [message: string] }>()
const video = ref<HTMLVideoElement | null>(null)
let stream: MediaStream | null = null

function cameraError(problem: unknown): string {
  if (!navigator.mediaDevices?.getUserMedia) return 'Kamera hanya bisa dipakai lewat HTTPS.'
  const name = problem instanceof DOMException ? problem.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Izin kamera ditolak.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Kamera tidak ditemukan.'
  return 'Kamera tidak bisa dibuka.'
}

function stop() {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
}

async function start() {
  stop()
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('tanpa kamera')
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: props.facing, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    })
    if (video.value) {
      video.value.srcObject = stream
      await video.value.play()
    }
    emit('ready')
  } catch (problem) {
    stop()
    emit('error', cameraError(problem))
  }
}

watch(() => props.facing, start)
onMounted(start)
onBeforeUnmount(stop)
defineExpose({ video })

const filterCss = computed(() => {
  const parts = [
    props.filter.effects.includes('rgb-split') ? 'url(#tv-rgb-split)' : '',
    props.filter.css === 'none' ? '' : props.filter.css,
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : 'none'
})
</script>

<template>
  <div class="absolute inset-0" data-testid="booth-camera">
    <video
      ref="video"
      class="absolute inset-0 size-full object-cover"
      :class="{ '-scale-x-100': facing === 'user' }"
      :style="{ filter: filterCss }"
      autoplay
      muted
      playsinline
    />
    <TvEffects :effects="filter.effects" />
    <div
      v-if="countdown !== null"
      class="absolute inset-0 grid place-items-center font-tv text-[clamp(72px,22vw,140px)] text-white"
      data-testid="booth-countdown"
      style="text-shadow: 0 0 18px rgb(0 0 0 / 0.6)"
      aria-live="assertive"
    >
      {{ countdown }}
    </div>
    <p
      v-if="progress"
      class="absolute top-3 right-4 font-tv text-[22px] tracking-[0.12em] text-white"
      style="text-shadow: 0 0 8px rgb(0 0 0 / 0.7)"
      data-testid="booth-progress"
    >
      FOTO {{ progress.shot }}/{{ progress.total }}
    </p>
    <BoothLayoutPreview
      :layout="layout"
      :shots="captured"
      :active="countdown !== null || !!progress"
    />
    <div v-if="flash" :key="flash" class="booth-flash absolute inset-0 bg-white" />
  </div>
</template>

<style scoped>
.booth-flash {
  animation: booth-flash 260ms ease-out forwards;
}

@keyframes booth-flash {
  from {
    opacity: 0.9;
  }
  to {
    opacity: 0;
  }
}
</style>
