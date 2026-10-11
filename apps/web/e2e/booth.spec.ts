import { expect, test } from '@playwright/test'

test('Booth: hitung mundur, 4 jepretan jadi strip, lalu disimpan ke Pocket dan CD', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Kamera palsu hanya ada di Chromium')
  test.setTimeout(45_000)
  await page.goto('/tv?booth=1')
  await expect(page.getByTestId('booth-camera')).toBeVisible()
  // Judul halaman mengikuti Booth, bukan TV.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/PHOTO\s+BOOTH/)
  const record = page.getByTestId('booth-record')
  await expect(record).toBeEnabled({ timeout: 10_000 })
  await page.getByRole('radio', { name: 'Noir' }).click()
  await record.click()
  await expect(page.getByTestId('booth-camera')).toContainText('3')
  // Selama memotret, layar menunjukkan jepretan ke berapa.
  await expect(page.getByTestId('booth-progress')).toContainText(/FOTO \d\/4/, { timeout: 10_000 })

  const result = page.getByTestId('booth-result')
  await expect(result).toBeVisible({ timeout: 15_000 })
  const strip = page.getByTestId('booth-strip')
  await expect(strip).toHaveAttribute('src', /^blob:/)
  // Strip 1×4: tinggi jauh lebih besar dari lebar.
  const size = await strip.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ])
  expect(size[1]!).toBeGreaterThan(size[0]! * 2.5)

  await result.getByRole('button', { name: 'Simpan ke Pocket' }).click()
  await expect(result).toContainText('Tersimpan di kantong hari ini')
  await result.getByRole('button', { name: 'Masukkan ke CD' }).click()
  await expect(result).toContainText('Masuk ke CD Photo Booth')

  const download = page.waitForEvent('download')
  await result.getByRole('button', { name: 'Unduh PNG' }).click()
  expect((await download).suggestedFilename()).toMatch(/^postpocket-booth-\d{4}-\d{2}-\d{2}\.png$/)

  await result.getByRole('button', { name: 'Tutup' }).click()
  await page.getByRole('button', { name: 'KELUAR' }).click()
  // Empat jepretan masuk album bulan ini dan CD Photo Booth.
  await expect(page.getByTestId('cd-shelf').locator('.cd-case')).toHaveCount(2)
})

test('Booth tanpa izin kamera menawarkan foto dari galeri', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Di WebKit Playwright kamera tidak tersedia')
  await page.goto('/tv?booth=1')
  await expect(page.getByTestId('booth-denied')).toBeVisible({ timeout: 10_000 })
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3a7bd5'
    ctx.fillRect(0, 0, 640, 480)
    return canvas.toDataURL('image/jpeg').split(',')[1]!
  })
  await page.getByTestId('booth-upload').setInputFiles({
    name: 'galeri.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(base64, 'base64'),
  })
  await expect(page.getByTestId('booth-strip')).toHaveAttribute('src', /^blob:/)
})

test('Pakai di surat membawa strip ke editor surat', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Kamera palsu hanya ada di Chromium')
  test.setTimeout(45_000)
  await page.goto('/tv?booth=1')
  await page.getByRole('radio', { name: 'Satu foto' }).click()
  const record = page.getByTestId('booth-record')
  await expect(record).toBeEnabled({ timeout: 10_000 })
  await record.click()
  await expect(page.getByTestId('booth-result')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Pakai di surat' }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
  await expect(page.getByTestId('letter-page').locator('[data-kind="photo"] img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(page.getByText('1 foto', { exact: true })).toBeVisible()
})

test('strip yang belum disimpan tidak dibuang tanpa bertanya', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Kamera palsu hanya ada di Chromium')
  test.setTimeout(45_000)
  await page.goto('/tv?booth=1')
  await page.getByRole('radio', { name: 'Satu foto' }).click()
  const record = page.getByTestId('booth-record')
  await expect(record).toBeEnabled({ timeout: 10_000 })
  await record.click()
  const result = page.getByTestId('booth-result')
  await expect(result).toBeVisible({ timeout: 10_000 })

  let asked = ''
  page.once('dialog', (dialog) => {
    asked = dialog.message()
    dialog.dismiss()
  })
  await result.getByRole('button', { name: 'Ulangi' }).click()
  expect(asked).toContain('belum disimpan')
  await expect(result).toBeVisible()

  // Back di HP juga bertanya dulu, dan tidak meninggalkan TV.
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.goBack()
  await expect(result).toBeVisible()
  await expect(page).toHaveURL(/\/tv\?booth=1$/)

  // Setelah disimpan, menutup tidak bertanya lagi.
  await result.getByRole('button', { name: /Simpan ke Pocket/ }).click()
  await expect(result).toContainText('Tersimpan di kantong hari ini')
  await result.getByRole('button', { name: 'Tutup' }).click()
  await expect(result).toBeHidden()
})
