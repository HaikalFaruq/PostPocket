<script setup lang="ts">
/** Bingkai foto Polaroid, Prangko, atau Tiket bioskop. Dipakai Pocket, Booth, dan Letter. */
const props = withDefaults(
  defineProps<{
    variant?: 'polaroid' | 'stamp' | 'ticket'
    /** Warna bingkai (hex), biasanya dari preset `pocket.frameColors`. */
    color?: string
    src?: string
    alt?: string
    caption?: string
  }>(),
  { variant: 'polaroid', color: '#fbf6ec', src: undefined, alt: '', caption: undefined },
)

const inkColor = computed(() =>
  isDark(props.color) ? 'rgb(255 255 255 / 0.9)' : 'rgb(17 17 20 / 0.72)',
)
</script>

<template>
  <!-- Bayangan di <figure>, mask di lapisan kertas: mask dijalankan setelah filter. -->
  <figure
    class="photo-frame"
    :class="[`is-${variant}`, { 'has-caption': caption }]"
    :style="{ '--frame': color, '--frame-ink': inkColor }"
  >
    <div class="photo-frame__paper">
      <div class="photo-frame__photo">
        <img v-if="src" :src="src" :alt="alt" class="size-full object-cover" draggable="false" />
        <div v-else class="grid size-full place-items-center p-4 text-center text-caption">
          <slot>Tambahkan foto untuk melihat bingkainya</slot>
        </div>
      </div>
      <figcaption v-if="caption" class="photo-frame__caption">{{ caption }}</figcaption>
    </div>
  </figure>
</template>

<style scoped>
.photo-frame {
  color: var(--frame-ink);
  filter: drop-shadow(0 10px 14px rgb(17 17 20 / 0.16)) drop-shadow(0 1px 1px rgb(17 17 20 / 0.12));
}

.photo-frame__paper {
  position: relative;
  background-color: var(--frame);
}

.photo-frame__paper::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--texture-paper);
  opacity: 0.16;
  mix-blend-mode: multiply;
  pointer-events: none;
}

.photo-frame__photo {
  position: relative;
  overflow: hidden;
  background-color: rgb(17 17 20 / 0.06);
}

.is-polaroid .photo-frame__paper {
  padding: 7% 7% 24%;
}

.is-polaroid.has-caption .photo-frame__paper {
  padding-bottom: 0;
}

.is-polaroid .photo-frame__photo {
  aspect-ratio: 1;
}

.is-polaroid .photo-frame__caption {
  display: grid;
  place-items: center;
  min-height: 2.6em;
  padding: 0.35em 0.5em 0.5em;
  font-family: var(--font-letter);
  font-size: 1.25em;
  line-height: 1;
}

/* Tepi bergerigi: lubang setengah lingkaran di sepanjang tepi, bagian tengah tetap utuh. */
.is-stamp .photo-frame__paper {
  --r: 5px;
  padding: calc(var(--r) * 2.8);
  mask:
    radial-gradient(var(--r), #0000 98%, #000) round calc(-1.5 * var(--r)) calc(-1.5 * var(--r)) /
      calc(3 * var(--r)) calc(3 * var(--r)),
    linear-gradient(#000 0 0) no-repeat 50% / calc(100% - 3 * var(--r)) calc(100% - 3 * var(--r));
}

.is-stamp .photo-frame__photo {
  aspect-ratio: 4 / 5;
}

/* Tiket bioskop: takik setengah lingkaran di kiri dan kanan, garis sobek putus-putus di dalam. */
.is-ticket .photo-frame__paper {
  --n: 11px;
  padding: 12px 22px;
  mask:
    radial-gradient(circle at 0 50%, #0000 var(--n), #000 calc(var(--n) + 0.5px)) left / 51% 100%
      no-repeat,
    radial-gradient(circle at 100% 50%, #0000 var(--n), #000 calc(var(--n) + 0.5px)) right / 51%
      100% no-repeat;
}

.is-ticket .photo-frame__photo {
  aspect-ratio: 4 / 3;
  outline: 1.5px dashed color-mix(in srgb, var(--frame-ink) 45%, transparent);
  outline-offset: 5px;
}

.is-stamp .photo-frame__caption,
.is-ticket .photo-frame__caption {
  padding-top: 0.7em;
  font-family: var(--font-mono);
  font-size: 0.7em;
  letter-spacing: 0.2em;
  text-align: center;
  text-transform: uppercase;
}
</style>
