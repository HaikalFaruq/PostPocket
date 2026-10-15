<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'

/**
 * Garis tipis dari judul ke kerumunan di bawahnya, bergerak seperti garis Hairline: begitu
 * terlihat, garisnya digambar dari atas, lalu satu kilau tinta turun pelan berulang-ulang ke arah
 * kerumunan. Kilaunya berhenti selama garisnya di luar layar, dan dengan `prefers-reduced-motion`
 * garisnya langsung utuh tanpa kilau.
 */
const line = ref<HTMLElement | null>(null)
const drawn = ref(false)
const visible = ref(false)
useIntersectionObserver(line, ([entry]) => {
  visible.value = !!entry?.isIntersecting
  if (visible.value) drawn.value = true
})
</script>

<template>
  <span
    ref="line"
    class="crowd-line"
    :class="{ 'is-drawn': drawn, 'is-paused': !visible }"
    aria-hidden="true"
    data-testid="crowd-line"
  />
</template>

<style scoped>
.crowd-line {
  position: relative;
  display: block;
  width: 1px;
  height: 3.5rem;
  overflow: hidden;
}

/*
 * Garisnya memudar dari atas dan digambar sekali saat pertama terlihat, dengan ease 700 ms
 * Hairline: penampakannya perubahan sekali jalan (aturan 08). Kilaunya bergerak dengan kecepatan
 * tetap, seperti sinyal di kabel: turun 1,7 detik lalu diam 1,1 detik, jadi sekali lewat setiap
 * 2,8 detik dan tetap tenang.
 */
.crowd-line::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent, var(--color-hairline-edge));
  transform: scaleY(0);
  transform-origin: top;
}

/* Kilau: satu-satunya sorotan, tinta penuh yang turun sepanjang garis. */
.crowd-line::after {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 40%;
  background: linear-gradient(to bottom, transparent, var(--color-ink), transparent);
  opacity: 0;
  transform: translateY(-100%);
}

.crowd-line.is-drawn::before {
  animation: line-draw 700ms var(--ease-sheet) forwards;
}

.crowd-line.is-drawn::after {
  animation: line-glint 2800ms linear 700ms infinite;
}

.crowd-line.is-paused::after {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .crowd-line::before,
  .crowd-line.is-drawn::before {
    transform: none;
    animation: none;
  }
  .crowd-line::after {
    display: none;
  }
}

@keyframes line-draw {
  to {
    transform: scaleY(1);
  }
}

@keyframes line-glint {
  0% {
    opacity: 0;
    transform: translateY(-100%);
  }
  10% {
    opacity: 1;
  }
  50% {
    opacity: 1;
  }
  60% {
    opacity: 0;
    transform: translateY(250%);
  }
  100% {
    opacity: 0;
    transform: translateY(250%);
  }
}
</style>
