import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/lab')
  await expect(page.getByRole('heading', { name: 'Lab komponen' })).toBeVisible()
})

test('PillGroup: klik dan panah keyboard memindah pilihan', async ({ page }) => {
  const group = page.getByRole('radiogroup', { name: 'Bentuk kartu', exact: true })
  await group.getByRole('radio', { name: 'Persegi' }).click()
  await expect(group.getByRole('radio', { name: 'Persegi' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  // Tekan seperti jari sungguhan: Reka memindah fokus sesudah keydown, jadi tombol jangan
  // langsung dilepas.
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(60)
  await page.keyboard.up('ArrowRight')
  await expect(group.getByRole('radio', { name: 'Mendatar' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(group.getByRole('radio', { name: 'Persegi' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
})

test('SwatchGroup: label warna aktif ikut di judul langkah', async ({ page }) => {
  await page
    .getByRole('radiogroup', { name: 'Kertas' })
    .getByRole('radio', { name: 'Navy' })
    .click()
  await expect(page.getByRole('heading', { name: /Kertas\s*Navy/ })).toBeVisible()
})

test('Modal: terbuka, fokus terkunci, Esc menutup', async ({ page }) => {
  await page.getByTestId('open-modal').click()
  const dialog = page.getByRole('dialog', { name: 'Simpan satu hari kecil' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Tutup' })).toBeVisible()
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('BottomSheet: tombol chevron melipat dan membuka sheet', async ({ page }) => {
  const phone = page.getByTestId('phone-frame')
  const toggle = phone.getByRole('button', { name: 'Sembunyikan opsi' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.click()
  const reopen = phone.getByRole('button', { name: 'Tampilkan opsi' })
  await expect(reopen).toHaveAttribute('aria-expanded', 'false')
  await expect(phone.getByRole('region', { name: 'Opsi contoh' })).toBeHidden()
  await reopen.click()
  await expect(phone.getByRole('region', { name: 'Opsi contoh' })).toBeVisible()
})

test('PhotoFrame: tiga gaya bingkai bisa dipilih', async ({ page }) => {
  const group = page.getByRole('radiogroup', { name: 'Bingkai foto', exact: true })
  for (const label of ['Prangko', 'Tiket bioskop', 'Polaroid']) {
    await group.getByRole('radio', { name: label }).click()
    await expect(page.locator('figure.photo-frame').first()).toBeVisible()
  }
  await expect(page.locator('figure.is-polaroid')).toHaveCount(2)
})
