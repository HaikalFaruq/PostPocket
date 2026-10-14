<script setup lang="ts">
import { calmMotion } from '~/utils/render'

/**
 * Tombol bertag, diadaptasi dari "Offer Button" karya positronx di 21st.dev (MIT, lihat
 * docs/assets.md). Saat disorot atau difokus, dua tag keluar dari balik tombol dan empat siku di
 * sudutnya melebar. Saat diketuk, gerakan itu diputar sebentar sebelum pindah halaman, jadi HP
 * yang tidak bisa menyorot juga melihatnya. Dengan gerakan dikurangi, langsung pindah.
 */
const props = defineProps<{ to: string; label: string; tags: readonly [string, string] }>()

/** Lama gerakan ketukan sebelum pindah halaman. */
const PRESS_MS = 320
const pressed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function go(event: MouseEvent) {
  // Buka di tab baru, unduh, dan sejenisnya tetap jalan seperti link biasa.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (pressed.value) return
  if (calmMotion()) {
    void navigateTo(props.to)
    return
  }
  pressed.value = true
  timer = setTimeout(() => void navigateTo(props.to), PRESS_MS)
}

const preload = () => void preloadRouteComponents(props.to)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <span class="tag-button" :data-pressed="pressed || undefined">
    <a :href="to" class="press" @click="go" @pointerenter="preload" @focus="preload">{{ label }}</a>
    <!-- Sesudah tautannya, supaya bisa mengikuti :focus-visible lewat ~ tanpa :has(). -->
    <span class="tag tag--top" aria-hidden="true">{{ tags[0] }}</span>
    <span class="tag tag--bottom" aria-hidden="true">{{ tags[1] }}</span>
    <svg v-for="corner in 4" :key="corner" class="corner" viewBox="-1 1 32 32" aria-hidden="true">
      <path d="M32,32C14.355,32,0,17.645,0,0h.985c0,17.102,13.913,31.015,31.015,31.015v.985Z" />
    </svg>
  </span>
</template>

<style scoped>
.tag-button {
  --corner: color-mix(in srgb, var(--color-ink) 20%, transparent);
  --corner-out: color-mix(in srgb, var(--color-ink) 32%, transparent);
  --corner-dist: 14px;
  --corner-far: 1;
  --spring: cubic-bezier(0, 0, 0, 2.5);
  --dur: 250ms;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* Ruang untuk siku dan tag, supaya tidak menabrak teks di atas dan di bawahnya. */
  margin: 24px 22px;
}

.press {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 150px;
  height: 46px;
  padding: 0 22px;
  border-radius: var(--radius-control);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--color-white);
  background:
    linear-gradient(
      color-mix(in srgb, var(--color-white) 12%, transparent),
      color-mix(in srgb, var(--color-ink) 30%, transparent)
    ),
    var(--color-ink);
  box-shadow:
    inset 0 1px 1px color-mix(in srgb, var(--color-white) 22%, transparent),
    0 2px 1px color-mix(in srgb, var(--color-ink) 8%, transparent),
    0 4px 2px color-mix(in srgb, var(--color-ink) 8%, transparent),
    0 8px 4px color-mix(in srgb, var(--color-ink) 7%, transparent),
    0 16px 8px color-mix(in srgb, var(--color-ink) 5%, transparent);
  transition:
    transform var(--dur) var(--spring),
    filter var(--dur) var(--spring);
  -webkit-tap-highlight-color: transparent;
}

.press:focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 4px;
}

/* Dua tag di balik tombol: tersembunyi, lalu keluar ke atas dan ke bawah. */
.tag {
  position: absolute;
  display: flex;
  min-height: 26px;
  padding: 3px 10px;
  border-radius: calc(var(--radius-control) - 3px);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-ink);
  background: var(--color-white);
  box-shadow: inset 0 0 0 1px var(--color-line);
  opacity: 0;
  filter: blur(2px);
  transition:
    transform calc(var(--dur) * 0.5) ease,
    filter var(--dur) var(--spring),
    opacity calc(var(--dur) * 0.5) ease;
}

.tag--top {
  top: 0;
  left: 0;
  align-items: start;
}

.tag--bottom {
  right: 0;
  bottom: 0;
  align-items: end;
}

/* Empat siku di luar sudut tombol. */
.corner {
  position: absolute;
  width: 22px;
  fill: none;
  stroke: var(--corner);
  transition:
    transform var(--dur) var(--spring),
    filter var(--dur) var(--spring);
}

