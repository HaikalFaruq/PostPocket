import type { SupabaseClient } from '@supabase/supabase-js'
import { get, set } from 'idb-keyval'
import { defineStore } from 'pinia'
import { deleteAccount } from '~/utils/account-api'
import { LetterApiError } from '~/utils/letter-api'
import { withNewIds } from '~/utils/memories'
import { asksBeforeMerging } from '~/utils/sync'
import { runSync, type SyncProgress } from '~/utils/sync-run'
import { backedUpCount, supabaseBackend } from '~/utils/sync-supabase'

const STATE_KEY = 'postpocket:sync'

/** Catatan sinkron per perangkat: akun terakhir dan posisi tarikan terakhirnya. */
interface SyncState {
  userId: string
  email: string
  lastPulledAt: string | null
  lastSyncedAt: string | null
  /** Sinkron pertama akun ini di perangkat ini sudah selesai (lihat `mergeRemote`). */
  synced: boolean
}

/** Aksi store kenangan yang mengubah data dan perlu disinkronkan. */
const CHANGES = new Set([
  'addMoments',
  'saveDay',
  'createAlbum',
  'updateAlbum',
  'addToAlbum',
  'deleteAlbum',
  'deleteMoment',
  'deleteMoments',
  'deleteDay',
])

/**
 * Login Google dan sinkron Pocket (fase 2, docs/frontend.md bagian Sinkron Pocket). Klien Supabase
 * baru dimuat saat `start()` dipanggil halaman Pocket atau TV, jadi halaman surat tidak ikut
 * memuatnya. Tanpa login, kenangan tetap hanya di perangkat ini.
 */
