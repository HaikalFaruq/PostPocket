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

/** Satu hari Pocket berfoto `width`×`height`, lalu "Kirim sebagai surat" dari kantongnya. */
async function sendFromPocket(page: Page, size = { width: 600, height: 450 }) {
  await page.goto('/pocket')
  await page.locator(`[data-day="${TODAY}"]`).click()
  const base64 = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'hsl(200 70% 60%)'
    ctx.fillRect(0, 0, width, height)
    return canvas.toDataURL('image/jpeg').split(',')[1]!
  }, size)
  await page.getByTestId('moment-upload').setInputFiles({
    name: 'taman.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(base64, 'base64'),
  })
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: /^Hapus foto/ })).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Simpan', exact: true }).click()
  await expect(dialog).toBeHidden()
  await sendAgainFromPocket(page)
}

/** Buka lagi kantong hari ini, lalu "Kirim sebagai surat". */
async function sendAgainFromPocket(page: Page) {
  await page.goto(`/pocket/${TODAY}`)
  await page.getByRole('button', { name: 'Buka kantong' }).click()
  await page.getByRole('button', { name: 'Kirim sebagai surat' }).click()
}

/** Ketik draf lalu tunggu tersimpan (debounce 250 ms). */
async function writeDraft(page: Page, text: string) {
  await message(page).fill(text)
  await page.waitForTimeout(700)
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

test('foto dari Pocket ke draf kosong langsung jadi surat baru, foto tegak tetap utuh', async ({
  page,
}) => {
  await sendFromPocket(page, { width: 450, height: 800 })
  await expect(page).toHaveURL(/\/letter\/new$/)
  await expect(page.getByTestId('letter-notice')).toContainText('Foto dari Pocket 10 Oktober')
  // Bingkai mengikuti bentuk foto, jadi foto tegak tidak dipotong jadi landscape.
  const frame = page.getByTestId('letter-page').locator('.letter-photo').first()
  await expect(frame.locator('img')).toBeVisible()
  const ratio = await frame.evaluate((el: HTMLElement) => el.offsetWidth / el.offsetHeight)
  expect(ratio).toBeCloseTo(450 / 800, 1)
})

test('foto dari Pocket ke draf yang belum dikirim: ditanya di Pocket, draf lama tidak terbawa', async ({
  page,
}) => {
  await writeDraft(page, 'Draf rahasia untuk Rani')
  await sendFromPocket(page)

  // Pilihannya muncul di Pocket, sebelum pindah halaman, dan bilang draf lama akan dihapus.
  const choice = page.getByTestId('draft-choice')
  await expect(choice).toHaveAttribute('data-kind', 'photo')
  await expect(page).toHaveURL(new RegExp(`/pocket/${TODAY}$`))
  await expect(choice).toContainText('draf itu dihapus')
  // Fokus awal di pilihan yang tidak menghapus draf.
  await expect(choice.getByRole('button', { name: 'Tambahkan ke draf' })).toBeFocused()
  await choice.getByRole('button', { name: 'Hapus draf, mulai baru' }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
  await expect(message(page)).toHaveValue('')
  await expect(page.getByTestId('letter-notice')).toContainText('Foto dari Pocket 10 Oktober')
  await expect(page.getByText('1 foto', { exact: true })).toBeVisible()
})

test('batal di pilihan draf tidak memindahkan halaman maupun mengubah draf', async ({ page }) => {
  await writeDraft(page, 'Draf untuk Rani')
  await sendFromPocket(page)

  const choice = page.getByTestId('draft-choice')
  await choice.getByRole('button', { name: 'Batal' }).click()
  await expect(choice).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`/pocket/${TODAY}$`))
  await expect(page.getByRole('button', { name: 'Kirim sebagai surat' })).toBeVisible()

  await page.goto('/letter/new')
  await expect(message(page)).toHaveValue('Draf untuk Rani')
  await expect(page.getByText('Belum ada foto atau stiker.')).toBeVisible()
})

test('strip Booth tetap ada kalau pilihan draf dibatalkan, lalu tampil utuh di surat', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Kamera palsu hanya ada di Chromium')
  test.setTimeout(45_000)
  await writeDraft(page, 'Draf untuk Rani')
  await page.goto('/tv?booth=1')
  const record = page.getByTestId('booth-record')
  await expect(record).toBeEnabled({ timeout: 10_000 })
  await record.click()
  const result = page.getByTestId('booth-result')
  await expect(result).toBeVisible({ timeout: 15_000 })

  const choice = page.getByTestId('draft-choice')
  await result.getByRole('button', { name: 'Pakai di surat' }).click()
  await choice.getByRole('button', { name: 'Batal' }).click()
  await expect(choice).toBeHidden()
  await expect(page.getByTestId('booth-strip')).toBeVisible()

  await result.getByRole('button', { name: 'Pakai di surat' }).click()
  await choice.getByRole('button', { name: 'Hapus draf, mulai baru' }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
  // Strip 1×4 tetap setinggi aslinya, bukan dipotong jadi landscape.
  const frame = page.getByTestId('letter-page').locator('.letter-photo').first()
  await expect(frame.locator('img')).toBeVisible()
  const ratio = await frame.evaluate((el: HTMLElement) => el.offsetWidth / el.offsetHeight)
  expect(ratio).toBeLessThan(0.5)
})

