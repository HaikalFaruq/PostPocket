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

/* Garisnya: memudar dari atas, digambar sekali saat pertama terlihat. */
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
  animation: line-draw 900ms var(--ease-sheet) forwards;
}

.crowd-line.is-drawn::after {
  animation: line-glint 2800ms var(--ease-sheet) 900ms infinite;
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
  20% {
    opacity: 1;
  }
  65% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(250%);
  }
}
</style>
