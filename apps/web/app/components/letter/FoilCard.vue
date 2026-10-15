<script setup lang="ts">
import type { FoilColor, Paper } from '@postpocket/presets'

/**
 * Kartu lipat bercetak foil 3D (CSS 3D, tanpa WebGL).
 * Drag untuk memutar sampai sampul belakang, tap atau Enter untuk membuka dan menutup.
 * Bentuk lapisan foil diambil dari `foilMask`; warnanya dari preset `foil`.
 */
const props = withDefaults(
  defineProps<{
    /** Gambar depan yang dicetak biasa (ilustrasi atau foto user). */
    art?: string
    /** Gambar yang alpha-nya menentukan bagian foil. */
    foilMask?: string
    foil: FoilColor
    paper: Paper
    /** Lebar dibagi tinggi. */
    ratio?: number
    foilBorder?: boolean
    label?: string
  }>(),
  {
    art: undefined,
    foilMask: undefined,
    ratio: 0.72,
    foilBorder: false,
    label: 'Kartu surat',
  },
)

const open = defineModel<boolean>('open', { default: false })

const stage = ref<HTMLElement | null>(null)
const rotor = ref<HTMLElement | null>(null)
const { width: stageWidth, height: stageHeight } = useElementSize(stage)

// Proporsi meniru Foil Studio: kartu kira-kira 70% tinggi area, dengan ruang napas di sekitarnya.
const cardWidth = computed(() =>
  Math.max(140, Math.min(stageWidth.value * 0.78, stageHeight.value * 0.72 * props.ratio)),
)
const cardHeight = computed(() => cardWidth.value / props.ratio)
// Sebelum ukuran area terbaca, kartu disembunyikan. Tanpa ini kartu sempat tampil 140 px lalu
// melompat ke ukuran sebenarnya, dan halaman penerima mendapat layout shift.
const measured = computed(() => stageWidth.value > 0 && stageHeight.value > 0)

// Gambar depan muncul pelan begitu termuat, bukan muncul tiba-tiba di atas kartu kosong.
const artLoaded = ref(false)
function onArtSettled() {
  artLoaded.value = true
}

// Isi kartu (termasuk foto-fotonya) baru dirender saat kartu dibuka, atau saat browser senggang
// setelah gambar depan termuat (tanpa gambar depan: setelah halaman dimuat), supaya foto isi
// tidak berebut jaringan dengan gambar depan.
const insideReady = ref(false)
watch(open, (isOpen) => isOpen && (insideReady.value = true), { immediate: true })
onMounted(() => {
  const ready = () => (insideReady.value = true)
  const later = () =>
    'requestIdleCallback' in window
      ? window.requestIdleCallback(ready, { timeout: 1500 })
      : setTimeout(ready, 300)
  if (props.art) watch(artLoaded, (loaded) => loaded && later(), { immediate: true })
  else if (document.readyState === 'complete') later()
  else window.addEventListener('load', later, { once: true })
})
/** Kartu terbuka dua kali lebih lebar, jadi diperkecil supaya tetap ada jarak ke tepi. */
const openScale = computed(() => Math.min(0.9, (stageWidth.value * 0.86) / (cardWidth.value * 2)))

const motion = useCardMotion({
  stage,
  rotor,
  open,
  onTap: toggle,
})

function toggle() {
  if (!open.value) motion.faceFront()
  open.value = !open.value
}

const cardStyle = computed(() => ({
  width: `${cardWidth.value}px`,
  height: `${cardHeight.value}px`,
  '--paper': props.paper.color,
  '--paper-ink': props.paper.textColor,
  '--metal': metalGradient(props.foil),
  '--sheen': String(props.foil.sheen),
  '--open-scale': String(openScale.value),
}))

const maskStyle = computed(() =>
  props.foilMask
    ? { maskImage: `url("${props.foilMask}")`, WebkitMaskImage: `url("${props.foilMask}")` }
    : undefined,
)

defineExpose({ turnBy: motion.turnBy, benchmark: motion.benchmark })
</script>

