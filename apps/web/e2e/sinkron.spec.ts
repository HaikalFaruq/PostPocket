import { createClient, type Session } from '@supabase/supabase-js'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

// Sinkron Pocket ke stack Supabase lokal. Hanya jalan kalau SYNC_E2E=1 (lihat playwright.config.ts
// dan docs/frontend.md bagian Sinkron Pocket). User dibuat lewat admin API, lalu sesinya ditaruh
// di localStorage seperti setelah login Google, karena Google sendiri tidak bisa diuji otomatis.

const API = process.env.API_URL ?? ''
const KEY = process.env.PUBLISHABLE_KEY ?? ''
const admin = createClient(API, process.env.SECRET_KEY ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
})
// Kunci sesi supabase-js: sb-<bagian pertama host>-auth-token.
const SESSION_KEY = `sb-${new URL(API || 'http://localhost').hostname.split('.')[0]}-auth-token`

const pad = (value: number) => String(value).padStart(2, '0')
const now = new Date()
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const SYNC_TIMEOUT = 30_000

interface Account {
  id: string
  email: string
  session: Session
}

async function account(email = `uji-${crypto.randomUUID()}@example.com`): Promise<Account> {
  const password = crypto.randomUUID()
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (created.error) throw created.error
  const client = createClient(API, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signedIn = await client.auth.signInWithPassword({ email, password })
  if (signedIn.error || !signedIn.data.session) throw signedIn.error
  return { id: created.data.user.id, email, session: signedIn.data.session }
}

/** Sesi ditaruh sekali per tab, sebelum aplikasi dimuat, seperti setelah kembali dari Google. */
async function signedIn(context: BrowserContext, user: Account) {
  await context.addInitScript(
    ({ key, value }) => {
      if (sessionStorage.getItem('uji-sesi')) return
      localStorage.setItem(key, value)
      sessionStorage.setItem('uji-sesi', '1')
    },
    { key: SESSION_KEY, value: JSON.stringify(user.session) },
  )
}

async function device(browser: Browser, user: Account): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await signedIn(context, user)
  return context.newPage()
}

const status = (page: Page) => page.getByTestId('backup-status')

/** Provider Google dianggap sudah dinyalakan; stack lokal tanpa client ID belum menyalakannya. */
async function googleOn(page: Page) {
  await page.route('**/auth/v1/settings', async (route) => {
    const response = await route.fetch()
    const settings = await response.json()
    await route.fulfill({
      response,
      json: { ...settings, external: { ...settings.external, google: true } },
    })
  })
}

/** Sesi akun lain ditaruh di tab yang sama, seperti setelah masuk lagi lewat Google. */
async function signInAgain(page: Page, user: Account) {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: SESSION_KEY,
    value: JSON.stringify(user.session),
  })
  await page.reload()
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers':
    'apikey, authorization, content-type, x-client-info, x-edit-token',
}

/**
 * Panggilan `DELETE /account` diteruskan ke fungsi `account` di stack lokal (kontrak 0.4.0) dan
 * dicatat sebagai "<metode> <apikey cocok> <id user dari token>". Dengan `failFirst`, panggilan
 * pertama dijawab 503 oleh tes, seperti gangguan sesaat di gateway.
 */
async function watchAccount(page: Page, failFirst = false) {
  const calls: string[] = []
  await page.route(
    (url) => url.pathname.endsWith('/functions/v1/account'),
    async (route) => {
      const request = route.request()
      if (request.method() === 'OPTIONS') return route.continue()
      const token = request.headers().authorization?.replace(/^Bearer /, '') ?? ''
      const claims = token.split('.')[1]
      const sub = claims ? JSON.parse(Buffer.from(claims, 'base64url').toString()).sub : ''
      calls.push(`${request.method()} ${request.headers().apikey === KEY} ${sub}`)
      if (failFirst && calls.length === 1) {
        return route.fulfill({ status: 503, headers: CORS, body: 'Service Unavailable' })
      }
      return route.continue()
    },
  )
  return calls
}

async function synced(page: Page, photos: number) {
  await expect(status(page)).toContainText(`${photos} dari 100 foto`, { timeout: SYNC_TIMEOUT })
}

/** Simpan kantong hari ini dengan satu foto, lewat modal yang sama dengan pengguna. */
async function saveToday(page: Page, hue = 200) {
  await page.locator(`[data-day="${TODAY}"]`).click()
  const dialog = page.getByRole('dialog')
  const base64 = await page.evaluate((h) => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 450
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = `hsl(${h} 70% 60%)`
    ctx.fillRect(0, 0, 600, 450)
    return canvas.toDataURL('image/jpeg').split(',')[1]!
  }, hue)
  await page.getByTestId('moment-upload').setInputFiles({
    name: 'momen.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(base64, 'base64'),
  })
  await expect(dialog.getByRole('button', { name: /^Hapus foto/ })).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Simpan kantong' }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

async function serverMoments(user: Account) {
  const { data, error } = await admin.from('moments').select('*').eq('owner_id', user.id)
  if (error) throw error
  return data as { id: string; deleted_at: string | null }[]
}

