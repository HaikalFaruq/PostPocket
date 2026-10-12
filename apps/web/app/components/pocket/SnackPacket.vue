<script setup lang="ts">
import type { Sticker } from '@postpocket/presets'
import { packetTones } from '~/utils/color'
import { FOLDS, GROOVES, PACKET_SHAPE, wedge } from '~/utils/packet-art'
import {
  PACKET_H,
  PACKET_W,
  SEAL,
  TEAR_Y,
  liftAt,
  regionPath,
  tearBoundary,
  tearProgress,
  tornPath,
  type Tear,
} from '~/utils/packet-tear'

/**
 * Kantong snack foil (pillow pack) yang digambar sendiri dalam SVG: segel bergerigi beralur di atas
 * dan bawah, badan menggembung dengan sisi tertarik ke dalam, kerutan di empat sudut, dan kilau
 * plastik. Warnanya hanya `color`; bayangan dan kilaunya putih/hitam transparan, jadi cocok untuk
 * warna apa pun. Digantung jepitan kayu. Versi `mini` untuk sel kalender.
 *
 * `tear` membelah kantong di garis sobekan yang sedang dibuat (celahnya memperlihatkan lapisan
 * dalam foil), dan `opened` memisahkan kedua potongan: potongan atas tetap dijepit dan berayun,
 * badan kantong turun sedikit.
 */
const props = withDefaults(
  defineProps<{
    color: string
    sticker?: Sticker
    frame?: 'polaroid' | 'stamp' | 'ticket'
    frameColor?: string
    photoUrl?: string | null
    mini?: boolean
    /** Garis putus-putus dan takik: tanda tempat menggores, hanya di kantong yang bisa disobek. */
    guide?: boolean
    tear?: Tear | null
    opened?: boolean
    /** Langsung di keadaan akhir tanpa animasi, misalnya saat kembali ke kantong yang sudah dibuka. */
    instant?: boolean
  }>(),
  {
    sticker: undefined,
    frame: 'polaroid',
    frameColor: '#fbf6ec',
    photoUrl: null,
    mini: false,
    guide: false,
    tear: null,
    opened: false,
    instant: false,
  },
)

const uid = useId()
const ref$ = (name: string) => `${uid}-${name}`
const url = (name: string) => `url(#${ref$(name)})`

const B = PACKET_H - SEAL
const tones = computed(() => packetTones(props.color))
// Lipatan dari tepi ke tengah: bayangan lebar, kilau di punggung lipatan, dan kilap kecil di
// dekat tepi tempat foil paling melengkung.
const foldShadows = FOLDS.map((fold) => wedge(fold, 1.25))
const foldLights = FOLDS.map((fold) => wedge(fold, 0.8, 0.92))
const foldGlints = FOLDS.map((fold) => wedge(fold, 0.32, 0.5))

const split = computed(() => !props.mini && !!props.tear && tearProgress(props.tear) > 0.01)
const boundary = computed(() => (props.tear ? tearBoundary(props.tear) : []))
// Celah di bagian yang sudah sobek; setelah terbuka tidak dipakai lagi karena potongannya berpisah.
const lift = computed(() =>
  props.tear && !props.opened ? liftAt(props.tear, 3 + 5 * tearProgress(props.tear)) : () => 0,
)
const topClip = computed(() => (split.value ? regionPath(boundary.value, 'above', lift.value) : ''))
const bodyClip = computed(() => (split.value ? regionPath(boundary.value, 'below') : ''))
const frontEdge = computed(() => (props.tear ? tornPath(props.tear, () => 0, 0.7) : ''))
const topEdge = computed(() => (props.tear ? tornPath(props.tear, lift.value, -0.6) : ''))
// Lapisan belakang kantong robek sedikit lebih tinggi; terlihat di mulut kantong yang terbuka.
const backEdge = computed(() =>
  props.tear ? regionPath(boundary.value, 'below', (x) => 5 + Math.sin(x / 9) * 1.2) : '',
)
</script>

