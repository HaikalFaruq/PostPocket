import { expect, test, type Page } from '@playwright/test'

/** Foto uji berwarna, dibuat di browser lalu dikirim sebagai JPEG. */
async function photo(page: Page, hue: number): Promise<Buffer> {
  const base64 = await page.evaluate((h) => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 450
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = `hsl(${h} 70% 60%)`
    ctx.fillRect(0, 0, 600, 450)
    return canvas.toDataURL('image/jpeg').split(',')[1]!
  }, hue)
  return Buffer.from(base64, 'base64')
}

/** Tambah foto lewat tombol "+ Foto" album yang sedang di tengah rak. */
async function addPhotos(page: Page, hues: number[]) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Foto', exact: true }).click()
  await (
    await chooser
  ).setFiles(
    await Promise.all(
      hues.map(async (hue, i) => ({
        name: `foto-${i}.jpg`,
        mimeType: 'image/jpeg',
        buffer: await photo(page, hue),
      })),
    ),
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tv')
  await expect(page.getByTestId('tv-idle')).toContainText('NO SIGNAL')
})

test('ganti warna clay langsung mengubah badan TV tanpa memuat gambar', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.getByRole('radio', { name: 'Sage' }).click()
  await expect(page.locator('.tv')).toHaveAttribute('style', /--clay: #9db99b/)
  expect(requests.filter((url) => /\.(png|jpe?g|webp|svg)/.test(url))).toEqual([])
})

test('foto masuk album, CD diputar dengan filter, lalu dikeluarkan', async ({ page }) => {
  await addPhotos(page, [20, 200])
  await expect(page.getByTestId('cd-shelf').locator('[data-album^="bulan-"]')).toHaveCount(1)
  await page.getByTestId('cd-disc').click({ position: { x: 110, y: 70 } })

  const slideshow = page.getByTestId('tv-slideshow')
  await expect(slideshow).toBeVisible()
  await expect(slideshow.locator('img')).toHaveAttribute('src', /^blob:/)
  await expect(slideshow).toContainText('/2')
  await page.getByRole('radio', { name: 'Noir' }).click()
  await expect(slideshow).toHaveAttribute('data-filter', 'noir')
  await expect(slideshow.locator('img')).toHaveCSS('filter', /grayscale/)

  await page.getByRole('button', { name: 'KELUARKAN CD' }).click()
  await expect(page.getByTestId('tv-idle')).toBeVisible()
})

test('rak CD bisa digeser lewat tombol panah dan keyboard, dan tetap ada setelah dimuat ulang', async ({
  page,
}) => {
  await addPhotos(page, [40])
  const shelf = page.getByTestId('cd-shelf')
  // Album bulanan dari foto tadi, lalu "Album pertama" buatan otomatis.
  await expect(shelf.locator('.cd-case')).toHaveCount(2)
  await expect(shelf).toHaveAttribute('data-index', '0')
  await page.getByRole('button', { name: 'Album berikutnya' }).click()
  await expect(shelf).toHaveAttribute('data-index', '1')
  await shelf.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(shelf).toHaveAttribute('data-index', '0')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('tv-slideshow')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('cd-shelf').locator('.cd-case')).toHaveCount(2)
})
