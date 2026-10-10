import { describe, expect, it, vi } from 'vitest'
import {
  PAGES_CACHE,
  installHint,
  isInAppBrowser,
  isIos,
  isPrivatePath,
  requestPersistentStorage,
  warmPages,
  type InstallEnv,
} from '../app/utils/pwa'

const ua = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.27.79',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
}

const env = (extra: Partial<InstallEnv> = {}): InstallEnv => ({
  userAgent: ua.android,
  maxTouchPoints: 5,
  standalone: false,
  canPrompt: false,
  dismissed: false,
  ...extra,
})

describe('isIos', () => {
  it('mengenali iPhone dan iPad yang mengaku Mac', () => {
    expect(isIos(ua.iphone)).toBe(true)
    expect(isIos(ua.ipad, 5)).toBe(true)
    expect(isIos(ua.ipad, 0)).toBe(false)
    expect(isIos(ua.android, 5)).toBe(false)
  })
})

describe('isInAppBrowser', () => {
  it('mengenali browser bawaan aplikasi lain', () => {
    expect(isInAppBrowser(ua.instagram)).toBe(true)
    expect(isInAppBrowser(ua.iphone)).toBe(false)
  })
})

describe('isPrivatePath', () => {
  it('hanya surat penerima yang pribadi', () => {
    expect(isPrivatePath('/l/x7Kp2qLm9A')).toBe(true)
    expect(isPrivatePath('/l')).toBe(true)
    expect(isPrivatePath('/lab/foil')).toBe(false)
    expect(isPrivatePath('/letter/new')).toBe(false)
  })
})

describe('installHint', () => {
  it('pakai dialog pasang kalau browser menyediakannya', () => {
    expect(installHint(env({ canPrompt: true }))).toBe('prompt')
    expect(installHint(env({ userAgent: ua.iphone, canPrompt: true }))).toBe('prompt')
  })

  it('di iPhone tanpa dialog, tampilkan petunjuk Tambah ke Layar Utama', () => {
    expect(installHint(env({ userAgent: ua.iphone }))).toBe('ios')
    expect(installHint(env({ userAgent: ua.ipad }))).toBe('ios')
  })

  it('tidak tampil kalau sudah terpasang, sudah ditutup, atau tidak bisa dipasang', () => {
    expect(installHint(env({ canPrompt: true, standalone: true }))).toBeNull()
    expect(installHint(env({ userAgent: ua.iphone, dismissed: true }))).toBeNull()
    expect(installHint(env({ userAgent: ua.instagram }))).toBeNull()
    expect(installHint(env())).toBeNull()
  })
})

describe('requestPersistentStorage', () => {
  it('tidak meminta lagi kalau sudah permanen', async () => {
    const storage = { persisted: vi.fn(async () => true), persist: vi.fn(async () => true) }
    expect(await requestPersistentStorage(storage)).toBe(true)
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('meminta dan mengembalikan jawaban browser', async () => {
    const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => false) }
    expect(await requestPersistentStorage(storage)).toBe(false)
    expect(storage.persist).toHaveBeenCalledOnce()
  })

  it('aman di browser tanpa StorageManager atau yang menolak', async () => {
    expect(await requestPersistentStorage(undefined)).toBe(false)
    const failing = {
      persisted: async () => false,
      persist: async () => Promise.reject(new Error('ditolak')),
    }
    expect(await requestPersistentStorage(failing)).toBe(false)
  })
})

describe('warmPages', () => {
  function fakeCaches(cached: string[] = []) {
    const added: string[] = []
    const cache = {
      match: vi.fn(async (path: string) => cached.includes(path)),
      add: vi.fn(async (path: string) => {
        added.push(path)
      }),
    }
    const storage = { open: vi.fn(async () => cache) } as unknown as CacheStorage
    return { storage, cache, added }
  }

  it('menyimpan halaman yang belum ada, sekali saja', async () => {
    const { storage, added } = fakeCaches(['/'])
    await warmPages(['/', '/letter/new', '/letter/new'], storage)
    expect(storage.open).toHaveBeenCalledWith(PAGES_CACHE)
    expect(added).toEqual(['/letter/new'])
  })

  it('melewati surat penerima dan path yang bukan halaman situs ini', async () => {
    const { storage, added } = fakeCaches()
    await warmPages(['/l/x7Kp2qLm9A', 'https://contoh.com/', '/'], storage)
    expect(added).toEqual(['/'])
  })

  it('kegagalan diabaikan', async () => {
    const storage = { open: async () => Promise.reject(new Error('ditolak')) }
    await expect(warmPages(['/'], storage as unknown as CacheStorage)).resolves.toBeUndefined()
    await expect(warmPages(['/'], undefined)).resolves.toBeUndefined()
  })
})
