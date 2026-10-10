import { expect, test } from '@playwright/test'

test('uji kirim: foto dikompres, OG dirender, surat terbit, dibaca, dibuka, dan dihapus', async ({
  page,
}) => {
  await page.goto('/lab/kirim')
  await page.getByRole('button', { name: 'Jalankan uji kirim' }).click()
  const lab = page.getByTestId('lab-kirim')
  await expect(lab).toHaveAttribute('data-status', 'done', { timeout: 20_000 })

  const photo = page.getByTestId('photo')
  await expect(photo).toHaveAttribute('data-type', 'image/jpeg')
  expect(Number(await photo.getAttribute('data-size'))).toBeLessThanOrEqual(500_000)

  const og = page.getByTestId('og')
  await expect(og).toHaveAttribute('data-width', '1200')
  await expect(og).toHaveAttribute('data-height', '630')
  expect(Number(await og.getAttribute('data-size'))).toBeLessThanOrEqual(300_000)

  await expect(page.getByTestId('slug')).toHaveText(/^[A-Za-z0-9]{10}$/)
  await expect(page.getByTestId('same-content')).toHaveText('ya')
  await expect(page.getByTestId('photo-count')).toHaveText('1')
  await expect(page.getByTestId('deleted')).toHaveText('ya')
})
