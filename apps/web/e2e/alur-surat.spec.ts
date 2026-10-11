import { expect, test, type Page } from '@playwright/test'

// Alur surat dari sudut pandang pengirim: surat kosong, surat yang sudah jadi link, dan foto
// yang datang dari Pocket ke draf yang belum dikirim.

const TODAY = '2026-10-10'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 10, 10, 0))
  await page.goto('/letter/new')
  await expect(page.locator('.foil-rotor')).toBeVisible()
})

const message = (page: Page) => page.getByRole('textbox', { name: 'Isi surat' })

async function createLink(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Buat link untuk dikirim' }).click()
  await expect(page.getByTestId('send-letter')).toHaveAttribute('data-state', 'done', {
    timeout: 20_000,
  })
  return page.getByTestId('sent-url').inputValue()
}

/** Satu hari Pocket berfoto, lalu "Kirim sebagai surat" dari kantongnya. */
async function sendFromPocket(page: Page) {
  await page.goto('/pocket')
  await page.locator(`[data-day="${TODAY}"]`).click()
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 450
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'hsl(200 70% 60%)'
    ctx.fillRect(0, 0, 600, 450)
    return canvas.toDataURL('image/jpeg').split(',')[1]!
  })
  await page.getByTestId('moment-upload').setInputFiles({
    name: 'taman.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(base64, 'base64'),
  })
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: /^Hapus foto/ })).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Simpan', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.goto(`/pocket/${TODAY}`)
  await page.getByRole('button', { name: 'Buka kantong' }).click()
  await page.getByRole('button', { name: 'Kirim sebagai surat' }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
}

test('surat kosong tidak bisa dibuat linknya', async ({ page }) => {
  await page.getByRole('button', { name: 'Buat link untuk dikirim' }).click()
  const warning = page.getByText('Isi suratnya masih kosong')
  await expect(warning).toBeVisible()
  await expect(page.getByTestId('send-letter')).toHaveCount(0)
  await expect(message(page)).toBeFocused()

  await message(page).fill('Halo')
  await expect(warning).toBeHidden()
})

test('draf yang sudah jadi link menampilkan link yang sama, sampai drafnya diubah', async ({
  page,
}) => {
  await message(page).fill('Halo, ini surat pertama')
  const url = await createLink(page)
  await page.getByTestId('send-letter').getByRole('button', { name: 'Selesai' }).click()

  // Tetap tercatat setelah dimuat ulang, dan link-nya bisa dilihat lagi tanpa membuat surat baru.
  await page.reload()
  const banner = page.getByTestId('sent-banner')
  await expect(banner).toBeVisible()
  await page.getByRole('button', { name: 'Lihat link surat' }).click()
  await expect(page.getByTestId('sent-url')).toHaveValue(url)
  await page.getByTestId('send-letter').getByRole('button', { name: 'Selesai' }).click()

  await message(page).fill('Halo, ini surat pertama yang diubah')
  await expect(banner).toBeHidden()
  await expect(page.getByRole('button', { name: 'Buat link untuk dikirim' })).toBeVisible()

  await message(page).fill('Halo, ini surat pertama')
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Bikin surat baru' }).click()
  await expect(banner).toBeHidden()
  await expect(message(page)).toHaveValue('')
})

test('foto dari Pocket memulai surat baru tanpa membawa isi draf lama', async ({ page }) => {
  await message(page).fill('Draf rahasia untuk Rani')
  await page.waitForTimeout(700)
  await sendFromPocket(page)

  const choice = page.getByTestId('photo-choice')
  await expect(choice).toBeVisible()
  await choice.getByRole('button', { name: 'Mulai surat baru' }).click()
  await expect(choice).toBeHidden()
  await expect(message(page)).toHaveValue('')
  await expect(page.getByTestId('letter-notice')).toContainText('Foto dari Pocket 10 Oktober')
  await expect(page.getByText('1 foto', { exact: true })).toBeVisible()
})

test('foto dari Pocket bisa ditambahkan ke draf yang belum dikirim', async ({ page }) => {
  await message(page).fill('Draf untuk Rani')
  await page.waitForTimeout(700)
  await sendFromPocket(page)

  await page.getByTestId('photo-choice').getByRole('button', { name: 'Tambahkan ke draf' }).click()
  await expect(message(page)).toHaveValue('Draf untuk Rani')
  await expect(page.getByText('1 foto', { exact: true })).toBeVisible()
})