<template>
  <div
    class="packet"
    :class="{ 'packet--mini': mini, 'is-split': split, 'is-opened': opened, 'is-instant': instant }"
    :style="{ '--packet': color }"
  >
    <svg
      class="packet__art"
      :viewBox="`0 0 ${PACKET_W} ${PACKET_H}`"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath :id="ref$('shape')">
          <path :d="PACKET_SHAPE" />
        </clipPath>
        <!-- Badan menggembung seperti tabung: tepi pekat, kilau tipis di dekat tepi, tengah terang. -->
        <linearGradient :id="ref$('round')" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" :stop-color="tones.deeper" />
          <stop offset="0.035" :stop-color="tones.deep" />
          <stop offset="0.08" :stop-color="tones.light" />
          <stop offset="0.13" :stop-color="tones.base" />
          <stop offset="0.27" :stop-color="tones.soft" />
          <stop offset="0.4" :stop-color="tones.base" />
          <stop offset="0.64" :stop-color="tones.base" />
          <stop offset="0.78" :stop-color="tones.soft" />
          <stop offset="0.87" :stop-color="tones.light" />
          <stop offset="0.93" :stop-color="tones.deep" />
          <stop offset="1" :stop-color="tones.deeper" />
        </linearGradient>
        <!-- Bayangan di bawah segel atas dan di atas segel bawah, tempat foil tertarik. -->
        <linearGradient :id="ref$('pinch')" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0.083" :stop-color="tones.deep" stop-opacity="0.8" />
          <stop offset="0.13" :stop-color="tones.deep" stop-opacity="0.3" />
          <stop offset="0.22" :stop-color="tones.deep" stop-opacity="0" />
          <stop offset="0.76" :stop-color="tones.deep" stop-opacity="0" />
          <stop offset="0.87" :stop-color="tones.deep" stop-opacity="0.32" />
          <stop offset="0.917" :stop-color="tones.deep" stop-opacity="0.75" />
        </linearGradient>
        <radialGradient :id="ref$('dome')" cx="0.46" cy="0.36" r="0.44">
          <stop offset="0" :stop-color="tones.light" stop-opacity="0.75" />
          <stop offset="0.5" :stop-color="tones.light" stop-opacity="0.25" />
          <stop offset="1" :stop-color="tones.light" stop-opacity="0" />
        </radialGradient>
        <linearGradient :id="ref$('seal-top')" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" :stop-color="tones.soft" />
          <stop offset="1" :stop-color="tones.deep" />
        </linearGradient>
        <linearGradient :id="ref$('seal-bottom')" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" :stop-color="tones.deep" />
          <stop offset="1" :stop-color="tones.base" />
        </linearGradient>
        <linearGradient :id="ref$('inside')" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#cfd7de" />
          <stop offset="0.4" stop-color="#f4f7f9" />
          <stop offset="0.7" stop-color="#dfe6eb" />
          <stop offset="1" stop-color="#c3ccd4" />
        </linearGradient>
        <filter :id="ref$('blur-s')" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <filter :id="ref$('blur-m')" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
        <filter :id="ref$('lift')" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.24" />
        </filter>

        <g :id="ref$('art')">
          <g :clip-path="url('shape')">
            <rect :width="PACKET_W" :height="PACKET_H" :fill="url('round')" />
            <rect :width="PACKET_W" :height="PACKET_H" :fill="url('pinch')" />
            <template v-if="!mini">
              <g :filter="url('blur-m')" :fill="tones.deep" fill-opacity="0.55">
                <path v-for="d in foldShadows" :key="d" :d="d" transform="translate(0.8 2.6)" />
              </g>
              <g :filter="url('blur-s')">
                <path
                  v-for="d in foldLights"
                  :key="d"
                  :d="d"
                  :fill="tones.light"
                  fill-opacity="0.9"
                />
                <path v-for="d in foldGlints" :key="d" :d="d" fill="#fff" fill-opacity="0.42" />
              </g>
            </template>
            <rect :width="PACKET_W" :height="PACKET_H" :fill="url('dome')" />
            <!-- Segel atas dan bawah: rata, beralur, dengan lipatan ke badan kantong. -->
            <rect :width="PACKET_W" :height="SEAL" :fill="url('seal-top')" />
            <rect :y="B" :width="PACKET_W" :height="SEAL" :fill="url('seal-bottom')" />
            <g v-if="!mini" fill="none">
              <path
                v-for="y in GROOVES"
                :key="`d${y}`"
                :d="`M0 ${y} H200 M0 ${PACKET_H - y} H200`"
                :stroke="tones.deeper"
                stroke-opacity="0.35"
                stroke-width="0.9"
              />
              <path
                v-for="y in GROOVES"
                :key="`l${y}`"
                :d="`M0 ${y + 1.2} H200 M0 ${PACKET_H - y + 1.2} H200`"
                :stroke="tones.light"
                stroke-opacity="0.7"
                stroke-width="0.7"
              />
            </g>
            <path
              :d="`M0 ${SEAL} H200 M0 ${B} H200`"
              :stroke="tones.deeper"
              stroke-opacity="0.45"
              fill="none"
            />
            <path
              :d="`M0 ${SEAL + 1.5} H200 M0 ${B - 1.5} H200`"
              :stroke="tones.light"
              stroke-opacity="0.55"
              fill="none"
            />
            <image
              v-if="sticker"
              class="packet__sticker"
              :href="sticker.src"
              x="54"
              y="102"
              width="92"
              height="92"
              preserveAspectRatio="xMidYMid meet"
              transform="rotate(-6 100 148)"
              :filter="mini ? undefined : url('lift')"
            />
            <!-- Kilau plastik juga lewat di atas stiker, seperti dicetak di foil. -->
            <ellipse
              v-if="!mini"
              cx="88"
              cy="122"
              rx="16"
              ry="46"
              transform="rotate(32 88 122)"
              fill="#fff"
              fill-opacity="0.16"
              :filter="url('blur-m')"
            />
          </g>
        </g>

        <clipPath :id="ref$('top')">
          <path :d="topClip" />
        </clipPath>
        <clipPath :id="ref$('body')">
          <path :d="bodyClip" />
        </clipPath>
        <clipPath :id="ref$('back')">
          <path :d="backEdge" />
        </clipPath>
      </defs>

      <template v-if="!split">
        <use :href="`#${ref$('art')}`" />
        <!-- Garis putus-putus dan takik: tempat jari menggores untuk menyobek. -->
        <path
          v-if="guide && !mini"
          class="packet__guide"
          :d="`M9 ${TEAR_Y} H191`"
          :stroke="tones.deeper"
          stroke-opacity="0.55"
          stroke-width="1.1"
          stroke-dasharray="3.2 3.2"
          fill="none"
        />
      </template>
      <template v-else>
        <!-- Celah sobekan memperlihatkan lapisan dalam foil yang keperakan. -->
        <rect
          v-if="!opened"
          :y="TEAR_Y - 30"
          :width="PACKET_W"
          height="60"
          :fill="url('inside')"
          :clip-path="url('shape')"
        />
        <g class="packet__body">
          <g :clip-path="url('shape')">
            <rect
              v-if="opened"
              :width="PACKET_W"
              :height="PACKET_H"
              :fill="url('inside')"
              :clip-path="url('back')"
            />
          </g>
          <use :href="`#${ref$('art')}`" :clip-path="url('body')" />
          <path
            :d="frontEdge"
            fill="none"
            stroke="#fff"
            stroke-opacity="0.95"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </g>
        <g class="packet__top">
          <use :href="`#${ref$('art')}`" :clip-path="url('top')" />
          <path
            :d="topEdge"
            fill="none"
            stroke="#fff"
            stroke-opacity="0.9"
            stroke-width="1.3"
            stroke-linejoin="round"
          />
        </g>
      </template>
    </svg>
    <span class="packet__clip clothespin" aria-hidden="true" />
    <div v-if="!mini && photoUrl" class="packet__photo">
      <PhotoFrame :variant="frame" :color="frameColor" :src="photoUrl" />
    </div>
  </div>
