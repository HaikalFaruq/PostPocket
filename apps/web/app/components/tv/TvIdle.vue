<script setup lang="ts">
/** Layar TV tanpa CD: noise, scanline, dan teks "NO SIGNAL" yang bergetar. */
</script>

<template>
  <div class="tv-idle absolute inset-0 grid place-items-center" data-testid="tv-idle">
    <TvEffects :effects="['noise', 'scanlines']" />
    <div class="relative text-center font-tv text-white">
      <p class="tv-idle__signal text-[clamp(28px,7vw,44px)] tracking-[0.18em]">NO SIGNAL</p>
      <p class="mt-1 text-[clamp(14px,3vw,18px)] tracking-[0.2em] opacity-70">MASUKKAN CD</p>
    </div>
  </div>
</template>

<style scoped>
.tv-idle {
  background: radial-gradient(circle at 50% 45%, rgb(255 255 255 / 0.08), transparent 70%);
}

.tv-idle__signal {
  text-shadow:
    2px 0 rgb(233 30 140 / 0.7),
    -2px 0 rgb(0 210 255 / 0.6);
  animation: tv-jitter 2.4s steps(1) infinite;
}

@keyframes tv-jitter {
  0%,
  86%,
  100% {
    transform: none;
  }
  88% {
    transform: translate(-3px, 1px);
  }
  92% {
    transform: translate(2px, -1px) skewX(-6deg);
  }
  96% {
    transform: translate(-1px, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tv-idle__signal {
    animation: none;
  }
}
</style>
