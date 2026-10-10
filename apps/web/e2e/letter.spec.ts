import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const rules: { paper: string; excludeFoil: string[] }[] = JSON.parse(
  readFileSync(new URL('../../../packages/presets/letter.json', import.meta.url), 'utf8'),
).surpriseRules

const editor = (page: Page) => page.getByTestId('letter-editor')
const frontMask = (page: Page) =>
  page.locator('.foil-face--front .foil-mask:not(.foil-mask--emboss)')

/** Foto uji dua warna (biar ada tepi), dibuat di browser lalu dikirim sebagai PNG. */
async function photoPng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 300
    canvas.height = 200
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgb(240, 200, 170)'
    ctx.fillRect(0, 0, 300, 200)
    ctx.fillStyle = 'rgb(30, 90, 160)'
    ctx.fillRect(0, 120, 300, 80)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  return Buffer.from(base64, 'base64')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/letter/new')
  await expect(page.locator('.foil-rotor')).toBeVisible()
})

test('langkah 1 sampai 4 langsung mengubah kartu', async ({ page }) => {
  await page.getByRole('radio', { name: 'Ranting' }).click()
  await expect(page.locator('.foil-art')).toHaveAttribute('src', /sprig/)

  await page
    .getByRole('radiogroup', { name: 'Bentuk kartu' })
    .getByRole('radio', { name: 'Square' })
    .click()
  await expect
    .poll(async () => {
      const box = await page.locator('.foil-rotor').boundingBox()
      return box ? Math.abs(box.width - box.height) < 2 : false
    })
    .toBe(true)

  await page.getByRole('radio', { name: 'Holografik' }).click()
  await expect(editor(page)).toHaveAttribute('data-foil', 'holo')
  await page
    .getByRole('radiogroup', { name: 'Kertas' })
    .getByRole('radio', { name: 'Navy' })
    .click()
  const paper = await page
    .locator('.foil-rotor')
    .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--paper'))
  expect(paper).toBe('#1e2335')
})

test('mode Detail, Bayangan, dan Satu warna membuat peta foil di browser', async ({ page }) => {
  const modes = page.getByRole('radiogroup', { name: 'Bagian yang jadi foil' })
  for (const label of ['Detail', 'Bayangan', 'Satu warna']) {
    await modes.getByRole('radio', { name: label }).click()
    await expect
      .poll(() =>
        frontMask(page).evaluate(
          (el) => (el as HTMLElement).style.maskImage || (el as HTMLElement).style.webkitMaskImage,
        ),
      )
      .toContain('blob:')
  }
})

test('Surprise me selalu menghasilkan kombinasi yang lolos aturan', async ({ page }) => {
  for (let i = 0; i < 8; i++) {
    await page.getByTestId('surprise').click()
    const paper = (await editor(page).getAttribute('data-paper'))!
    const foil = (await editor(page).getAttribute('data-foil'))!
    const excluded = rules.find((rule) => rule.paper === paper)?.excludeFoil ?? []
    expect(excluded).not.toContain(foil)
  }
})

test('foto upload jadi gambar depan dan tetap bisa dipilih lagi', async ({ page }) => {
  await page
    .getByTestId('front-upload')
    .setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: await photoPng(page) })
  await expect(editor(page)).toHaveAttribute('data-front', 'upload')
  await expect(page.locator('.foil-art')).toHaveAttribute('src', /^blob:/)
  const modes = page.getByRole('radiogroup', { name: 'Bagian yang jadi foil' })
  await expect(modes.getByRole('radio', { name: 'Sesuai desain' })).toBeDisabled()
  await expect(editor(page)).not.toHaveAttribute('data-mode', 'design')

  await page.getByRole('radio', { name: 'Malam berbintang' }).click()
  await expect(editor(page)).toHaveAttribute('data-front', 'night')
  await page.getByRole('radio', { name: 'Foto kamu' }).click()
  await expect(editor(page)).toHaveAttribute('data-front', 'upload')
})

test('file bukan gambar ditolak dengan pesan yang jelas', async ({ page }) => {
  await page
    .getByTestId('front-upload')
    .setInputFiles({ name: 'catatan.txt', mimeType: 'text/plain', buffer: Buffer.from('halo') })
  await expect(page.getByRole('alert')).toContainText('Pilih file gambar')
  await expect(editor(page)).not.toHaveAttribute('data-front', 'upload')
})

test('draf, termasuk foto, tetap ada setelah halaman dimuat ulang', async ({ page }) => {
  await page
    .getByRole('radiogroup', { name: 'Kertas' })
    .getByRole('radio', { name: 'Sage' })
    .click()
  await page.getByRole('radio', { name: 'Tembaga' }).click()
  await page.getByRole('textbox', { name: 'Isi surat' }).fill('Selamat ulang tahun!')
  await page
    .getByTestId('front-upload')
    .setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: await photoPng(page) })
  await expect(editor(page)).toHaveAttribute('data-front', 'upload')
  await page.waitForTimeout(700)

  await page.reload()
  await expect(editor(page)).toHaveAttribute('data-paper', 'sage')
  await expect(editor(page)).toHaveAttribute('data-foil', 'copper')
  await expect(editor(page)).toHaveAttribute('data-front', 'upload')
  await expect(page.locator('.foil-art')).toHaveAttribute('src', /^blob:/)
  await expect(page.getByRole('textbox', { name: 'Isi surat' })).toHaveValue('Selamat ulang tahun!')
})

test('Mulai dari awal mengembalikan draf bawaan', async ({ page }) => {
  await page
    .getByRole('radiogroup', { name: 'Kertas' })
    .getByRole('radio', { name: 'Navy' })
    .click()
  await expect(editor(page)).toHaveAttribute('data-paper', 'navy')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Mulai dari awal' }).click()
  await expect(editor(page)).toHaveAttribute('data-paper', 'white')
})

test('paste dan drop foto', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'DataTransfer buatan hanya didukung Chromium')
  const base64 = (await photoPng(page)).toString('base64')
  const send = (kind: 'paste' | 'drop') =>
    page.evaluate(
      ([data, type]) => {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
        const transfer = new DataTransfer()
        transfer.items.add(new File([bytes], 'tempel.png', { type: 'image/png' }))
        if (type === 'paste') {
          document.dispatchEvent(
            new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true }),
          )
        } else {
          document
            .querySelector('[data-testid="letter-editor"]')!
            .dispatchEvent(
              new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }),
            )
        }
      },
      [base64, kind] as const,
    )
  await send('paste')
  await expect(editor(page)).toHaveAttribute('data-front', 'upload')
  await page.getByRole('radio', { name: 'Ranting' }).click()
  await send('drop')
  await expect(editor(page)).toHaveAttribute('data-front', 'upload')
})