test('foto kedua dari Pocket mengganti tata letak supaya tidak menumpuk', async ({ page }) => {
  await sendFromPocket(page)
  await expect(page).toHaveURL(/\/letter\/new$/)
  await writeDraft(page, 'Dua foto untuk Rani')

  await sendAgainFromPocket(page)
  await page.getByTestId('draft-choice').getByRole('button', { name: 'Tambahkan ke draf' }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
  await expect(page.getByTestId('letter-notice')).toContainText('"2 foto + teks"')
  await expect(message(page)).toHaveValue('Dua foto untuk Rani')
  await expect(page.getByText('2 foto', { exact: true })).toBeVisible()
  await expect(page.getByRole('radio', { name: '2 foto + teks' }).first()).toBeChecked()

  // Kedua foto berdampingan, bukan foto baru di atas foto lama.
  const centers = await page
    .getByTestId('letter-page')
    .first()
    .locator('.letter-photo')
    .evaluateAll((frames) =>
      frames.map((frame) => {
        const box = frame.getBoundingClientRect()
        const page = frame.closest('[data-testid="letter-page"]')!.getBoundingClientRect()
        return (box.left + box.width / 2 - page.left) / page.width
      }),
    )
  expect(centers).toHaveLength(2)
  expect(Math.abs(centers[0]! - centers[1]!)).toBeGreaterThan(0.3)
})

test('balasan tidak diam-diam memakai draf yang belum dikirim', async ({ page }) => {
  await message(page).fill('Surat yang nanti dibalas')
  const url = await createLink(page)
  const slug = url.split('/l/')[1]!
  await page.getByTestId('send-letter').getByRole('button', { name: 'Selesai' }).click()
  await page.getByTestId('sent-banner').getByRole('button', { name: 'Bikin surat baru' }).click()
  await writeDraft(page, 'Draf untuk Rara')

  // Batal: kembali ke surat yang mau dibalas, draf tetap.
  await page.goto(`/letter/new?balas=${slug}`)
  const choice = page.getByTestId('draft-choice')
  await expect(choice).toHaveAttribute('data-kind', 'reply')
  await choice.getByRole('button', { name: 'Batal' }).click()
  await expect(page).toHaveURL(new RegExp(`/l/${slug}$`))

  // Jadikan draf ini balasan: isinya tetap.
  await page.goto(`/letter/new?balas=${slug}`)
  await choice.getByRole('button', { name: 'Jadikan draf ini balasan' }).click()
  const banner = page.getByTestId('reply-banner')
  await expect(banner).toBeVisible()
  await expect(message(page)).toHaveValue('Draf untuk Rara')

  // Mulai balasan baru: draf lama dihapus.
  await banner.getByRole('button', { name: 'Batal membalas' }).click()
  await page.waitForTimeout(700)
  await page.goto(`/letter/new?balas=${slug}`)
  await choice.getByRole('button', { name: 'Hapus draf, mulai balasan' }).click()
  await expect(banner).toBeVisible()
  await expect(message(page)).toHaveValue('')
})

test('link lama tetap ada di "Surat terkirim" dan bisa dihapus dari sana', async ({ page }) => {
  await message(page).fill('Surat pertama untuk Rani')
  const url = await createLink(page)
  await page.getByTestId('send-letter').getByRole('button', { name: 'Selesai' }).click()
  await page.getByTestId('sent-banner').getByRole('button', { name: 'Bikin surat baru' }).click()
  await expect(page.getByTestId('letter-notice')).toContainText('Surat terkirim')

  await page.getByTestId('open-sent-letters').click()
  const list = page.getByTestId('sent-letters')
  const item = list.getByTestId('sent-letter')
  await expect(item).toHaveCount(1)
  await expect(item).toContainText('Surat pertama untuk Rani')
  await expect(item.getByRole('link', { name: 'Pratinjau' })).toHaveAttribute('href', url)

  page.once('dialog', (confirm) => confirm.accept())
  await item.getByRole('button', { name: 'Hapus' }).click()
  await expect(item).toHaveCount(0)
  await expect(list).toContainText('Belum ada surat')
  expect((await page.request.get(url)).status()).toBe(404)
})

test('petunjuk di bawah kartu mengikuti keadaan kartunya', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Petunjuk ini ada di sheet HP')
  const hint = page.getByTestId('card-hint')
  await expect(hint).toHaveText('Ketuk kartu untuk membuka')
  // Kartu tidak tertimpa petunjuk dan sheet opsi, juga di layar pendek (iPhone 15).
  const front = (await page.locator('.foil-rotor').boundingBox())!
  const hintBox = (await hint.boundingBox())!
  expect(front.y + front.height).toBeLessThanOrEqual(hintBox.y + 1)

  const card = page.getByRole('button', { name: /Kartu surat/ })
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await expect(hint).toHaveText('Ketuk kartu untuk menutup')
})
