import { expect, test } from '@playwright/test'

test('Beranda dibuka dengan contoh surat yang bisa dibuka, lalu Pocket dan Booth', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kenangan kecil')
  for (const name of [/Pocket/, /Booth/]) {
    await expect(page.getByRole('main').getByRole('link', { name })).toBeVisible()
  }
  const card = page.getByRole('button', { name: /Contoh surat/ })
  await expect(card).toHaveAttribute('aria-pressed', 'false')
  await card.press('Enter')
  await expect(card).toHaveAttribute('aria-pressed', 'true')
})

test('logo P-amplop di header bernama PostPocket dan kembali ke Beranda', async ({ page }) => {
  await page.goto('/privasi')
  const home = page.getByRole('banner').getByRole('link', { name: 'PostPocket', exact: true })
  await expect(home.getByRole('img', { name: 'PostPocket' })).toBeVisible()
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
  await home.click()
  await expect(page).toHaveURL(/\/$/)
  // Di Beranda, "beta" sejajar dengan garis dasar wordmark, bukan dengan tengah logo yang batangnya
  // menggantung di bawah.
  const logo = await page.getByRole('banner').getByRole('img', { name: 'PostPocket' }).boundingBox()
  const beta = await page.getByRole('banner').getByText('beta', { exact: true }).boundingBox()
  expect(beta!.y + beta!.height).toBeLessThan(logo!.y + logo!.height * 0.75)
})

test('Tulis surat membuka editor surat', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Tulis surat' }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
  await expect(page.getByRole('heading', { name: 'Surat foil' })).toBeVisible()
})

test('Surat, Pocket, dan Photo Booth bergerak sendiri dan menjawab pointer', async ({ page }) => {
  await page.goto('/')
  for (const id of ['surat', 'pocket', 'booth']) {
    const figure = page.getByTestId(`modul-${id}`).locator('[data-hairline]')
    await expect(figure).toHaveAttribute('role', 'img')
    await expect(figure.locator('svg path')).not.toHaveCount(0)
  }
  // Tanpa disentuh, "tangan" tak terlihatnya memutar figur: gambarnya berubah sendiri.
  const pocket = page.getByTestId('modul-pocket').locator('[data-hairline]')
  await pocket.scrollIntoViewIfNeeded()
  const drawing = () => pocket.evaluate((el) => el.querySelector('svg')!.innerHTML)
  const first = await drawing()
  await expect.poll(drawing, { timeout: 10_000 }).not.toBe(first)

  // Pointer di atas kantong pertama, lalu kantong ketiga: kantong itu yang membuka.
  const box = (await pocket.boundingBox())!
  const at = (x: number, y: number) =>
    page.mouse.move(box.x + (box.width * x) / 400, box.y + (box.height * y) / 320)
  await at(144, 120)
  await expect(pocket).toHaveAttribute('data-read', 'kantong 1')
  await at(254, 175)
  await expect(pocket).toHaveAttribute('data-read', 'kantong 3')
  await page.mouse.move(box.x + box.width / 2, box.y - 60)
  await expect(pocket).toHaveAttribute('data-read', 'rest')
})

test('tombol bertag memutar efek tekannya dulu, lalu pindah halaman', async ({ page }) => {
  // Seperti HP dengan GPU: animasi tidak dilewati (di tes otomatis biasanya dilewati).
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
    const original = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = function (param: number) {
      return param === 0x9246 || param === 0x1f01 ? 'Apple GPU' : original.call(this, param)
    }
  })
  // Jam halaman dihentikan, jadi efek tekannya bisa diperiksa sebelum 320 ms-nya lewat.
  await page.clock.install()
  await page.goto('/')
  const pocket = page.getByRole('link', { name: 'Buka Pocket' })
  await pocket.scrollIntoViewIfNeeded()
  await pocket.click()
  await expect(page.locator('.tag-button[data-pressed]')).toHaveCount(1)
  await expect(page).toHaveURL(/\/$/)
  await page.clock.runFor(400)
  await expect(page).toHaveURL(/\/pocket$/)
})

test('kerumunan di atas footer baru dimuat saat hampir terlihat', async ({ page }) => {
  const loaded: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/peeps/')) loaded.push(request.url())
  })
  await page.goto('/')
  await page.waitForTimeout(500)
  expect(loaded).toHaveLength(0)
  await page.getByRole('contentinfo').scrollIntoViewIfNeeded()
  await expect.poll(() => loaded.length).toBe(1)
  // Orang-orangnya tergambar di kanvas.
  const canvas = page.locator('canvas').last()
  await expect
    .poll(() =>
      canvas.evaluate((el: HTMLCanvasElement) => {
        const data = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data
        let ink = 0
        for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) ink++
        return ink
      }),
    )
    .toBeGreaterThan(1000)
})