.corner:nth-of-type(1) {
  top: 0;
  left: 0;
  transform: translate(
      calc(-1 * var(--corner-far) * var(--corner-dist)),
      calc(-1 * var(--corner-far) * var(--corner-dist))
    )
    rotate(90deg);
}

.corner:nth-of-type(2) {
  top: 0;
  right: 0;
  transform: translate(
      calc(var(--corner-far) * var(--corner-dist)),
      calc(-1 * var(--corner-far) * var(--corner-dist))
    )
    rotate(180deg);
}

.corner:nth-of-type(3) {
  right: 0;
  bottom: 0;
  transform: translate(
      calc(var(--corner-far) * var(--corner-dist)),
      calc(var(--corner-far) * var(--corner-dist))
    )
    rotate(-90deg);
}

.corner:nth-of-type(4) {
  bottom: 0;
  left: 0;
  transform: translate(
      calc(-1 * var(--corner-far) * var(--corner-dist)),
      calc(var(--corner-far) * var(--corner-dist))
    )
    rotate(0deg);
}

/*
 * Keluar: saat baru diketuk, saat difokus keyboard, atau saat disorot (hanya di perangkat yang
 * benar-benar bisa menyorot, supaya tidak menempel setelah diketuk di HP). Fokus dari klik mouse
 * tidak dihitung, jadi tombol yang dibuka di tab baru tidak tertinggal dalam keadaan keluar.
 * Aturannya dipisah, supaya browser yang belum kenal satu selektor tetap mendapat yang lain.
 */
.tag-button[data-pressed] .press {
  transform: scale(1.05);
  filter: drop-shadow(0 14px 14px color-mix(in srgb, var(--color-ink) 16%, transparent));
}

.tag-button[data-pressed] .tag {
  opacity: 1;
  filter: none;
}

.tag-button[data-pressed] .tag--top {
  transform: translateY(-22px) rotate(-3deg);
}

.tag-button[data-pressed] .tag--bottom {
  transform: translateY(22px) rotate(3deg);
}

.tag-button[data-pressed] .corner {
  --corner: var(--corner-out);
  --corner-far: 1.45;
  filter: drop-shadow(-6px 6px 0 var(--corner)) drop-shadow(-12px 12px 1px var(--corner));
}

.press:focus-visible {
  transform: scale(1.05);
  filter: drop-shadow(0 14px 14px color-mix(in srgb, var(--color-ink) 16%, transparent));
}

.press:focus-visible ~ .tag {
  opacity: 1;
  filter: none;
}

.press:focus-visible ~ .tag--top {
  transform: translateY(-22px) rotate(-3deg);
}

.press:focus-visible ~ .tag--bottom {
  transform: translateY(22px) rotate(3deg);
}

.press:focus-visible ~ .corner {
  --corner: var(--corner-out);
  --corner-far: 1.45;
  filter: drop-shadow(-6px 6px 0 var(--corner)) drop-shadow(-12px 12px 1px var(--corner));
}

@media (hover: hover) {
  .tag-button:hover .press {
    transform: scale(1.05);
    filter: drop-shadow(0 14px 14px color-mix(in srgb, var(--color-ink) 16%, transparent));
  }

  .tag-button:hover .tag {
    opacity: 1;
    filter: none;
  }

  .tag-button:hover .tag--top {
    transform: translateY(-22px) rotate(-3deg);
  }

  .tag-button:hover .tag--bottom {
    transform: translateY(22px) rotate(3deg);
  }

  .tag-button:hover .corner {
    --corner: var(--corner-out);
    --corner-far: 1.45;
    filter: drop-shadow(-6px 6px 0 var(--corner)) drop-shadow(-12px 12px 1px var(--corner));
  }
}

/* Ditekan: tombol mengecil, tag masuk lagi, siku merapat. */
.tag-button:active .press {
  transform: scale(0.96);
  filter: drop-shadow(0 8px 4px color-mix(in srgb, var(--color-ink) 16%, transparent));
}

.tag-button:active .tag {
  transform: translateY(0) scale(0.6);
}

.tag-button:active .corner {
  --corner: color-mix(in srgb, var(--color-ink) 40%, transparent);
  --corner-far: 0.9;
}

@media (prefers-reduced-motion: reduce) {
  .press,
  .tag,
  .corner {
    transition: none;
  }
}
</style>
