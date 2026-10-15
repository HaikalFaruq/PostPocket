<script setup lang="ts">
/** Kerangka halaman teks (privasi, lisensi): kepala bermerek, judul, lalu isi. */
defineProps<{ title: string; lead?: string }>()
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 sm:px-6">
    <header class="flex items-center gap-2 py-4">
      <NuxtLink to="/" class="inline-flex items-center">
        <BrandLogo class="h-6" />
      </NuxtLink>
    </header>
    <main class="info-page flex-1 pt-4 pb-16">
      <h1 class="text-title">{{ title }}</h1>
      <p v-if="lead" class="mt-2 text-body text-ink-muted">{{ lead }}</p>
      <slot />
    </main>
  </div>
</template>

<style scoped>
.info-page :deep(h2) {
  margin-top: 2rem;
  font-size: 15px;
  font-weight: 600;
}

.info-page :deep(p),
.info-page :deep(li) {
  margin-top: 0.5rem;
  font-size: var(--text-body);
  line-height: 1.6;
}

.info-page :deep(ul) {
  margin-top: 0.25rem;
  padding-left: 1.1rem;
  list-style: disc;
}

.info-page :deep(a) {
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
