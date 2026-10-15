<script setup lang="ts">
import { BRAND_SYMBOL } from '~/utils/brand-logo'
import { BRAND_SIGNATURE } from '~/utils/brand-signature'
import { SPLASH_MS, splashRoute } from '~/utils/splash'

/**
 * Splash di awal setiap sesi (docs/desain.md bagian Splash). Logo P-amplop terbentuk: garisnya
 * digambar, tinta mengisinya dari bawah, tutup amplop emas melipat turun, lalu kilau foil lewat.
 * Di bawahnya "PostPocket" ditulis tangan huruf demi huruf, seperti tanda tangan di surat.
 *
 * Seluruh animasinya CSS, jadi sudah berjalan sejak HTML pertama tergambar, sebelum JavaScript
 * selesai dimuat. Skrip di <head> (app/utils/splash.ts) menyembunyikannya lebih dulu kalau tidak
 * perlu. Ketukan atau tombol apa pun melewatinya.
 */
const route = useRoute()
const shown = ref(splashRoute(route.path))
const leaving = ref(false)
const maskId = useId()
const clipId = useId()
const glintId = useId()
let timer: ReturnType<typeof setTimeout> | undefined

function finish() {
  shown.value = false
  clearTimeout(timer)
  removeEventListener('keydown', skip)
}

function skip() {
  if (leaving.value) return
  leaving.value = true
  clearTimeout(timer)
  timer = setTimeout(finish, 260)
}

onMounted(() => {
  if (!shown.value) return
  if (document.documentElement.dataset.splash === 'skip') return finish()
  timer = setTimeout(finish, SPLASH_MS)
  addEventListener('keydown', skip)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  removeEventListener('keydown', skip)
})

const pad = 4
const symbolBox = `${-pad} ${-pad} ${BRAND_SYMBOL.width + pad * 2} ${BRAND_SYMBOL.height + pad * 2}`
// Ruang untuk goresan penyingkap selebar 22 di sekeliling huruf.
const sig = BRAND_SIGNATURE
const signature = {
  x: -12,
  y: -sig.ascent - 12,
  width: sig.width + 24,
  height: sig.ascent + sig.descent + 24,
}
const signatureBox = `${signature.x} ${signature.y} ${signature.width} ${signature.height}`
</script>

<template>
  <div
    v-if="shown"
    class="splash"
    :class="{ 'is-leaving': leaving }"
    aria-hidden="true"
    data-testid="splash"
    @pointerdown="skip"
  >
    <div class="splash-stage">
      <div class="mark">
        <!-- 1. Garis P digambar dengan satu goresan tipis. -->
        <svg class="mark-layer" :viewBox="symbolBox">
          <path class="mark-line" :d="BRAND_SYMBOL.outline" pathLength="1" />
        </svg>
        <!-- 2. Tinta mengisi P dari bawah, dengan lubang tutup amplopnya. -->
        <div class="mark-fill">
          <svg class="mark-layer" :viewBox="symbolBox">
            <path fill-rule="evenodd" :d="`${BRAND_SYMBOL.outline} ${BRAND_SYMBOL.flap}`" />
          </svg>
        </div>
        <!-- 3. Tutup amplop emas melipat turun ke lubangnya, lalu kilau foil lewat sekali. -->
        <svg class="mark-layer" :viewBox="symbolBox">
          <defs>
            <clipPath :id="clipId"><path :d="BRAND_SYMBOL.flap" /></clipPath>
            <linearGradient :id="glintId" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stop-color="#fff" stop-opacity="0" />
              <stop offset="0.5" stop-color="#fff" stop-opacity="0.9" />
              <stop offset="1" stop-color="#fff" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path class="mark-flap" :d="BRAND_SYMBOL.flap" />
          <g :clip-path="`url(#${clipId})`">
            <rect
              class="mark-glint"
              x="4"
              y="30"
              width="34"
              height="46"
              :fill="`url(#${glintId})`"
            />
          </g>
        </svg>
      </div>

      <!-- Tanda tangan: tiap huruf digores tipis, dan goresan tebal di topeng menyingkap isinya. -->
      <svg class="signature" :viewBox="signatureBox">
        <defs>
          <!-- Wilayah topeng ditulis sendiri: bawaannya (−10% sampai 120% dari titik 0) tidak
               mencakup huruf yang berada di atas garis dasar, di y negatif. -->
          <mask
            :id="maskId"
            maskUnits="userSpaceOnUse"
            :x="signature.x"
            :y="signature.y"
            :width="signature.width"
            :height="signature.height"
          >
            <path
              v-for="(d, i) in sig.glyphs"
              :key="i"
              class="sig-reveal"
              :style="{ '--i': i }"
              :d="d"
              pathLength="1"
            />
          </mask>
        </defs>
        <path
          v-for="(d, i) in sig.glyphs"
          :key="i"
          class="sig-line"
          :style="{ '--i': i }"
          :d="d"
          pathLength="1"
        />
        <g :mask="`url(#${maskId})`" class="sig-ink">
          <path v-for="(d, i) in sig.glyphs" :key="i" :d="d" />
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
/*
 * Linimasa (ms): garis P 80–780, isi 480–1080, tutup 820–1440, kilau 1360–2060, tanda tangan
 * 900–2235 (tiap huruf 75 ms setelah sebelumnya), keluar 2340–2800 (sama dengan SPLASH_MS).
 * Kurvanya --ease-sheet, kurva lift Hairline, kecuali tutup yang sedikit memantul saat menutup.
 */