<template>
  <div ref="stage" class="foil-stage">
    <div
      class="foil-shadow"
      :class="{ 'is-open': open, 'is-measuring': !measured }"
      :style="{
        width: `${cardWidth}px`,
        '--open-scale': String(openScale),
        '--lift': `${cardHeight / 2}px`,
      }"
      aria-hidden="true"
    />
    <div
      ref="rotor"
      class="foil-rotor"
      :class="{ 'is-measuring': !measured }"
      :style="cardStyle"
      role="button"
      tabindex="0"
      :aria-label="`${label}. ${open ? 'Terbuka' : 'Tertutup'}. Tekan Enter untuk ${open ? 'menutup' : 'membuka'}, panah kiri atau kanan untuk membalik.`"
      :aria-pressed="open"
      @pointerdown="motion.onPointerDown"
      @pointermove="motion.onPointerMove"
      @pointerup="motion.onPointerUp"
      @pointercancel="motion.onPointerCancel"
      @pointerleave="motion.onPointerLeave"
      @keydown="motion.onKeydown"
    >
      <div class="foil-spread" :class="{ 'is-open': open }">
        <!-- Lembar belakang: halaman surat di depan, sampul belakang di baliknya. -->
        <div class="foil-leaf">
          <div class="foil-face foil-face--inside">
            <div class="foil-grain" />
            <div class="foil-content">
              <slot v-if="insideReady" name="inside" />
            </div>
          </div>
          <div class="foil-face foil-face--back">
            <div class="foil-grain" />
            <slot name="back">
              <div class="foil-back">
                <div class="foil-mask foil-back__mark" aria-hidden="true">
                  <div class="foil-metal" />
                  <div class="foil-glare" />
                </div>
                <span class="foil-back__brand">PostPocket</span>
              </div>
            </slot>
          </div>
        </div>

        <!-- Lembar depan: sampul foil, dengan bagian dalam sampul di baliknya. -->
        <div class="foil-leaf foil-leaf--front">
          <div class="foil-face foil-face--front">
            <!-- crossorigin sama dengan pemuat kanvas (peta foil), jadi preload dari halaman
                 surat terpakai dan gambarnya tidak diunduh dua kali. -->
            <img
              v-if="art"
              class="foil-art"
              :class="{ 'is-loaded': artLoaded }"
              :src="art"
              alt=""
              draggable="false"
              fetchpriority="high"
              crossorigin="anonymous"
              @load="onArtSettled"
              @error="onArtSettled"
            />
            <div class="foil-grain" />
            <template v-if="foilMask">
              <div class="foil-mask foil-mask--emboss" :style="maskStyle" />
              <div class="foil-mask" :style="maskStyle">
                <div class="foil-metal" />
                <div class="foil-glitter" />
                <div class="foil-glare" />
              </div>
            </template>
            <div v-if="foilBorder" class="foil-border">
              <div class="foil-metal" />
              <div class="foil-glare" />
            </div>
            <div class="foil-paper-glare" />
          </div>
          <div class="foil-face foil-face--inside-cover">
            <div class="foil-grain" />
            <slot name="inside-cover" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.is-measuring {
  visibility: hidden;
}

.foil-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  perspective: 1400px;
  user-select: none;
  -webkit-user-select: none;
}

.foil-shadow {
  position: absolute;
  top: 50%;
  left: 50%;
  height: 46px;
  background: radial-gradient(closest-side, rgb(17 17 20 / 0.22), rgb(17 17 20 / 0));
  transform: translate(-50%, calc(var(--lift) - 18px));
  transition: transform var(--card-open-ms) var(--ease-card);
  pointer-events: none;
}

.foil-shadow.is-open {
  transform: translate(-50%, calc(var(--lift) * var(--open-scale) - 18px))
    scaleX(calc(var(--open-scale) * 2));
}

.foil-rotor {
  position: relative;
  transform-style: preserve-3d;
  will-change: transform;
  touch-action: none;
  cursor: grab;
  outline: none;
}

.foil-rotor:active {
  cursor: grabbing;
}

.foil-rotor:focus-visible .foil-face--front,
.foil-rotor:focus-visible .foil-face--inside {
  outline: 2px solid var(--color-ink);
  outline-offset: 6px;
}

.foil-spread,
.foil-leaf {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
}

/* Saat terbuka, lipatan (tepi kiri) pindah ke tengah lalu diperkecil kalau perlu. */
.foil-spread {
  transform-origin: 0 50%;
  transition: transform var(--card-open-ms) var(--ease-card);
}

.foil-spread.is-open {
  transform: translateX(50%) scale(var(--open-scale));
}

.foil-leaf--front {
  transform-origin: 0 50%;
  transform: translateZ(1px);
  transition: transform var(--card-open-ms) var(--ease-card);
}

.foil-spread.is-open .foil-leaf--front {
  transform: translateZ(1px) rotateY(-180deg);
}

.foil-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 3px;
  background-color: var(--paper);
  color: var(--paper-ink);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  container-type: size;
}

.foil-face--back,
.foil-face--inside-cover {
  transform: rotateY(180deg);
}

