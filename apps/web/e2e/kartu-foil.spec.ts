import { expect, test, type Page } from '@playwright/test'

const rotateY = async (page: Page) =>
  page.locator('.foil-rotor').evaluate((el) => {
    const match = /rotateY\((-?[\d.]+)deg\)/.exec((el as HTMLElement).style.transform)
    return match ? Number(match[1]) : 0
  })

test.beforeEach(async ({ page }) => {
  await page.goto('/lab/foil')
  await expect(page.locator('.foil-rotor')).toBeVisible()
})

test('drag memutar kartu lalu berhenti di sampul belakang', async ({ page }) => {
  const box = (await page.locator('.foil-rotor').boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 120, y, { steps: 8 })
  // Gaya kartu ditulis di frame animasi berikutnya, jadi tunggu sebentar.
  await expect.poll(async () => Math.abs(await rotateY(page))).toBeGreaterThan(20)
  await page.mouse.move(x + 380, y, { steps: 12 })
  // Ditahan diam dulu: kartu tidak boleh terlempar saat dilepas.
  await page.waitForTimeout(150)
  await page.mouse.up()
  await expect.poll(() => rotateY(page), { timeout: 8000 }).toBe(180)
})

test('lemparan cepat memutar kartu lebih jauh', async ({ page }) => {
  const box = (await page.locator('.foil-rotor').boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  // Gerakan bertahap tiap 16 ms seperti event pointer 60 Hz, lalu langsung dilepas.
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(x + step * 35, y)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  // Berhenti di muka berikutnya (180 atau lebih), bukan kembali ke depan.
  await expect
    .poll(
      async () => {
        const angle = await rotateY(page)
        return angle !== 0 && angle % 180 === 0
      },
      { timeout: 8000 },
    )
    .toBe(true)
})

test('tap dan Enter membuka serta menutup kartu', async ({ page }) => {
  const card = page.getByRole('button', { name: /Kartu surat/ })
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.foil-spread')).toHaveClass(/is-open/)
  await card.press('Enter')
  await expect(card).toHaveAttribute('aria-pressed', 'false')
})

test('panah kanan membalik kartu ke belakang', async ({ page }) => {
  await page.getByRole('button', { name: /Kartu surat/ }).press('ArrowRight')
  await expect.poll(() => rotateY(page), { timeout: 8000 }).toBe(180)
})

test('ganti warna foil dan kertas langsung terlihat di kartu', async ({ page }) => {
  await page.getByRole('radio', { name: 'Holografik' }).click()
  await expect(page.getByRole('heading', { name: /Warna foil\s*Holografik/ })).toBeVisible()
  const metal = await page
    .locator('.foil-rotor')
    .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--metal'))
  expect(metal).toContain('#c7f1ff')
  await page.getByRole('radio', { name: 'Navy' }).click()
  const paper = await page
    .locator('.foil-rotor')
    .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--paper'))
  expect(paper).toBe('#1e2335')
})

test('uji performa menghasilkan angka fps', async ({ page }) => {
  await page.getByTestId('benchmark').click()
  const result = page.getByTestId('benchmark-result')
  await expect(result).toBeVisible({ timeout: 10_000 })
  const fps = Number(await result.locator('dd').first().innerText())
  expect(fps).toBeGreaterThan(0)
})