</template>

<style scoped>
.packet {
  position: relative;
  width: 100%;
  aspect-ratio: 200 / 290;
}

.packet__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 14px 14px rgb(24 32 74 / 0.2)) drop-shadow(0 2px 2px rgb(24 32 74 / 0.12));
}

.packet__sticker {
  user-select: none;
}

.packet__clip {
  position: absolute;
  top: -6%;
  left: 46%;
  z-index: 2;
  width: 8%;
  height: 15%;
}

.packet__photo {
  position: absolute;
  right: -10%;
  bottom: 4%;
  z-index: 2;
  width: 46%;
  transform: rotate(8deg);
}

.packet__body,
.packet__top {
  transform-box: view-box;
}

/* Terbuka: badan kantong turun dan sedikit miring, potongan atas berayun di jepitannya. */
.is-opened .packet__body {
  transform: translateY(16px) rotate(-1.4deg);
  transform-origin: 50% 100%;
  transition: transform 700ms cubic-bezier(0.3, 1.45, 0.5, 1);
}

.is-opened .packet__top {
  transform-origin: 50% 0%;
  animation: lid-swing 1600ms ease-out;
}

@keyframes lid-swing {
  15% {
    transform: rotate(5deg);
  }
  40% {
    transform: rotate(-3deg);
  }
  65% {
    transform: rotate(1.4deg);
  }
  85% {
    transform: rotate(-0.5deg);
  }
}

.packet--mini .packet__art {
  filter: drop-shadow(0 3px 3px rgb(24 32 74 / 0.2));
}

.packet--mini .packet__clip {
  top: -9%;
  left: 43%;
  width: 14%;
  height: 22%;
}

.is-instant .packet__body,
.is-instant .packet__top {
  transition: none;
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .is-opened .packet__body,
  .is-opened .packet__top {
    transition: none;
    animation: none;
  }
}
</style>
