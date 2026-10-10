import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/lab/safari')
  await expect(page.getByTestId('checks').locator('[data-check="bitmap"]')).toBeVisible()
})

test('halaman cek Safari menampilkan hasil cek fitur', async ({ page, browserName }) => {
  const checks = page.getByTestId('checks')
  await expect(checks.locator('[data-check^="filter-"]')).toHaveCount(7)
  if (browserName === 'chromium') {
    await expect(checks.locator('[data-check="ctx-filter"]')).toHaveAttribute('data-status', 'ok')
  }
})

test('jalur cadangan filter hampir sama dengan ctx.filter asli', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Pembanding ctx.filter hanya ada di Chromium')
  const rows = page.getByTestId('fallback-table').locator('[data-fallback]')
  await expect(rows).toHaveCount(7)
  for (const max of await rows.evaluateAll((els) =>
    els.map((el) => Number(el.getAttribute('data-max'))),
  )) {
    expect(max).toBeLessThanOrEqual(4)
  }
})

test('foto upload diekspor dengan filter yang sama, juga tanpa ctx.filter', async ({ page }) => {
  await page
    .getByRole('radiogroup', { name: 'Filter foto' })
    .getByRole('radio', { name: 'Noir' })
    .click()
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 24
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgb(220, 40, 30)'
    ctx.fillRect(0, 0, 24, 24)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  await page.locator('input[type="file"]').setInputFiles({
    name: 'merah.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  })
  const result = page.getByAltText('Hasil foto dengan filter')
  await expect(result).toBeVisible()
  const [r = 0, g = 0, b = 0] = await result.evaluate(async (img: HTMLImageElement) => {
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return [...ctx.getImageData(12, 12, 1, 1).data]
  })
  // Noir = grayscale: merah jadi abu-abu.
  expect(Math.abs(r - g)).toBeLessThan(8)
  expect(Math.abs(g - b)).toBeLessThan(8)
})
