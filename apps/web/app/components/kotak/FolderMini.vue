<script setup lang="ts">
/** Folder kaca kecil untuk daftar modul di Beranda: panel belakang, surat, dan kaca depan. */
</script>

<template>
  <span class="folder-mini" aria-hidden="true">
    <span class="folder-mini__back" />
    <span class="folder-mini__sheet" />
    <span class="folder-mini__front" />
  </span>
</template>

<style scoped>
.folder-mini {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 340 / 272;
}

/* Panel belakang dengan tab di kanan atas, warnanya dari seni par avion. */
.folder-mini__back {
  position: absolute;
  inset: 0;
  border-radius: 7px;
  background: linear-gradient(
    125deg,
    #f4f6fb 8%,
    #e9b8b8 30%,
    #e23b3b 42%,
    #18204a 60%,
    #4d6bb3 78%,
    #eef2fa 96%
  );
  clip-path: polygon(0 12%, 44% 12%, 52% 0, 100% 0, 100% 100%, 0 100%);
}

.folder-mini__sheet {
  position: absolute;
  left: 12%;
  right: 14%;
  top: 14%;
  height: 52%;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 2px 5px rgb(24 32 74 / 0.25);
  rotate: -5deg;
}

.folder-mini__front {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 70%;
  border-radius: 7px;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.55), rgb(252 252 253 / 0.95));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.9),
    0 4px 10px -4px rgb(24 32 74 / 0.4);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}
</style>
