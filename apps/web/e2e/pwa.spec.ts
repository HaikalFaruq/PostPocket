import { expect, test } from '@playwright/test'

// Di file lain service worker diblokir (playwright.config.ts).
test.use({ serviceWorkers: 'allow' })

test('manifest dan ikon aplikasi tersedia', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  )
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/apple-touch-icon-180x180.png',
  )

  const response = await request.get('/manifest.webmanifest')
  expect(response.headers()['content-type']).toContain('application/manifest+json')
  const manifest = await response.json()
  expect(manifest).toMatchObject({
    name: 'PostPocket',
    start_url: '/',
    display: 'standalone',
    lang: 'id',
  })
  const icons: { src: string; sizes: string; purpose?: string }[] = manifest.icons
  expect(icons.map((icon) => [icon.sizes, icon.purpose ?? 'any'])).toEqual([
    ['192x192', 'any'],
    ['512x512', 'any'],
    ['512x512', 'maskable'],
  ])
  for (const icon of [...icons, { src: '/apple-touch-icon-180x180.png' }]) {
    const image = await request.get(icon.src)
    expect(image.headers()['content-type'], icon.src).toBe('image/png')
  }
})

test('Beranda tetap terbuka offline, halaman yang belum tersimpan diganti halaman offline', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Service worker di Playwright hanya andal di Chromium')
  await page.goto('/')
  // Tunggu service worker aktif dan Beranda tersimpan. Pakai poll + evaluate karena
  // waitForFunction tidak menunggu Promise dari fungsi async.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration?.active?.state !== 'activated') return false
          return !!(await (await caches.open('pages')).match('/'))
        }),
      { timeout: 15_000 },
    )
    .toBe(true)

  await context.setOffline(true)
  const response = await page.reload()
  expect(response?.fromServiceWorker()).toBe(true)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kenangan kecil')
  await expect(page.getByRole('button', { name: /Contoh surat/ })).toBeVisible()

  await page.goto('/lab')
  await expect(page.getByRole('heading', { name: 'Kamu sedang offline' })).toBeVisible()
  await context.setOffline(false)
})

test('editor surat tetap bisa dipakai offline sejak kunjungan pertama', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Service worker di Playwright hanya andal di Chromium')
  await page.goto('/')
  await expect
    .poll(
      () => page.evaluate(async () => !!(await (await caches.open('pages')).match('/letter/new'))),
      { timeout: 15_000 },
    )
    .toBe(true)

  await context.setOffline(true)
  await page.goto('/letter/new')
  await expect(page.getByTestId('letter-editor')).toBeVisible()
  await page.getByRole('textbox', { name: 'Isi surat' }).fill('Ditulis tanpa sinyal')
  await expect(page.getByRole('textbox', { name: 'Isi surat' })).toHaveValue('Ditulis tanpa sinyal')
  await context.setOffline(false)
})

test('Pocket dan TV tetap terbuka offline, lengkap dengan stiker dan kenangan di perangkat', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Service worker di Playwright hanya andal di Chromium')
  await page.goto('/pocket')
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration?.active?.state !== 'activated') return false
          const pages = await caches.open('pages')
          return !!(await pages.match('/pocket')) && !!(await pages.match('/tv'))
        }),
      { timeout: 15_000 },
    )
    .toBe(true)

  // Hari ini adalah tanggal terakhir yang bisa diisi di kalender.
  const today = page.locator('[data-day]').last()
  await today.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Simpan tanpa foto' }).click()
  // Modal baru tertutup setelah data tertulis di IndexedDB.
  await expect(dialog).toBeHidden()
  await expect(today).toHaveAttribute('data-saved', 'true')

  await context.setOffline(true)
  await page.reload()
  await expect(today).toHaveAttribute('data-saved', 'true')
  await expect
    .poll(() => today.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)
  await page.goto('/tv')
  await expect(page.getByTestId('tv-idle')).toContainText('NO SIGNAL')
  await context.setOffline(false)
})

test('kartu Pasang memanggil dialog pasang bawaan browser', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'beforeinstallprompt hanya ada di Chromium')
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Contoh surat/ })).toBeVisible()
  const card = page.getByTestId('install-card')
  await expect(card).toHaveCount(0)

  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: () => document.documentElement.setAttribute('data-prompted', ''),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    })
    window.dispatchEvent(event)
  })
  await expect(card).toHaveAttribute('data-hint', 'prompt')
  await card.getByRole('button', { name: 'Pasang' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-prompted', '')
  await expect(card).toHaveCount(0)
})

test('iPhone mendapat petunjuk Tambah ke Layar Utama yang bisa ditutup', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'webkit', 'Petunjuk ini khusus iPhone')
  await page.goto('/')
  const card = page.getByTestId('install-card')
  await expect(card).toHaveAttribute('data-hint', 'ios')
  await expect(card).toContainText('Tambah ke Layar Utama')

  await card.getByRole('button', { name: 'Oke, mengerti' }).click()
  await expect(card).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: /Contoh surat/ })).toBeVisible()
  await expect(card).toHaveCount(0)
})
