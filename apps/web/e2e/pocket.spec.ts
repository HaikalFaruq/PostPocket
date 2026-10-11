import { expect, test, type Page } from '@playwright/test'

// Hari ini dibuat tetap supaya kalender dan judul bulan bisa dicek pasti.
const TODAY = '2026-10-10'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 10, 10, 0))
})

/** Foto uji berwarna, dibuat di browser lalu dikirim sebagai JPEG. */
async function photos(page: Page, hues: number[]) {
  return Promise.all(
    hues.map(async (hue, i) => {
      const base64 = await page.evaluate((h) => {
        const canvas = document.createElement('canvas')
        canvas.width = 600
        canvas.height = 450
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = `hsl(${h} 70% 60%)`
        ctx.fillRect(0, 0, 600, 450)
        return canvas.toDataURL('image/jpeg').split(',')[1]!
      }, hue)
      return {
        name: `momen-${i}.jpg`,
        mimeType: 'image/jpeg',
        buffer: Buffer.from(base64, 'base64'),
      }
    }),
  )
}

/** Simpan satu hari lewat modal dengan desain bawaan dan foto-foto ini. */
async function saveDay(page: Page, day: string, hues: number[]) {
  await page.locator(`[data-day="${day}"]`).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.getByTestId('moment-upload').setInputFiles(await photos(page, hues))
  await expect(dialog.getByRole('button', { name: /^Hapus foto/ })).toHaveCount(hues.length)
  await dialog.getByRole('button', { name: 'Simpan', exact: true }).click()
  await expect(dialog).toBeHidden()
}

// Penghitung ada di header (layar lebar) atau di kartu kalender (HP).
const savedCount = (page: Page) =>
  page.locator('[data-testid^="saved-count"]').filter({ visible: true })

test('kalender menandai hari ini, pindah bulan, dan lompat ke tahun lain', async ({ page }) => {
  await page.goto('/pocket')
  const label = page.getByTestId('month-label')
  await expect(label).toHaveText('Oktober 2026')
  await expect(page.locator(`[data-day="${TODAY}"]`)).toHaveAccessibleName(
    'Sabtu, 10 Oktober 2026, hari ini',
  )
  // Hari yang belum datang tidak bisa diisi.
  await expect(page.locator('[data-day="2026-10-11"]')).toHaveCount(0)
  await expect(savedCount(page)).toHaveText('0 hari tersimpan')

  await page.getByRole('button', { name: 'Bulan sebelumnya' }).click()
  await expect(label).toHaveText('September 2026')
  await expect(page.locator('[data-day="2026-09-30"]')).toBeVisible()
  await page.getByRole('button', { name: 'Bulan berikutnya' }).click()
  await expect(label).toHaveText('Oktober 2026')

  await page.getByRole('button', { name: 'Pilih bulan' }).click()
  await page.getByRole('button', { name: 'Tahun sebelumnya' }).click()
  await page.getByRole('button', { name: 'Februari 2025' }).click()
  await expect(label).toHaveText('Februari 2025')
  await expect(page.locator('[data-day="2025-02-28"]')).toBeVisible()
})

test('modal simpan hari: preview langsung berubah, sel dan penghitung langsung terisi, tetap ada setelah dimuat ulang', async ({
  page,
}) => {
  await page.goto('/pocket')
  await page.locator(`[data-day="${TODAY}"]`).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Simpan satu hari kecil' })).toBeVisible()
  await expect(dialog).toContainText('Sabtu, 10 Oktober 2026')

  const preview = page.getByTestId('packet-preview')
  const packet = preview.locator('.packet')
  const combo = page.getByTestId('combo-name')
  await expect(combo).toHaveText('BLUEBERRY / HATI')
  const blue = await packet.getAttribute('style')
  await dialog.getByRole('radio', { name: 'Pink' }).click()
  await expect(packet).not.toHaveAttribute('style', blue!)
  await dialog.getByRole('radio', { name: 'Bunga sakura' }).click()
  await expect(combo).toHaveText('STROBERI / BUNGA SAKURA')
  await expect(preview.locator('.packet__sticker')).toHaveAttribute('alt', 'Bunga sakura')

  // Foto pertama langsung menyelip di depan kantong, dengan bingkai pilihan.
  await page.getByTestId('moment-upload').setInputFiles(await photos(page, [20, 200]))
  await expect(dialog.getByRole('button', { name: /^Hapus foto/ })).toHaveCount(2)
  await expect(preview.locator('.photo-frame img')).toHaveAttribute('src', /^blob:/)
  await dialog.getByRole('radio', { name: 'Prangko' }).click()
  await expect(preview.locator('.photo-frame')).toHaveClass(/is-stamp/)

  await dialog.getByRole('button', { name: 'Simpan', exact: true }).click()
  await expect(dialog).toBeHidden()
  const cell = page.locator(`[data-day="${TODAY}"]`)
  await expect(cell).toHaveAttribute('data-saved', 'true')
  await expect(cell.locator('.packet')).toBeVisible()
  await expect(savedCount(page)).toHaveText('1 hari tersimpan')

  await page.reload()
  await expect(cell).toHaveAttribute('data-saved', 'true')
  await expect(savedCount(page)).toHaveText('1 hari tersimpan')
})

