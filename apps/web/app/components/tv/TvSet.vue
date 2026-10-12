<script setup lang="ts">
/**
 * Badan TV clay: dua antena, layar dengan slot CD di bawahnya, panel gelap di kanan, dan dua kaki.
 * Warnanya hanya variabel CSS `--clay`, jadi ganti warna tidak memuat gambar baru (PRD).
 * Slot CD punya tiga keadaan: kosong, terbuka (siap menelan piringan), dan berisi (lampunya
 * menyala). `drop` menandai piringan yang sedang diseret di atas TV.
 */
withDefaults(
  defineProps<{ clay: string; slotState?: 'idle' | 'open' | 'loaded'; drop?: boolean }>(),
  { slotState: 'idle', drop: false },
)
const root = ref<HTMLElement | null>(null)
const slotEl = ref<HTMLElement | null>(null)
const screenEl = ref<HTMLElement | null>(null)
defineExpose({ root, slotEl, screenEl })
</script>

<template>
  <div ref="root" class="tv" :class="{ 'is-drop': drop }" :style="{ '--clay': clay }">
    <span class="tv-antenna tv-antenna--left" aria-hidden="true" />
    <span class="tv-antenna tv-antenna--right" aria-hidden="true" />
    <div class="tv-body">
      <div class="tv-front">
        <div ref="screenEl" class="tv-screen" data-testid="tv-screen">
          <slot name="screen" />
        </div>
        <div
          ref="slotEl"
          class="tv-slot"
          :class="`is-${slotState}`"
          data-testid="tv-slot"
          :data-state="slotState"
          aria-hidden="true"
        >
          <span class="tv-slot__mouth" />
          <span class="tv-slot__led" />
        </div>
      </div>
      <div class="tv-panel">
        <slot name="panel" />
      </div>
    </div>
    <div class="tv-legs" aria-hidden="true"><span /><span /></div>
  </div>
</template>

<style scoped>
.tv {
  position: relative;
  width: 100%;
  max-width: 760px;
  margin-inline: auto;
  padding-top: 52px;
}

.tv-antenna {
  position: absolute;
  top: 6px;
  left: 50%;
  width: 4px;
  height: 58px;
  border-radius: 4px;
  background: var(--clay);
  filter: brightness(0.78);
  transform-origin: bottom center;
  transition: background-color 250ms;
}

.tv-antenna::before {
  content: '';
  position: absolute;
  top: -9px;
  left: -5px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: inherit;
}

.tv-antenna--left {
  transform: translateX(-26px) rotate(-30deg);
}

.tv-antenna--right {
  transform: translateX(22px) rotate(30deg);
}

.tv-body {
  position: relative;
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: 36px;
  background: var(--clay);
  box-shadow:
    inset 0 -12px 0 rgb(0 0 0 / 0.09),
    inset 0 8px 0 rgb(255 255 255 / 0.3),
    inset 0 0 0 1px rgb(255 255 255 / 0.18),
    0 26px 44px -22px rgb(24 32 74 / 0.5);
  transition:
    background-color 250ms,
    box-shadow 200ms,
    transform 200ms var(--ease-card);
}

/* Kilau tanah liat: cahaya dari kiri atas dan bayangan lembut di bawah, apa pun warnanya. */
.tv-body::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    linear-gradient(160deg, rgb(255 255 255 / 0.3), transparent 32%),
    radial-gradient(120% 70% at 50% 115%, rgb(0 0 0 / 0.14), transparent 60%);
  pointer-events: none;
}

.tv-front,
.tv-panel {
  position: relative;
}

/* Piringan yang diseret di atas TV: badannya sedikit terangkat dan bercahaya. */
.tv.is-drop .tv-body {
  box-shadow:
    inset 0 -12px 0 rgb(0 0 0 / 0.09),
    inset 0 8px 0 rgb(255 255 255 / 0.3),
    0 0 0 4px color-mix(in srgb, var(--color-tv-glow) 55%, transparent),
    0 30px 50px -22px rgb(24 32 74 / 0.55);
  transform: scale(1.01);
}

@media (min-width: 640px) {
  .tv-body {
    grid-template-columns: 1fr 36%;
    padding: 26px;
    border-radius: 48px;
  }
}

.tv-screen {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 26px;
  background: var(--color-ink);
  box-shadow:
    inset 0 0 0 6px rgb(0 0 0 / 0.28),
    inset 0 0 42px rgb(0 0 0 / 0.85);
  isolation: isolate;
}

/* Slot CD: celah gelap di badan TV, dengan lampu kecil yang menyala kalau ada CD di dalamnya. */
.tv-slot {
  position: relative;
  display: grid;
  width: 58%;
  height: 16px;
  margin: 12px auto 0;
  place-items: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--clay) 80%, black);
  box-shadow:
    inset 0 2px 3px rgb(0 0 0 / 0.3),
    0 1px 0 rgb(255 255 255 / 0.35);
  transition: background-color 250ms;
}

.tv-slot__mouth {
  width: 84%;
  height: 4px;
  border-radius: 4px;
  background: #0b0d18;
  box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.8);
  transition:
    height 200ms var(--ease-card),
    box-shadow 200ms;
}

.tv-slot.is-open .tv-slot__mouth {
  height: 6px;
  box-shadow:
    0 0 12px 2px color-mix(in srgb, var(--color-tv-glow) 70%, transparent),
    inset 0 1px 2px rgb(0 0 0 / 0.8);
}

.tv-slot__led {
  position: absolute;
  top: 50%;
  right: 3.5%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgb(0 0 0 / 0.35);
  transform: translateY(-50%);
  transition:
    background-color 200ms,
    box-shadow 200ms;
}

.tv-slot.is-loaded .tv-slot__led {
  background: #7dffb6;
  box-shadow: 0 0 6px #7dffb6;
}

.tv-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 24px;
  background: var(--color-tv-panel);
  color: var(--color-tv-panel-ink);
}

.tv-legs {
  display: flex;
  justify-content: space-between;
  padding: 0 22%;
}

.tv-legs span {
  width: 30px;
  height: 22px;
  border-radius: 0 0 10px 10px;
  background: var(--clay);
  filter: brightness(0.82);
  transition: background-color 250ms;
}

@media (prefers-reduced-motion: reduce) {
  .tv-body,
  .tv-slot__mouth {
    transition: none;
  }

  .tv.is-drop .tv-body {
    transform: none;
  }
}
</style>
