<script setup lang="ts">
/**
 * Badan TV clay: dua antena, layar dengan slot CD di bawahnya, panel gelap di kanan, dan dua kaki.
 * Warnanya hanya variabel CSS `--clay`, jadi ganti warna tidak memuat gambar baru (PRD).
 */
defineProps<{ clay: string }>()
</script>

<template>
  <div class="tv" :style="{ '--clay': clay }">
    <span class="tv-antenna tv-antenna--left" aria-hidden="true" />
    <span class="tv-antenna tv-antenna--right" aria-hidden="true" />
    <div class="tv-body">
      <div>
        <div class="tv-screen" data-testid="tv-screen">
          <slot name="screen" />
        </div>
        <div class="tv-slot" aria-hidden="true" />
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
    inset 0 -10px 0 rgb(0 0 0 / 0.08),
    inset 0 8px 0 rgb(255 255 255 / 0.3),
    0 26px 44px -22px rgb(17 17 20 / 0.5);
  transition: background-color 250ms;
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

.tv-slot {
  width: 46%;
  height: 8px;
  margin: 12px auto 0;
  border-radius: 8px;
  background: rgb(0 0 0 / 0.32);
  box-shadow: inset 0 2px 3px rgb(0 0 0 / 0.4);
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
}
</style>