export const useSync = defineStore('sync', () => {
  const config = useRuntimeConfig().public
  const memories = useMemories()
  const configured = !!(config.supabaseUrl && config.supabasePublishableKey)

  const started = ref(false)
  /** Provider Google sudah dinyalakan di Supabase Auth. */
  const googleEnabled = ref(false)
  const user = shallowRef<{ id: string; email: string } | null>(null)
  const syncing = ref(false)
  const progress = ref<SyncProgress>({})
  const error = ref('')
  const quotaFull = ref(false)
  const lastSyncedAt = ref<string | null>(null)
  const backedUp = ref<number | null>(null)
  /** Email akun lain yang sebelumnya tersinkron di perangkat ini, menunggu konfirmasi user. */
  const otherAccount = ref<string | null>(null)
  /** Kabar setelah akun dihapus, tampil di kartu Cadangan sampai user masuk lagi. */
  const notice = ref('')
  const accountApi = useAccountApiOptions()

  /** Cadangan bisa dipakai: Google sudah dinyalakan, atau user sudah login. */
  const available = computed(() => configured && (googleEnabled.value || !!user.value))

  let client: SupabaseClient | null = null
  let starting: Promise<void> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let again = false
  let confirmedSwitch = false
  /** Akun sedang dihapus: jangan mulai sinkron yang akan ditolak server. */
  let removing = false

  async function readState(): Promise<SyncState | null> {
    try {
      return ((await get(STATE_KEY)) as SyncState | undefined) ?? null
    } catch {
      return null
    }
  }

  function setUser(next: { id: string; email?: string } | null | undefined) {
    const changed = (next?.id ?? null) !== (user.value?.id ?? null)
    user.value = next ? { id: next.id, email: next.email ?? '' } : null
    if (changed) {
      quotaFull.value = false
      backedUp.value = null
      error.value = ''
      if (user.value) schedule(0)
    }
  }

  async function googleProvider(): Promise<boolean> {
    try {
      const response = await fetch(`${config.supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: config.supabasePublishableKey },
      })
      const settings = (await response.json()) as { external?: { google?: boolean } }
      return settings.external?.google === true
    } catch {
      return false
    }
  }

  /** Siapkan klien Supabase dan sesi. Aman dipanggil berkali-kali. */
  function start(): Promise<void> {
    if (!configured || !import.meta.client) return Promise.resolve()
    starting ??= (async () => {
      const [{ createClient }, google, state] = await Promise.all([
        import('@supabase/supabase-js'),
        googleProvider(),
        readState(),
      ])
      googleEnabled.value = google
      lastSyncedAt.value = state?.lastSyncedAt ?? null
      client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
        // PKCE: setelah login Google, Supabase kembali ke /pocket?code=… dan klien menukarnya
        // sendiri saat dibuat (detectSessionInUrl).
        auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
      })
      const { data } = await client.auth.getSession()
      setUser(data.session?.user)
      client.auth.onAuthStateChange((_event, session) => setUser(session?.user))
      memories.$onAction(({ name, after }) => {
        if (CHANGES.has(name)) after(() => schedule())
      })
      window.addEventListener('online', () => schedule(0))
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') schedule(0)
      })
      started.value = true
    })()
    return starting
  }

  /** Login Google. Supabase membawa user kembali ke Pocket setelah login. */
  async function signIn() {
    await start()
    if (!client) return
    error.value = ''
    notice.value = ''
    const { error: problem } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/pocket?masuk=1` },
    })
    if (problem) error.value = 'Tidak bisa membuka halaman login Google. Coba lagi.'
  }

  /** Keluar di perangkat ini saja. Kenangan di perangkat ini dan cadangannya tetap ada. */
  async function signOut() {
    if (!client) return
    await client.auth.signOut({ scope: 'local' })
    setUser(null)
    otherAccount.value = null
    confirmedSwitch = false
  }

  /**
   * Hapus akun beserta semua cadangannya di server (`DELETE /account`, kontrak 0.4.0), lalu keluar
   * di perangkat ini. Kenangan di perangkat ini tetap ada.
   *
   * Catatan sinkron (`postpocket:sync`) sengaja tidak dihapus. Akun Google yang sama yang masuk
   * lagi tidak ditanya soal akun lama (`asksBeforeMerging`), tapi akun lain tetap ditanya dulu
   * sebelum kenangan di perangkat ini digabung ke cadangannya.
   *
   * 401 juga dianggap selesai: sesinya sudah tidak berlaku, misalnya karena jawaban 204 dari
   * percobaan sebelumnya hilang di jalan. Error lain dilempar, dan user tetap masuk.
   */
  async function removeAccount() {
    if (!client || !user.value || syncing.value) return
    removing = true
    clearTimeout(timer)
    try {
      let message =
        'Akunmu sudah dihapus beserta semua cadangannya. Kenangan di perangkat ini tetap ada.'
      try {
        const { data } = await client.auth.getSession()
        const token = data.session?.access_token
        if (!token) throw new LetterApiError('unauthorized', 'tidak ada sesi', 401)
        await deleteAccount(accountApi, token)
      } catch (problem) {
        if (!(problem instanceof LetterApiError && problem.status === 401)) throw problem
        message =
          'Sesi login sudah berakhir, jadi kamu dikeluarkan. Kalau akunnya masih ada, masuk lagi lalu hapus dari sini.'
      }
      await client.auth.signOut({ scope: 'local' })
      setUser(null)
      otherAccount.value = null
      confirmedSwitch = false
      lastSyncedAt.value = null
      notice.value = message
    } finally {
      removing = false
    }
  }

  /** Sinkron sebentar lagi, supaya beberapa perubahan beruntun cukup dikirim sekali. */
  function schedule(delay = 2000) {
    if (!user.value) return
    clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), delay)
  }

  /** User setuju kenangan di perangkat ini ikut dicadangkan ke akun yang baru login. */
  function confirmSwitch() {
    confirmedSwitch = true
    otherAccount.value = null
    schedule(0)
  }

  async function syncNow() {
    if (!client || !user.value || removing) return
    if (running) {
      again = true
      return
    }
    running = true
    syncing.value = true
    error.value = ''
    const current = user.value
    try {
      await memories.load()
      const state = await readState()
      const mine = state?.userId === current.id
      const data = memories.data
      const hasLocal =
        Object.keys(data.moments).length + Object.keys(data.days).length + data.albums.length > 0
      if (asksBeforeMerging(state, current, hasLocal)) {
        // Perangkat ini sebelumnya tersinkron ke akun lain: jangan campur tanpa persetujuan.
        if (!confirmedSwitch) {
          otherAccount.value = state?.email || 'akun lain'
          return
        }
        // Id di cadangan unik untuk semua akun, jadi kenangan akun lama dikirim sebagai salinan
        // dengan id baru. Akunnya langsung dicatat, supaya sinkron yang terputus tidak mengganti
        // id lagi dan membuat salinan ganda.
        await memories.applyRemote((local) => withNewIds(local))
        await set(STATE_KEY, {
          userId: current.id,
          email: current.email,
          lastPulledAt: null,
          lastSyncedAt: null,
          synced: false,
        } satisfies SyncState)
      }
      const first = !mine || !state?.synced
      const outcome = await runSync(
        {
          data: () => memories.data,
          apply: (update) => memories.applyRemote(update),
          photosHere: () => memories.photosHere(),
          savePhoto: (id, blob, width, height) => memories.savePhoto(id, blob, width, height),
          uploadVersion: (id) => memories.uploadVersion(id),
        },
        supabaseBackend(client, current.id),
        {
          lastPulledAt: mine ? (state?.lastPulledAt ?? null) : null,
          first,
          onProgress: (value) => (progress.value = value),
        },
      )
      const now = new Date().toISOString()
      await set(STATE_KEY, {
        userId: current.id,
        email: current.email,
        lastPulledAt: outcome.lastPulledAt,
        lastSyncedAt: now,
        synced: true,
      } satisfies SyncState)
      lastSyncedAt.value = now
      quotaFull.value = outcome.quotaFull
      backedUp.value = await backedUpCount(client)
    } catch (problem) {
      error.value =
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'Sedang offline. Sinkron dilanjutkan begitu ada sinyal.'
          : 'Sinkron gagal. Coba lagi sebentar lagi.'
      console.error('sinkron Pocket gagal', problem)
    } finally {
      running = false
      syncing.value = false
      progress.value = {}
      if (again) {
        again = false
        schedule(0)
      }
    }
  }

  return {
    configured,
    started,
    available,
    googleEnabled,
    user,
    syncing,
    progress,
    error,
    quotaFull,
    lastSyncedAt,
    backedUp,
    otherAccount,
    notice,
    start,
    signIn,
    signOut,
    removeAccount,
    syncNow,
    confirmSwitch,
  }
})
