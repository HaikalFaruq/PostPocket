import { expect, test } from '@playwright/test'

// Halaman info untuk tester beta: privasi, lisensi, dan halaman galat berbahasa Indonesia.

test('Beranda menautkan halaman privasi dan lisensi', async ({ page }) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')
  await footer.getByRole('link', { name: 'Privasi' }).click()
  await expect(page).toHaveURL(/\/privasi$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privasi')
  await expect(page.getByRole('main')).toContainText('30 hari')
  await expect(page.getByRole('main')).toContainText('bukan alamat IP-nya')

  await page.goto('/')
  await page.getByRole('contentinfo').getByRole('link', { name: 'Lisensi' }).click()
  await expect(page).toHaveURL(/\/lisensi$/)
  await expect(page.getByRole('main')).toContainText('GNU LGPL versi 3')
  await expect(page.getByRole('main')).toContainText('Microsoft Fluent Emoji')
})

test('alamat yang tidak ada mendapat halaman 404 berbahasa Indonesia', async ({ page }) => {
  const response = await page.goto('/halaman-yang-tidak-ada')
  expect(response?.status()).toBe(404)
  const error = page.getByTestId('error-page')
  await expect(error.getByRole('heading', { level: 1 })).toHaveText('Halaman ini tidak ada')
  await error.getByRole('link', { name: 'Ke Beranda' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('Lapor masalah membuka kanal laporan dengan halaman, versi, dan perangkat', async ({
  page,
  context,
}) => {
  // Jangan sampai test membuka GitHub sungguhan.
  await context.route('https://github.com/**', (route) => route.fulfill({ body: 'ok' }))
  await page.goto('/')
  await expect(page.getByRole('contentinfo')).toContainText('Versi beta (lokal)')
  const popup = context.waitForEvent('page')
  await page.getByRole('contentinfo').getByTestId('feedback-link').click()
  const report = new URL((await popup).url())
  expect(report.origin + report.pathname).toBe(
    'https://github.com/HaikalFaruq/PostPocket/issues/new',
  )
  const body = report.searchParams.get('body') ?? ''
  expect(body).toContain('bisa dibaca publik')
  expect(body).toContain('Halaman: /')
  expect(body).toContain('Versi: lokal')
  expect(body).toMatch(/Perangkat: Mozilla\//)
})

test('halaman surat punya jalan lapor masalah tanpa membocorkan link suratnya', async ({
  page,
  context,
}) => {
  await context.route('https://github.com/**', (route) => route.fulfill({ body: 'ok' }))
  const response = await page.goto('/l/AbCdEfGhIj')
  expect(response?.status()).toBe(404)
  const popup = context.waitForEvent('page')
  await page.getByRole('contentinfo').getByTestId('feedback-link').click()
  const body = new URL((await popup).url()).searchParams.get('body') ?? ''
  expect(body).toContain('Halaman: /l/…')
  expect(body).not.toContain('AbCdEfGhIj')
})
