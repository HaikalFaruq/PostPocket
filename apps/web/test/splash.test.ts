import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { BRAND_SIGNATURE } from '../app/utils/brand-signature'
import { SPLASH_KEY, splashRoute, splashScript } from '../app/utils/splash'

/** Jalankan skrip <head> di browser tiruan dan kembalikan keputusannya. */
function decide({
  path = '/',
  seen = false,
  webdriver = false,
  reduced = false,
  storage = true,
} = {}) {
  const stored = new Map<string, string>(seen ? [[SPLASH_KEY, '1']] : [])
  const dataset: Record<string, string> = {}
  const sessionStorage = storage
    ? {
        getItem: (k: string) => stored.get(k) ?? null,
        setItem: (k: string, v: string) => stored.set(k, v),
      }
    : {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {},
      }
  runInNewContext(splashScript, {
    document: { documentElement: { dataset } },
    location: { pathname: path },
    navigator: { webdriver },
    matchMedia: () => ({ matches: reduced }),
    sessionStorage,
  })
  return { skip: dataset.splash === 'skip', marked: stored.get(SPLASH_KEY) === '1' }
}

describe('splash', () => {
  it('hanya di halaman aplikasi, tidak di surat, kotak, titip, info, dan lab', () => {
    for (const path of ['/', '/pocket', '/pocket/2026-10-15', '/tv', '/kotak', '/letter/new']) {
      expect(splashRoute(path), path).toBe(true)
    }
    for (const path of [
      '/l/x7Kp2qLm9A',
      '/k/x7Kp2qLm9A',
      '/titip/Ab3dE6gH9jKm',
      '/privasi',
      '/lisensi',
      '/lab/foil',
    ]) {
      expect(splashRoute(path), path).toBe(false)
    }
  })

  it('diputar sekali per sesi: kunjungan pertama ditandai, berikutnya dilewati', () => {
    expect(decide()).toEqual({ skip: false, marked: true })
    expect(decide({ seen: true })).toEqual({ skip: true, marked: true })
  })

  it('dilewati untuk tes otomatis, gerakan dikurangi, halaman surat, dan sessionStorage yang ditolak', () => {
    expect(decide({ webdriver: true }).skip).toBe(true)
    expect(decide({ reduced: true }).skip).toBe(true)
    expect(decide({ path: '/l/x7Kp2qLm9A' })).toEqual({ skip: true, marked: false })
    expect(decide({ storage: false }).skip).toBe(true)
  })

  it('tanda tangan berisi sepuluh huruf "PostPocket" yang masing-masing path tertutup', () => {
    expect(BRAND_SIGNATURE.glyphs).toHaveLength('PostPocket'.length)
    for (const d of BRAND_SIGNATURE.glyphs) {
      expect(d).toMatch(/^M/)
      expect(d).toMatch(/Z$/)
      expect(d).not.toMatch(/NaN|undefined/)
    }
    expect(BRAND_SIGNATURE.width).toBeGreaterThan(300)
  })
})