.splash {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: var(--color-canvas);
  animation: splash-out 460ms var(--ease-sheet) 2340ms forwards;
}

/* Kisi titik yang sama dengan panggung figur Hairline di Beranda, memudar ke tepi. */
.splash::before {
  content: '';
  position: absolute;
  inset: 18% 10%;
  background-image:
    radial-gradient(circle, var(--color-line) 0.8px, transparent 1.1px),
    radial-gradient(circle, var(--color-line) 0.8px, transparent 1.1px);
  background-position:
    0 0,
    7px 3.5px;
  background-size: 14px 7px;
  mask-image: radial-gradient(closest-side, #000 30%, transparent);
  opacity: 0;
  animation: fade-in 900ms var(--ease-sheet) forwards;
}

.splash.is-leaving {
  animation: splash-out 240ms var(--ease-sheet) forwards;
}

@media (prefers-reduced-motion: reduce) {
  .splash {
    display: none;
  }
}

.splash-stage {
  position: relative;
  display: grid;
  justify-items: center;
  gap: clamp(18px, 3.5vh, 28px);
  animation: stage-out 460ms var(--ease-sheet) 2340ms forwards;
}

.mark {
  position: relative;
  height: clamp(116px, 30vw, 156px);
  aspect-ratio: 168 / 192;
  animation: mark-in 900ms var(--ease-sheet) both;
}

.mark-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.mark-line {
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 700ms var(--ease-sheet) 80ms forwards;
}

.mark-fill {
  position: absolute;
  inset: 0;
  fill: var(--color-ink);
  clip-path: inset(100% 0 0 0);
  animation: wipe 600ms var(--ease-sheet) 480ms forwards;
}

.mark-flap {
  fill: var(--color-brand-gold);
  transform-box: fill-box;
  transform-origin: 50% 0;
  animation: flap 620ms cubic-bezier(0.34, 1.4, 0.64, 1) 820ms both;
}

.mark-glint {
  animation: glint 700ms var(--ease-sheet) 1360ms both;
}

.signature {
  width: clamp(240px, 68vw, 340px);
  overflow: visible;
}

.sig-line {
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 640ms ease-in-out calc(900ms + var(--i) * 75ms) forwards;
}

.sig-reveal {
  fill: none;
  stroke: #fff;
  stroke-width: 22;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 640ms ease-in-out calc(900ms + var(--i) * 75ms) forwards;
}

.sig-ink {
  fill: var(--color-ink);
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes wipe {
  to {
    clip-path: inset(0 0 0 0);
  }
}

@keyframes flap {
  0% {
    opacity: 0;
    transform: scaleY(-1);
  }
  15% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: scaleY(1);
  }
}

@keyframes glint {
  from {
    transform: translateX(-40px);
  }
  to {
    transform: translateX(150px);
  }
}

@keyframes mark-in {
  from {
    transform: translateY(8px) scale(0.94);
  }
}

@keyframes fade-in {
  to {
    opacity: 1;
  }
}

@keyframes stage-out {
  to {
    transform: translateY(-10px) scale(1.04);
  }
}

@keyframes splash-out {
  to {
    opacity: 0;
    visibility: hidden;
  }
}
</style>

<style>
/*
 * Sengaja tidak scoped: skrip <head> menandai <html> sebelum halaman tergambar, dan hanya
 * splash-nya yang disembunyikan. (Lewat :global() di blok scoped, Vue membuang `.splash` dan yang
 * tersembunyi seluruh <html>.)
 */
html[data-splash='skip'] .splash {
  display: none;
}
</style>