.foil-face--front,
.foil-face--back {
  box-shadow: inset 0 0 0 0.5px rgb(17 17 20 / 0.08);
}

.foil-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  opacity: 0;
  transition: opacity 240ms ease-out;
}

.foil-art.is-loaded {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .foil-art {
    transition: none;
  }
}

.foil-grain {
  position: absolute;
  inset: 0;
  background-image: var(--texture-paper);
  background-size: 160px;
  opacity: 0.1;
  mix-blend-mode: multiply;
  pointer-events: none;
}

.foil-mask {
  position: absolute;
  inset: 0;
  overflow: hidden;
  mask-size: cover;
  mask-position: center;
  mask-repeat: no-repeat;
  -webkit-mask-size: cover;
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
}

/* Bayangan diam di bawah foil supaya terlihat sedikit timbul. */
.foil-mask--emboss {
  background-color: rgb(17 17 20 / 0.32);
  transform: translate(0.5px, 1px);
}

.foil-metal {
  position: absolute;
  inset: -25%;
  background-image: var(--metal);
  transform: translate3d(var(--mx, 0%), var(--my, 0%), 0);
}

.foil-glitter {
  position: absolute;
  inset: 0;
  background-image: var(--texture-glitter);
  background-size: 90px;
  mix-blend-mode: overlay;
  opacity: 0.5;
}

.foil-glare,
.foil-paper-glare {
  position: absolute;
  inset: -50%;
  transform: translate3d(var(--gx, 0%), var(--gy, 0%), 0);
  pointer-events: none;
}

.foil-glare {
  background: radial-gradient(circle, rgb(255 255 255 / 0.9), rgb(255 255 255 / 0) 30%);
  mix-blend-mode: overlay;
  opacity: var(--sheen);
}

.foil-paper-glare {
  background: radial-gradient(circle, rgb(255 255 255 / 0.32), rgb(255 255 255 / 0) 34%);
  mix-blend-mode: soft-light;
}

/*
 * Bingkai foil: dua garis, tebal di luar dan tipis di dalam, dengan gradien logam yang sama.
 * Bentuknya dari clip-path evenodd dengan empat persegi bersarang, bukan mask-composite: begitu
 * `-webkit-mask` menimpa `mask`, Chrome menggabung kedua lapisan topengnya dan seluruh bidang di
 * dalam bingkai ikut jadi foil. Jaraknya dalam cqmin, jadi sama di keempat sisi kartu.
 */
.foil-border {
  --rule: max(1.5px, 0.8cqmin);
  --gap: max(1.5px, 0.9cqmin);
  --hair: max(1px, 0.35cqmin);
  --in-1: var(--rule);
  --in-2: calc(var(--rule) + var(--gap));
  --in-3: calc(var(--rule) + var(--gap) + var(--hair));
  position: absolute;
  inset: 4cqmin;
  overflow: hidden;
  clip-path: polygon(
    evenodd,
    0 0,
    100% 0,
    100% 100%,
    0 100%,
    0 0,
    var(--in-1) var(--in-1),
    var(--in-1) calc(100% - var(--in-1)),
    calc(100% - var(--in-1)) calc(100% - var(--in-1)),
    calc(100% - var(--in-1)) var(--in-1),
    var(--in-1) var(--in-1),
    var(--in-2) var(--in-2),
    calc(100% - var(--in-2)) var(--in-2),
    calc(100% - var(--in-2)) calc(100% - var(--in-2)),
    var(--in-2) calc(100% - var(--in-2)),
    var(--in-2) var(--in-2),
    var(--in-3) var(--in-3),
    var(--in-3) calc(100% - var(--in-3)),
    calc(100% - var(--in-3)) calc(100% - var(--in-3)),
    calc(100% - var(--in-3)) var(--in-3),
    var(--in-3) var(--in-3)
  );
}

.foil-content {
  position: absolute;
  inset: 0;
  padding: 10cqw 9cqw;
  font-family: var(--font-letter);
  word-spacing: var(--letter-word-spacing);
  font-size: 8cqw;
  line-height: 1.25;
}

.foil-back {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: end center;
  padding-bottom: 14cqh;
}

.foil-back__mark {
  top: auto;
  bottom: 22cqh;
  left: 50%;
  width: 16cqw;
  height: 22cqw;
  transform: translateX(-50%);
  mask-image: url('/illustrations/mark-foil.svg');
  -webkit-mask-image: url('/illustrations/mark-foil.svg');
  mask-size: contain;
  -webkit-mask-size: contain;
}

.foil-back__brand {
  font-family: var(--font-mono);
  font-size: 3.4cqw;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  opacity: 0.55;
}
</style>