async function serverFiles(user: Account): Promise<string[]> {
  const { data, error } = await admin.storage.from('moments').list(user.id)
  if (error) throw error
  return (data ?? []).map((item) => item.name)
}

test.beforeEach(() => {
  test.skip(!API || !process.env.SECRET_KEY, 'Butuh stack Supabase lokal (SYNC_E2E=1)')
})

test('kenangan dari HP A sampai di HP B lengkap dengan foto, lalu hapus dari B sampai di A', async ({
  browser,
}) => {
  test.setTimeout(120_000)
  const user = await account()
  const phoneA = await device(browser, user)
  await phoneA.goto('/pocket')
  await synced(phoneA, 0)
  await saveToday(phoneA)
  await synced(phoneA, 1)
  const [row] = await serverMoments(user)
  expect(row?.deleted_at).toBeNull()
  expect(await serverFiles(user)).toEqual([`${row!.id}.jpg`])

  const phoneB = await device(browser, user)
  await phoneB.goto('/pocket')
  await synced(phoneB, 1)
  await expect(phoneB.locator(`[data-day="${TODAY}"]`)).toHaveAttribute('data-saved', 'true')
  await phoneB.goto(`/pocket/${TODAY}`)
  await phoneB.getByRole('button', { name: 'Buka kantong' }).click()
  await expect(phoneB.getByTestId('line-photo')).toHaveCount(1)
  await expect(phoneB.getByTestId('line-photo').locator('img')).toHaveAttribute('src', /^blob:/)

  // Hapus kantong di B: barisnya ditandai hapus dan berkasnya hilang dari cadangan.
  await phoneB.getByRole('button', { name: 'Ganti desain kantong' }).click()
  const dialog = phoneB.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Hapus kantong' }).click()
  await dialog.getByRole('button', { name: 'Hapus', exact: true }).click()
  await expect(phoneB).toHaveURL(/\/pocket$/)
  await synced(phoneB, 0)
  expect((await serverMoments(user))[0]?.deleted_at).not.toBeNull()
  expect(await serverFiles(user)).toEqual([])

  await phoneA.reload()
  await synced(phoneA, 0)
  await expect(phoneA.locator(`[data-day="${TODAY}"]`)).not.toHaveAttribute('data-saved', 'true')
})

test('berkas yang hilang dari cadangan diunggah ulang dengan Sinkron sekarang', async ({
  browser,
}) => {
  const user = await account()
  const phone = await device(browser, user)
  await phone.goto('/pocket')
  await saveToday(phone)
  await synced(phone, 1)
  const [file] = await serverFiles(user)
  await admin.storage.from('moments').remove([`${user.id}/${file}`])
  expect(await serverFiles(user)).toEqual([])

  await phone.getByRole('button', { name: 'Sinkron sekarang' }).click()
  await expect.poll(() => serverFiles(user), { timeout: SYNC_TIMEOUT }).toEqual([file])
})

test('kuota penuh: foto baru tetap di perangkat, dan kartunya bilang cadangan penuh', async ({
  browser,
}) => {
  test.setTimeout(90_000)
  const user = await account()
  // 100 momen aktif di cadangan (tanpa berkas; cukup untuk mengisi kuota trigger).
  const rows = Array.from({ length: 100 }, () => ({
    id: crypto.randomUUID(),
    owner_id: user.id,
    day: '2026-01-01',
    taken_at: '2026-01-01T08:00:00Z',
    source: 'upload',
    width: 800,
    height: 600,
    mime: 'image/jpeg',
    size: 1000,
  }))
  const inserted = await admin.from('moments').insert(rows)
  expect(inserted.error).toBeNull()

  const phone = await device(browser, user)
  await phone.goto('/pocket')
  await synced(phone, 100)
  await saveToday(phone)
  await expect(status(phone)).toContainText('Cadangan penuh', { timeout: SYNC_TIMEOUT })
  await expect(phone.locator(`[data-day="${TODAY}"]`)).toHaveAttribute('data-saved', 'true')
  expect((await serverMoments(user)).filter((row) => !row.deleted_at)).toHaveLength(100)
})

test('perangkat yang pernah tersinkron ke akun lain bertanya dulu sebelum menggabungkan', async ({
  browser,
}) => {
  const first = await account()
  const second = await account()
  const phone = await device(browser, first)
  await phone.goto('/pocket')
  await saveToday(phone)
  await synced(phone, 1)

  // Akun lain login di perangkat yang sama.
  await signInAgain(phone, second)
  const card = phone.getByTestId('backup-card')
  await expect(card).toContainText('Gabungkan ke akun ini?')
  await expect(card).toContainText(first.email)
  expect(await serverMoments(second)).toEqual([])

  await card.getByRole('button', { name: 'Lanjut cadangkan' }).click()
  await synced(phone, 1)
  expect(await serverMoments(second)).toHaveLength(1)
})

