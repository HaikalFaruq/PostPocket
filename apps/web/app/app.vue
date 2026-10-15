<script setup lang="ts">
import { splashRoute } from '~/utils/splash'

// Splash hanya dipasang di halaman yang boleh (app/utils/splash.ts), dan dimuat terpisah: halaman
// surat, kotak, dan titip yang dibuka dari link tidak ikut membawa garis tanda tangannya.
const splash = splashRoute(useRoute().path)
</script>

<template>
  <NuxtPwaManifest />
  <NuxtRouteAnnouncer />
  <NuxtPage />
  <PwaUpdateToast />
  <DraftChoiceDialog />
  <LazyAppSplash v-if="splash" />
</template>
