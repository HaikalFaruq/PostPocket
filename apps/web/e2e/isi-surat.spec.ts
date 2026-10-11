import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const cardPage = (page: Page) => page.getByTestId('letter-page')
const editor = (page: Page) => page.getByTestId('content-editor')
const editorPage = (page: Page) => page.getByTestId('content-page')

/** Pilih template di langkah 5 (bukan di editor). */
async function chooseTemplate(page: Page, name: string) {
  await page
    .getByTestId('letter-editor')
    .getByRole('radiogroup', { name: 'Template isi surat' })
    .getByRole('radio', { name })
    .click()
}

async function openEditor(page: Page) {
  await page.getByTestId('open-content-editor').click()
  await expect(editor(page)).toBeVisible()
}

/** Foto uji bergradasi, dibuat di browser lalu dikirim sebagai PNG. */
async function photoPng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 300
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createLinearGradient(0, 0, 400, 300)
    gradient.addColorStop(0, '#f6b48f')
    gradient.addColorStop(1, '#5b7fc7')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 400, 300)
    return canvas.toDataURL('image/png').split(',')[1]!
  })
  return Buffer.from(base64, 'base64')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/letter/new')
  await expect(page.locator('.foil-rotor')).toBeVisible()
})

test('template di langkah 5 mengubah tata letak tanpa membuang teks', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Isi surat' }).fill('Halo dari kolase')
  await chooseTemplate(page, 'Kolase 4 foto')
  await expect(cardPage(page).locator('[data-kind="photo"]')).toHaveCount(4)
  await expect(cardPage(page).locator('[data-kind="text"]')).toHaveText('Halo dari kolase')

  // Slot foto kosong ikut hilang, teksnya tetap.
  await chooseTemplate(page, 'Teks saja')
  await expect(cardPage(page).locator('[data-kind="photo"]')).toHaveCount(0)
  await expect(cardPage(page).locator('[data-kind="text"]')).toHaveText('Halo dari kolase')
})

test('editor: stiker bisa ditambah, digeser, dan dihapus', async ({ page }) => {
  await openEditor(page)
  await editor(page).getByRole('button', { name: 'Stiker', exact: true }).click()
  await editor(page).getByRole('button', { name: 'Hati', exact: true }).click()
  const sticker = editorPage(page).locator('[data-kind="sticker"]')
  await expect(sticker).toHaveAttribute('aria-pressed', 'true')

  const before = await sticker.evaluate((el) => (el as HTMLElement).style.left)
  const box = (await sticker.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => sticker.evaluate((el) => (el as HTMLElement).style.left)).not.toBe(before)

  await editor(page).getByRole('button', { name: 'Hapus' }).click()
  await expect(sticker).toHaveCount(0)
})

test('editor: blok teks baru bisa diketik dan diatur', async ({ page }) => {
  await openEditor(page)
  await editor(page).getByRole('button', { name: 'Teks', exact: true }).click()
  const field = editor(page).getByRole('textbox', { name: 'Teks yang dipilih' })
  await expect(field).toBeFocused()
  await field.fill('P.S. kangen')
  const text = editorPage(page).getByRole('button', { name: 'Teks: P.S. kangen' })
  await expect(text).toBeVisible()

  const size = () => text.locator('p').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  const start = await size()
  await editor(page).getByRole('button', { name: 'Huruf lebih besar' }).click()
  await expect.poll(size).toBeGreaterThan(start)
  await editor(page).getByRole('radio', { name: 'Kiri' }).click()
  await expect(text.locator('p')).toHaveCSS('text-align', 'left')

  // Escape melepas pilihan, Escape berikutnya menutup editor dan fokus kembali ke tombolnya.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(editor(page)).toHaveCount(0)
  await expect(page.getByTestId('open-content-editor')).toBeFocused()
  await expect(cardPage(page).getByText('P.S. kangen')).toBeAttached()
})

test('foto HEIC tanpa tipe (seperti di Windows) tetap masuk ke isi surat', async ({ page }) => {
  const heic = readFileSync(new URL('./fixtures/foto.heic', import.meta.url))
  await chooseTemplate(page, '1 foto + teks')
  await openEditor(page)
  await page
    .getByTestId('content-photo-upload')
    .setInputFiles({ name: 'IMG_0002.HEIC', mimeType: 'application/octet-stream', buffer: heic })
  await expect(editorPage(page).locator('[data-kind="photo"] img')).toHaveAttribute(
    'src',
    /^blob:/,
    { timeout: 20_000 },
  )
  await expect(editor(page).getByRole('alert')).toHaveCount(0)
})

test('foto isi surat mengisi slot template dan tetap ada setelah dimuat ulang', async ({
  page,
}) => {
  await chooseTemplate(page, '1 foto + teks')
  await openEditor(page)
  await page
    .getByTestId('content-photo-upload')
    .setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: await photoPng(page) })
  await expect(editorPage(page).locator('[data-kind="photo"] img')).toHaveAttribute('src', /^blob:/)
  // Foto masuk ke slot template, bukan jadi foto kedua.
  await expect(editorPage(page).locator('[data-kind="photo"]')).toHaveCount(1)
  await editor(page).getByRole('button', { name: 'Selesai', exact: true }).click()
  await expect(page.getByText('1 foto', { exact: true })).toBeVisible()
  await page.waitForTimeout(700)

  await page.reload()
  await expect(cardPage(page).locator('[data-kind="photo"] img')).toHaveAttribute('src', /^blob:/)
  await expect(page.getByText('1 foto', { exact: true })).toBeVisible()
})