test('hapus akun: cadangannya hilang dari server, kenangan di HP tetap, dan akun Google yang sama bisa mulai lagi', async ({
  browser,
}) => {
  test.setTimeout(150_000)
  const user = await account()
  const phoneA = await device(browser, user)
  await googleOn(phoneA)
  await phoneA.goto('/pocket')
  await synced(phoneA, 0)
  await saveToday(phoneA)
  await synced(phoneA, 1)
  const phoneB = await device(browser, user)
  await googleOn(phoneB)
  await phoneB.goto('/pocket')
  await synced(phoneB, 1)

  // Percobaan pertama dijawab 503 oleh tes. Yang kedua sampai ke fungsi `account`.
  const calls = await watchAccount(phoneA, true)
  const card = phoneA.getByTestId('backup-card')
  const dialog = phoneA.getByTestId('delete-account')
  await card.getByTestId('delete-account-open').click()
  await expect(dialog).toContainText(user.email)
  await expect(dialog).toContainText('kenangan di perangkat ini')
  // Fokus awal di Batal, jadi Enter tidak menghapus apa pun.
  await expect(dialog.getByRole('button', { name: 'Batal' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Batal' }).click()
  await expect(dialog).toBeHidden()
  expect(calls).toEqual([])

  await card.getByTestId('delete-account-open').click()
  await dialog.getByTestId('delete-account-confirm').click()
  await expect(dialog.getByRole('alert')).toContainText('belum terhapus')
  await expect(card).toContainText('Tercadang ke akun Google')
  await dialog.getByTestId('delete-account-confirm').click()
  await expect(dialog).toBeHidden()
  await expect(card.getByTestId('backup-notice')).toContainText('Akunmu sudah dihapus')
  await expect(card.getByRole('heading', { name: 'Cadangkan kenanganmu' })).toBeFocused()
  await expect(phoneA.locator(`[data-day="${TODAY}"]`)).toHaveAttribute('data-saved', 'true')
  expect(calls).toEqual([`DELETE true ${user.id}`, `DELETE true ${user.id}`])
  expect(await serverMoments(user)).toEqual([])
  expect(await serverFiles(user)).toEqual([])
  expect((await admin.auth.admin.getUserById(user.id)).data.user).toBeNull()

  // Akun Google yang sama masuk lagi dan mendapat id baru. Tidak ada pertanyaan soal akun lama,
  // dan kenangan di HP A langsung tercadang ke akun barunya.
  const again = await account(user.email)
  await signInAgain(phoneA, again)
  await synced(phoneA, 1)
  await expect(card).not.toContainText('Gabungkan ke akun ini?')
  expect(await serverFiles(again)).toHaveLength(1)

  // HP B masih mencatat akun lama. Setelah masuk lagi dengan akun yang sama, juga tidak ditanya.
  await signInAgain(phoneB, again)
  await synced(phoneB, 1)
  await expect(phoneB.getByTestId('backup-card')).not.toContainText('Gabungkan ke akun ini?')
})

test('akun yang sudah terhapus tapi jawaban 204-nya hilang: 401, lalu perangkat ini keluar dengan kabar', async ({
  browser,
}) => {
  const user = await account()
  const phone = await device(browser, user)
  await googleOn(phone)
  await phone.goto('/pocket')
  await synced(phone, 0)
  // Hapus sebelumnya sudah selesai di server, tapi jawabannya tidak sampai ke perangkat ini.
  await admin.auth.admin.deleteUser(user.id)
  const calls = await watchAccount(phone)
  const card = phone.getByTestId('backup-card')
  await card.getByTestId('delete-account-open').click()
  await phone.getByTestId('delete-account-confirm').click()
  await expect(card.getByTestId('backup-notice')).toContainText('Sesi login sudah berakhir')
  await expect(card.getByRole('button', { name: 'Masuk dengan Google' })).toBeVisible()
  expect(calls).toEqual([`DELETE true ${user.id}`])
})

test('belum login: tombol Google membuka login Supabase dan kembali ke Pocket', async ({
  page,
}) => {
  await googleOn(page)
  const authorize = page.waitForRequest('**/auth/v1/authorize?**')
  await page.route('**/auth/v1/authorize?**', (route) => route.fulfill({ body: 'ok' }))
  await page.goto('/pocket')
  const card = page.getByTestId('backup-card')
  await expect(card).toContainText('Cadangkan kenanganmu')
  await card.getByRole('button', { name: 'Masuk dengan Google' }).click()
  const url = new URL((await authorize).url())
  expect(url.searchParams.get('provider')).toBe('google')
  expect(url.searchParams.get('redirect_to')).toMatch(/\/pocket\?masuk=1$/)
  expect(url.searchParams.get('code_challenge')).toBeTruthy()
})

test('kembali dari Google dengan error: pesannya tampil dan alamatnya dibersihkan', async ({
  page,
}) => {
  await googleOn(page)
  await page.goto('/pocket?error=access_denied&error_description=Akses+ditolak')
  await expect(page.getByTestId('backup-card')).toContainText('Login dibatalkan')
  await expect(page).toHaveURL(/\/pocket$/)
})
