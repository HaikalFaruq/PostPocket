import { expect, test } from '@playwright/test'

test('Beranda dibuka dengan contoh surat yang bisa dibuka, lalu Pocket dan Booth', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kenangan kecil')
  for (const name of [/Pocket/, /Booth/]) {
    await expect(page.getByRole('main').getByRole('link', { name })).toBeVisible()
  }
  const card = page.getByRole('button', { name: /Contoh surat/ })
  await expect(card).toHaveAttribute('aria-pressed', 'false')
  await card.press('Enter')
  await expect(card).toHaveAttribute('aria-pressed', 'true')
})

test('Tulis surat membuka editor surat', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Tulis surat' }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
  await expect(page.getByRole('heading', { name: 'Surat foil' })).toBeVisible()
})
