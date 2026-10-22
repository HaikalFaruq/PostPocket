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

test('PillChip dan Swatch kecil bisa diketuk sedikit di luar bentuknya', async ({ page }) => {
  // Pil 30 px dengan bidang ketuk 44 px: ketukan 5 px di atas pil tetap memilihnya.
  const pill = page
    .getByRole('radiogroup', { name: 'Bentuk kartu', exact: true })
    .getByRole('radio', { name: 'Persegi' })
  // Ketukan dengan koordinat hanya kena kalau titiknya di dalam layar.
  await pill.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const pillBox = (await pill.boundingBox())!
  await page.mouse.click(pillBox.x + pillBox.width / 2, pillBox.y - 5)
  await expect(pill).toHaveAttribute('aria-checked', 'true')
  // Swatch kertas 30 px dengan bidang ketuk sampai setengah jarak ke sebelahnya (40 px).
  const swatch = page
    .getByRole('radiogroup', { name: 'Kertas' })
    .getByRole('radio', { name: 'Navy' })
  await swatch.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const swatchBox = (await swatch.boundingBox())!
  await page.mouse.click(swatchBox.x + swatchBox.width / 2, swatchBox.y + swatchBox.height + 4)
  await expect(swatch).toHaveAttribute('aria-checked', 'true')
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
  // Tombol utama di footer tidak ikut dilipat.
  await expect(phone.getByRole('button', { name: 'Buat link untuk dikirim' })).toBeVisible()
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
