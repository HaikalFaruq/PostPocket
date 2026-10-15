<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'

/**
 * Cadangan Pocket di bawah kalender. Tanpa Supabase atau sebelum login Google dinyalakan, isinya
 * tetap pengingat bahwa kenangan hanya ada di perangkat ini. Setelah login: akun, status sinkron,
 * jumlah foto tercadang (kuota beta 100 foto), dan Hapus akun.
 */
const sync = useSync()
const route = useRoute()
const router = useRouter()
const card = ref<HTMLElement | null>(null)
// Cukup diperbarui tiap 30 detik untuk tulisan "2 menit lalu".
const now = useNow({ scheduler: (update) => useIntervalFn(update, 30_000) })

const loginFailed = ref('')
const deleting = ref(false)
const signedOutTitle = ref<HTMLElement | null>(null)

onMounted(async () => {
  // Kembali dari login Google: Supabase menambahkan ?code=… (atau ?error=… kalau gagal).
  const query = route.query
  const back = 'masuk' in query || 'code' in query || 'error' in query
  if (typeof query.error_description === 'string') {
    loginFailed.value =
      query.error === 'access_denied'
        ? 'Login dibatalkan. Selama beta, hanya akun Google tester yang bisa masuk.'
        : 'Login Google gagal. Coba lagi.'
  }
  await sync.start()
  if (back) {
    await router.replace({ query: {} })
    card.value?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
})

function ago(iso: string): string {
  const minutes = Math.floor((now.value.getTime() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

const status = computed(() => {
  const downloading = sync.progress.downloading
  if (sync.syncing) {
    return downloading?.total
      ? `Mengunduh ${downloading.done} dari ${downloading.total} foto…`
      : 'Menyinkronkan…'
  }
  if (sync.error) return sync.error
  if (sync.quotaFull) {
    return 'Cadangan penuh: 100 foto. Foto baru tetap tersimpan di perangkat ini.'
  }
  if (!sync.lastSyncedAt) return 'Belum disinkronkan.'
  const count = sync.backedUp === null ? '' : ` ${sync.backedUp} dari 100 foto tercadang.`
  return `Tersinkron ${ago(sync.lastSyncedAt)}.${count}`
})

const tone = computed(() => {
  if (sync.syncing) return 'bg-[#f0c36a]'
  if (sync.error || sync.quotaFull) return 'bg-[#e2735f]'
  return 'bg-pocket-ok'
})
</script>

<template>
  <section
    v-if="sync.available"
    ref="card"
    class="mx-auto mt-6 max-w-md rounded-[20px] bg-surface/70 px-5 py-4 text-pocket-ink"
    data-testid="backup-card"
    aria-labelledby="backup-title"
  >
    <template v-if="!sync.user">
      <h2
        id="backup-title"
        ref="signedOutTitle"
        tabindex="-1"
        class="text-body font-semibold focus:outline-none"
      >
        Cadangkan kenanganmu
      </h2>
      <p
        v-if="sync.notice"
        class="mt-2 rounded-control bg-pocket-today px-3 py-2 text-caption"
        role="status"
        data-testid="backup-notice"
      >
        {{ sync.notice }}
      </p>
      <p class="mt-1 text-caption text-pocket-muted">
        Sekarang foto dan kantongmu hanya ada di perangkat ini. Masuk dengan Google supaya tercadang
        dan bisa dibuka di HP lain. Surat tetap bisa dibuat tanpa akun.
      </p>
      <button
        type="button"
        class="mt-3 inline-flex h-10 items-center gap-2.5 rounded-full bg-white px-4 text-body font-semibold text-[#1f1f1f] shadow-[inset_0_0_0_1px_#747775] hover:bg-[#f8f9fa]"
        @click="sync.signIn()"
      >
        <GoogleMark class="size-[18px]" />
        Masuk dengan Google
      </button>
      <p v-if="loginFailed || sync.error" class="mt-2 text-caption text-[#a8402f]" role="alert">
        {{ loginFailed || sync.error }}
      </p>
      <p class="mt-2 text-[12px] text-pocket-muted">
        Selama beta, cadangan maksimal 100 foto dan hanya untuk akun tester yang didaftarkan.
        <NuxtLink to="/privasi" class="underline underline-offset-2">Privasi</NuxtLink>
      </p>
    </template>

    <template v-else-if="sync.otherAccount">
      <h2 id="backup-title" class="text-body font-semibold">Gabungkan ke akun ini?</h2>
      <p class="mt-1 text-caption text-pocket-muted">
        Kenangan di perangkat ini sebelumnya tercadang ke {{ sync.otherAccount }}. Kalau lanjut,
        semuanya ikut dicadangkan ke {{ sync.user.email }}.
      </p>
      <div class="mt-3 flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-10 items-center rounded-full bg-ink px-5 text-body font-semibold whitespace-nowrap text-white"
          @click="sync.confirmSwitch()"
        >
          Lanjut cadangkan
        </button>
        <button
          type="button"
          class="min-h-10 px-2 text-body whitespace-nowrap text-ink-muted hover:text-ink"
          @click="sync.signOut()"
        >
          Keluar
        </button>
      </div>
    </template>

    <template v-else>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 id="backup-title" class="text-body font-semibold">Tercadang ke akun Google</h2>
          <p class="truncate text-caption text-pocket-muted">{{ sync.user.email }}</p>
        </div>
        <span class="mt-1.5 size-2.5 shrink-0 rounded-full" :class="tone" aria-hidden="true" />
      </div>
      <p class="mt-2 text-caption" data-testid="backup-status" role="status">{{ status }}</p>
      <div class="mt-3 flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-body font-semibold shadow-[inset_0_0_0_1px_var(--color-line)] disabled:opacity-50"
          :disabled="sync.syncing"
          @click="sync.syncNow()"
        >
          Sinkron sekarang
        </button>
        <button
          type="button"
          class="min-h-10 px-2 text-body whitespace-nowrap text-ink-muted hover:text-ink"
          @click="sync.signOut()"
        >
          Keluar
        </button>
      </div>
      <button
        type="button"
        class="mt-1 inline-flex min-h-10 items-center text-caption text-ink-muted underline underline-offset-2 hover:text-ink disabled:opacity-50"
        :disabled="sync.syncing"
        data-testid="delete-account-open"
        @click="deleting = true"
      >
        Hapus akun
      </button>
    </template>

    <!-- Di luar tampilan akun, supaya dialognya tetap bisa menutup dengan rapi setelah akunnya
         terhapus dan kartunya kembali ke tampilan belum masuk. -->
    <DeleteAccountDialog v-model:open="deleting" @removed="signedOutTitle?.focus()" />
  </section>

  <p
    v-else
    class="mx-auto mt-6 max-w-md rounded-[16px] bg-surface/70 px-4 py-3 text-center text-caption text-pocket-ink"
  >
    <!-- Kartu Cadangan bisa langsung hilang setelah akun dihapus, misalnya kalau pengaturan login
         Google belum terbaca karena Pocket dibuka saat offline. Kabarnya tetap tampil di sini. -->
    <span
      v-if="sync.notice"
      class="mb-1 block font-semibold"
      role="status"
      data-testid="backup-notice"
    >
      {{ sync.notice }}
    </span>
    Foto dan kantongmu hanya tersimpan di perangkat ini. Kalau data browser dihapus, isinya ikut
    hilang.
  </p>
</template>
