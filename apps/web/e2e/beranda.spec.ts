import { expect, test } from '@playwright/test'

test('Beranda menampilkan tiga pintu masuk dan contoh surat yang bisa dibuka', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tangkap momen')
  for (const title of ['Booth', 'Pocket', 'Letter']) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  }
  const card = page.getByRole('button', { name: /Contoh surat/ })
  await expect(card).toHaveAttribute('aria-pressed', 'false')
  await card.press('Enter')
  await expect(card).toHaveAttribute('aria-pressed', 'true')
})

test('pintu Letter membuka editor surat', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Letter/ }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
  await expect(page.getByRole('heading', { name: 'Surat foil' })).toBeVisible()
})