test('buka kantong: disobek, foto keluar, lalu dikirim sebagai surat', async ({ page }) => {
  await page.goto('/pocket')
  await saveDay(page, TODAY, [20, 200])
  await page.locator(`[data-day="${TODAY}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/pocket/${TODAY}$`))

  const day = page.getByTestId('pocket-day')
  await expect(day).toHaveAttribute('data-torn', 'false')
  await page.getByRole('button', { name: 'Buka kantong' }).click()
  await expect(day).toHaveAttribute('data-torn', 'true')
  const moments = page.getByTestId('moment')
  await expect(moments).toHaveCount(2)
  // Di HP pendek, tombol-tombolnya digulir sampai kelihatan setelah kantong disobek.
  await expect(page.getByRole('button', { name: 'Kirim sebagai surat' })).toBeInViewport()
  await expect(moments.first()).toHaveAttribute('aria-selected', 'true')
  await expect(moments.nth(1).locator('img')).toHaveAttribute('src', /^blob:/)

  await moments.nth(1).click()
  await expect(moments.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Kirim sebagai surat' }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
  await expect(page.getByTestId('letter-page').locator('[data-kind="photo"] img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(page.getByText('1 foto', { exact: true })).toBeVisible()
})

test('putar di TV: isi kantong langsung diputar, foto baru masuk ke kantong yang sama', async ({
  page,
}) => {
  await page.goto('/pocket')
  await saveDay(page, TODAY, [20, 200])
  await page.goto(`/pocket/${TODAY}`)
  await page.getByRole('button', { name: 'Buka kantong' }).click()
  await page.getByRole('link', { name: 'Putar di TV' }).click()
  await expect(page).toHaveURL(new RegExp(`/tv\\?hari=${TODAY}$`))

  const slideshow = page.getByTestId('tv-slideshow')
  await expect(slideshow).toContainText('10 OKTOBER 2026')
  await expect(slideshow).toContainText('/2')

  // "+ Foto" di CD kantong menambah foto ke hari itu juga.
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Foto', exact: true }).click()
  await (await chooser).setFiles(await photos(page, [300]))
  await expect(slideshow).toContainText('/3')

  await page.goto(`/pocket/${TODAY}`)
  await page.getByRole('button', { name: 'Buka kantong' }).click()
  await expect(page.getByTestId('moment')).toHaveCount(3)
})

test('foto kenangan pertama meminta penyimpanan permanen, sekali saja', async ({ page }) => {
  // Penyimpanan permanen dipalsukan supaya bisa dihitung; browser sungguhan bisa menolaknya.
  // Dipasang di prototype karena WebKit bisa membuat ulang objek navigator.storage.
  await page.addInitScript(() => {
    const state = { granted: false, calls: 0 }
    Object.assign(window, { storageState: state })
    if (!('StorageManager' in window)) return
    StorageManager.prototype.persisted = async () => state.granted
    StorageManager.prototype.persist = async () => {
      state.calls++
      state.granted = true
      return true
    }
  })
  const calls = () =>
    page.evaluate(
      () => (window as unknown as { storageState: { calls: number } }).storageState.calls,
    )
  await page.goto('/pocket')
  test.skip(!(await page.evaluate(() => 'StorageManager' in window)), 'StorageManager tidak ada')
  await saveDay(page, TODAY, [20])
  await expect.poll(calls).toBe(1)

  await page.goto(`/pocket/${TODAY}`)
  await page.getByRole('button', { name: 'Buka kantong' }).click()
  await page.getByTestId('pocket-upload').setInputFiles(await photos(page, [200]))
  await expect(page.getByTestId('moment')).toHaveCount(2)
  expect(await calls()).toBe(1)
})

test('menutup modal dengan foto yang belum disimpan bertanya dulu', async ({ page }) => {
  await page.goto('/pocket')
  await page.locator(`[data-day="${TODAY}"]`).click()
  const dialog = page.getByRole('dialog')
  await page.getByTestId('moment-upload').setInputFiles(await photos(page, [20]))
  await expect(dialog.getByRole('button', { name: /^Hapus foto/ })).toHaveCount(1)

  page.once('dialog', (confirm) => confirm.dismiss())
  await dialog.getByRole('button', { name: 'Nanti saja' }).click()
  await expect(dialog).toBeVisible()

  page.once('dialog', (confirm) => confirm.accept())
  await dialog.getByRole('button', { name: 'Nanti saja' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator(`[data-day="${TODAY}"]`)).not.toHaveAttribute('data-saved', 'true')
})

test('tanggal tanpa kantong menawarkan untuk membuatnya, tanggal yang belum datang ditolak', async ({
  page,
}) => {
  await page.goto('/pocket/2026-10-09')
  await expect(page.getByTestId('pocket-empty')).toBeVisible()
  await page.getByRole('button', { name: 'Buat kantong' }).click()
  await expect(page.getByRole('dialog')).toContainText('Jumat, 9 Oktober 2026')

  await page.goto('/pocket/2026-10-11')
  await expect(page).toHaveURL(/\/pocket$/)
  await expect(page.getByTestId('month-label')).toHaveText('Oktober 2026')
})
