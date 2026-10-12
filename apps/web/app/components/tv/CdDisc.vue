<script setup lang="ts">
/**
 * Piringan CD bergambar: tepi perak berkilau, foto sampul tercetak di permukaannya, dan lubang
 * tengah transparan. Ukurannya mengikuti wadah. Dipakai di rak, saat diseret, dan saat terbang
 * ke slot TV, jadi bentuknya sama di ketiga tempat itu.
 */
defineProps<{ cover: string | null; emoji: string; spinning?: boolean }>()
</script>

<template>
  <span class="cd-disc" :class="{ 'is-spinning': spinning }" aria-hidden="true">
    <span class="cd-disc__face">
      <span class="cd-disc__print">
        <img v-if="cover" :src="cover" alt="" draggable="false" />
        <span v-else class="cd-disc__emoji">{{ emoji }}</span>
      </span>
    </span>
    <span class="cd-disc__hub" />
  </span>
</template>

<style scoped>
.cd-disc {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.8) inset,
    0 0 0 1px rgb(24 32 74 / 0.1),
    0 14px 26px -14px rgb(24 32 74 / 0.6);
  user-select: none;
}

/* Yang berputar hanya permukaannya; bayangan dan kilau lampu tetap di tempat. */
.cd-disc__face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 50%;
  background: conic-gradient(
    from 20deg,
    #dfe4ec,
    #f7f3ec 12%,
    #c9d4e6 25%,
    #efe6f3 38%,
    #d3e8e2 52%,
    #f6efe1 66%,
    #cfd7ea 80%,
    #dfe4ec
  );
}

/* Gambar tercetak menutup hampir seluruh piringan; tepinya menyisakan cincin perak. */
.cd-disc__print {
  position: absolute;
  inset: 6%;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--color-panel);
  mask: radial-gradient(circle, transparent 0 17%, #000 17.5%);
}

.cd-disc__print img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cd-disc__emoji {
  font-size: 2.2em;
}

/* Cincin plastik bening di sekitar lubang, dan kilau lampu yang diam. */
.cd-disc__hub {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(
      circle,
      transparent 0 7%,
      rgb(255 255 255 / 0.85) 7.5% 10%,
      rgb(220 226 236 / 0.55) 10.5% 16.5%,
      rgb(24 32 74 / 0.18) 17% 17.6%,
      transparent 18%
    ),
    linear-gradient(
      125deg,
      rgb(255 255 255 / 0.4),
      transparent 38%,
      transparent 62%,
      rgb(255 255 255 / 0.18)
    );
  pointer-events: none;
}

.cd-disc.is-spinning .cd-disc__face {
  animation: cd-spin 2.6s linear infinite;
}

@keyframes cd-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cd-disc.is-spinning .cd-disc__face {
    animation: none;
  }
}
</style>
