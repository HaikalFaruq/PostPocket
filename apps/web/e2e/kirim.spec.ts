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

test('kena batas kiriman per jaringan: diminta menunggu, Coba lagi bukan tombol utama', async ({
  page,
}) => {
  // Server menolak karena terlalu banyak surat dari jaringan ini (Retry-After 30 menit).
  await page.route('**/mock-api/letters', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '1800' },
          body: JSON.stringify({ error: { code: 'rate_limited', message: 'pelan' } }),
        })
      : route.continue(),
  )
  await page.goto('/letter/new')
  await page.getByRole('textbox', { name: 'Isi surat' }).fill('Halo')
  await page.getByRole('button', { name: 'Buat link untuk dikirim' }).click()
  const sheet = page.getByTestId('send-letter')
  // Sebelum dikirim, gambar OG-nya dirender dulu; di WebKit CI tanpa GPU itu bisa lebih dari 5 s.
  await expect(sheet.getByRole('alert')).toContainText(
    'Coba lagi dalam 30 menit, atau kirim lewat data seluler',
    { timeout: 20_000 },
  )
  await expect(sheet.getByRole('button', { name: 'Tutup' })).toHaveClass(/bg-ink/)
  await expect(sheet.getByRole('button', { name: 'Coba lagi' })).not.toHaveClass(/bg-ink/)
})
