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
  await error.getByRole('button', { name: 'Ke Beranda' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
