<script setup lang="ts">
import type { Sticker } from '@postpocket/presets'

/**
 * Kantong snack mengilap ala Day Pocket: tepi bergerigi, kilau plastik, stiker di depan, digantung
 * jepitan kayu, dan foto berbingkai yang menyelip di depannya. Versi `mini` untuk sel kalender.
 * `torn` menyobek pita atasnya: pita dan jepitan terlepas, kantong tersisa dengan tepi sobek.
 */
withDefaults(
  defineProps<{
    color: string
    sticker?: Sticker
    frame?: 'polaroid' | 'stamp' | 'ticket'
    frameColor?: string
    photoUrl?: string | null
    mini?: boolean
    torn?: boolean
  }>(),
  {
    sticker: undefined,
    frame: 'polaroid',
    frameColor: '#fbf6ec',
    photoUrl: null,
    mini: false,
    torn: false,
  },
)

// Bentuk kantong sebagai clip-path, dalam persen kotak kantong.
const TEETH = 14
const xs = Array.from({ length: TEETH * 2 + 1 }, (_, i) => (i / (TEETH * 2)) * 100)
const teeth = (y: number, depth: number) => xs.map((_, i) => (i % 2 ? y + depth : y))
// Garis sobek tepat di bawah pita atas. Acak tapi tetap, supaya bentuknya sama setiap kali.
const JITTER = [
  0.6, 1.8, 0.2, 1.2, 0.9, 2, 0.4, 1.5, 0.1, 1.1, 1.9, 0.5, 1.4, 0.3, 1.7, 0.8, 1.3, 0, 1.6, 0.7,
  1.9, 0.2, 1.2, 0.6, 1.8, 0.4, 1, 0.1, 1.5,
]
const ragged = xs.map((_, i) => 11 + (JITTER[i] ?? 0))
const polygon = (top: number[], bottom: number[]) => {
  const points = [...xs.map((x, i) => [x, top[i]!]), ...xs.map((x, i) => [x, bottom[i]!]).reverse()]
  return `polygon(${points.map(([x, y]) => `${x!.toFixed(2)}% ${y!.toFixed(2)}%`).join(', ')})`
}
const crimp = polygon(teeth(0, 2.4), teeth(100, -2.4))
const opened = polygon(ragged, teeth(100, -2.4))
const strip = polygon(teeth(0, 2.4), ragged)
</script>

<template>
  <div
    class="packet"
    :class="{ 'packet--mini': mini, 'is-torn': torn }"
    :style="{ '--packet': color }"
  >
    <div class="packet__body">
      <div class="packet__bag" :style="{ clipPath: torn ? opened : crimp }">
        <div class="packet__band packet__band--top" />
        <div class="packet__gloss" />
        <img
          v-if="sticker"
          class="packet__sticker"
          :src="sticker.src"
          :alt="mini ? '' : sticker.label"
          draggable="false"
        />
        <div class="packet__band packet__band--bottom" />
      </div>
    </div>
    <div class="packet__lid" aria-hidden="true">
      <div v-if="!mini" class="packet__bag packet__strip" :style="{ clipPath: strip }">
        <div class="packet__band packet__band--top" />
        <div class="packet__gloss" />
      </div>
      <span class="packet__clip clothespin" />
    </div>
    <div v-if="!mini && photoUrl" class="packet__photo">
      <PhotoFrame :variant="frame" :color="frameColor" :src="photoUrl" />
    </div>
  </div>
</template>

<style scoped>
.packet {
  position: relative;
  width: 100%;
  aspect-ratio: 0.74;
}

/* Bayangan di pembungkus: clip-path dijalankan setelah filter, jadi tidak bisa di elemen yang sama. */
.packet__body {
  position: absolute;
  inset: 0;
  filter: drop-shadow(0 12px 16px rgb(17 17 20 / 0.22));
}

.packet__bag {
  position: absolute;
  inset: 4% 6% 0;
  overflow: hidden;
  background:
    linear-gradient(
      100deg,
      transparent 16%,
      rgb(255 255 255 / 0.5) 25%,
      transparent 34%,
      transparent 62%,
      rgb(255 255 255 / 0.28) 69%,
      transparent 76%
    ),
    linear-gradient(
      to right,
      rgb(0 0 0 / 0.14),
      transparent 14%,
      transparent 86%,
      rgb(0 0 0 / 0.16)
    ),
    var(--packet);
}

.packet__band {
  position: absolute;
  inset-inline: 0;
  height: 11%;
  background:
    repeating-linear-gradient(to right, rgb(0 0 0 / 0.08) 0 2px, transparent 2px 6px),
    rgb(255 255 255 / 0.12);
}

.packet__band--top {
  top: 0;
  border-bottom: 1.5px dashed rgb(255 255 255 / 0.65);
}

.packet__band--bottom {
  bottom: 0;
}

.packet__gloss {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgb(255 255 255 / 0.3),
    transparent 24%,
    transparent 76%,
    rgb(0 0 0 / 0.12)
  );
  pointer-events: none;
}

.packet__sticker {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 46%;
  transform: translate(-50%, -46%) rotate(-6deg);
  filter: drop-shadow(0 4px 6px rgb(17 17 20 / 0.25));
  user-select: none;
}

/* Pita atas dan jepitan: satu potongan yang terlepas saat kantong disobek. */
.packet__lid {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  transform-origin: 20% 6%;
}

.packet__strip {
  opacity: 0;
}

.packet__clip {
  position: absolute;
  top: -5%;
  left: 45%;
  width: 10%;
  height: 20%;
}

.packet__photo {
  position: absolute;
  right: -6%;
  bottom: 5%;
  z-index: 2;
  width: 46%;
  transform: rotate(8deg);
}

/* Disobek: kantong tersentak, pita atas beserta jepitan terlepas miring lalu hilang. */
.is-torn .packet__body {
  animation: packet-jolt 420ms var(--ease-card);
}

.is-torn .packet__strip {
  opacity: 1;
}

.is-torn .packet__lid {
  animation: lid-off 760ms var(--ease-card) forwards;
}

@keyframes packet-jolt {
  35% {
    transform: translateY(2.5%) rotate(-1.2deg);
  }
}

@keyframes lid-off {
  25% {
    opacity: 1;
    transform: translate(-2%, -3%) rotate(-5deg);
  }
  100% {
    opacity: 0;
    transform: translate(-18%, -36%) rotate(-18deg);
  }
}

.packet--mini .packet__body {
  filter: drop-shadow(0 3px 4px rgb(17 17 20 / 0.2));
}

.packet--mini .packet__clip {
  top: -8%;
  left: 43%;
  width: 14%;
  height: 22%;
}

@media (prefers-reduced-motion: reduce) {
  .is-torn .packet__body {
    animation: none;
  }

  .is-torn .packet__lid {
    animation: none;
    opacity: 0;
  }
}
</style>
