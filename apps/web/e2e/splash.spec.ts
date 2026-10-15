import { expect, test } from '@playwright/test'

// Splash di awal sesi (AppSplash, app/utils/splash.ts). Tes lain melewatinya karena
// navigator.webdriver; di sini nilainya ditimpa, jadi splash-nya benar-benar diputar.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
  })
})

test('splash diputar sekali di awal sesi, lalu Beranda terlihat utuh', async ({ page }) => {
  await page.goto('/')
  const splash = page.getByTestId('splash')
  await expect(splash).toBeVisible()
  // Tanda tangan sepuluh huruf: garisnya ditulis sekali, lalu dipakai untuk goresan, topeng, dan isi.
  await expect(splash.locator('.signature defs > path')).toHaveCount(10)
  await expect(splash.locator('.signature use')).toHaveCount(30)
  await expect(splash).toHaveCount(0, { timeout: 8000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Sesi yang sama: tanpa splash, dan halamannya tetap terlihat (bukan ikut disembunyikan).
  await page.reload()
  await expect(page.getByTestId('splash')).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('img', { name: 'PostPocket' })).toBeVisible()
})

test('ketukan melewati splash', async ({ page }) => {
  await page.goto('/')
  const splash = page.getByTestId('splash')
  await expect(splash).toBeVisible()
  // Tunggu halaman siap dipakai: figur Hairline baru menggambar setelah hidrasi.
  await expect(page.locator('[data-hairline] svg').first()).toBeAttached()
  await splash.click()
  await expect(splash).toHaveCount(0, { timeout: 1500 })
})

test('mengetuk splash di atas tautan tidak ikut membuka tautannya', async ({ page }) => {
  await page.goto('/')
  const splash = page.getByTestId('splash')
  await expect(splash).toBeVisible()
  await expect(page.locator('[data-hairline] svg').first()).toBeAttached()
  // Ketuk tepat di atas tautan "Kotak surat" di header, yang tertutup splash.
  const link = page.getByRole('banner').getByRole('link', { name: 'Kotak surat' })
  const box = (await link.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(splash).toHaveCount(0, { timeout: 1500 })
  await expect(page).toHaveURL(/\/$/)
})

test('surat dari link dibuka tanpa splash', async ({ page }) => {
  await page.goto('/l/x7Kp2qLm9A')
  await expect(page.getByTestId('splash')).toHaveCount(0)
})

test('dengan gerakan dikurangi, splash dilewati dan halaman langsung terlihat', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('splash')).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
