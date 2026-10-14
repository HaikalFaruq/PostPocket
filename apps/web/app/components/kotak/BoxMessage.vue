<script setup lang="ts">
/**
 * Hasil aksi di halaman kelola kotak bareng. Ditaruh di bagian yang tombolnya ditekan, supaya
 * terlihat tanpa menggulir ke atas.
 */
defineProps<{ notice: string; error: string }>()
</script>

<template>
  <p v-if="notice" role="status" class="mt-3 rounded-control bg-fill px-3 py-2 text-caption">
    {{ notice }}
  </p>
  <p
    v-if="error"
    role="alert"
    class="mt-3 rounded-control bg-[#fbefd2] px-3 py-2 text-caption text-[#7a5a14]"
  >
    {{ error }}
  </p>
</template>
