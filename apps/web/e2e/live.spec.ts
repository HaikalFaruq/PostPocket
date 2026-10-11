import { expect, test, type Page } from '@playwright/test'
import { previewProblems } from './preview'

// Gerbang Sprint 2 ke backend asli. Hanya jalan kalau LIVE_BASE_URL diisi (lihat playwright.config.ts
// dan docs/frontend.md): kirim satu surat berfoto lewat Edge Function, buka dari "HP lain" tanpa
// login, periksa aturan preview WhatsApp, lalu hapus suratnya lagi.

/** Foto uji bergradasi, dibuat di browser lalu dikirim sebagai PNG. */
async function photoPng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 800, 600)
    gradient.addColorStop(0, '#f6b48f')
    gradient.addColorStop(1, '#5b7fc7')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 800, 600)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  return Buffer.from(base64, 'base64')
}

test('gerbang Sprint 2: surat terbuka di HP lain tanpa login dan preview-nya siap', async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120_000)
  const message = `Uji gerbang Sprint 2 ${new Date().toISOString()}`

  // Pengirim: teks dan satu foto isi, lalu Buat link ke backend asli.
  await page.goto('/letter/new')
  await expect(page.locator('.foil-rotor')).toBeVisible()
  await page.getByRole('textbox', { name: 'Isi surat' }).fill(message)
  await page
    .getByTestId('letter-editor')
    .getByRole('radiogroup', { name: 'Template isi surat' })
    .getByRole('radio', { name: '1 foto + teks' })
    .click()
  await page.getByTestId('open-content-editor').click()
  await page.getByTestId('content-photo-upload').setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: await photoPng(page),
  })
  await page
    .getByTestId('content-editor')
    .getByRole('button', { name: 'Selesai', exact: true })
    .click()
  await page.getByRole('button', { name: 'Buat link untuk dikirim' }).click()
  const dialog = page.getByTestId('send-letter')
  await expect(dialog).toHaveAttribute('data-state', 'done', { timeout: 60_000 })
  const url = await page.getByTestId('sent-url').inputValue()

  try {
    // Crawler WhatsApp: meta OG dari server, gambar OG publik, JPEG 1200×630 ≤ 300.000 byte.
    expect(await previewProblems(request, url)).toEqual([])

    // Penerima di HP lain: konteks baru tanpa cookie maupun IndexedDB pengirim.
    const other = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
    const reader = await other.newPage()
    const errors: string[] = []
    reader.on('pageerror', (error) => errors.push(error.message))
    reader.on('console', (entry) => entry.type() === 'error' && errors.push(entry.text()))
    const response = await reader.goto(url)
    expect(response?.status()).toBe(200)
    const card = reader.getByRole('button', { name: /Surat untukmu/ })
    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    const letterPage = reader.getByTestId('letter-page')
    await expect(letterPage).toContainText(message)
    // Foto isi datang dari Storage publik dan harus bisa dimuat (termasuk untuk kanvas).
    await expect
      .poll(() =>
        letterPage
          .locator('[data-kind="photo"] img')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0)
    expect(errors).toEqual([])
    await other.close()
  } finally {
    // Bersihkan: surat uji dihapus dari dialog pengirim, dan link-nya mati.
    page.once('dialog', (confirm) => confirm.accept())
    await page.getByRole('button', { name: 'Hapus surat ini' }).click()
    await expect(dialog).toHaveAttribute('data-state', 'deleted', { timeout: 30_000 })
  }
  expect((await request.get(url)).status()).toBe(404)
})
