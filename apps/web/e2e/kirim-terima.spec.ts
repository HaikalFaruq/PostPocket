import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// Alur kirim dan buka surat lewat mock API (server/routes/mock-api).

async function sendFromEditor(page: Page, message: string): Promise<string> {
  await page.goto('/letter/new')
  await expect(page.locator('.foil-rotor')).toBeVisible()
  await page.getByRole('textbox', { name: 'Isi surat' }).fill(message)
  await page.getByRole('button', { name: 'Buat link untuk dikirim' }).click()
  const dialog = page.getByTestId('send-letter')
  await expect(dialog).toHaveAttribute('data-state', 'done', { timeout: 20_000 })
  const url = await page.getByTestId('sent-url').inputValue()
  expect(url).toMatch(/\/l\/[A-Za-z0-9]{10}$/)
  return url
}

const slugOf = (url: string) => url.split('/l/')[1]!

test('surat dikirim, dibuka penerima, lalu dibalas', async ({ page, browser, request }) => {
  const url = await sendFromEditor(page, 'Halo dari E2E')
  const slug = slugOf(url)

  const response = await page.goto(url)
  expect(response?.status()).toBe(200)
  expect(response?.headers()['x-robots-tag']).toBe('noindex')
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(ogImage).toMatch(/^http.*\/mock-api\/assets\/.+\.jpg$/)

  // Pengirim melihat pratinjau di browsernya sendiri: tidak menandai surat dibuka.
  const openedAt = async () => (await (await request.get(`/mock-api/l/${slug}`)).json()).openedAt
  await expect(page.getByTestId('own-letter-note')).toContainText('pratinjau suratmu')
  const ownCard = page.getByRole('button', { name: /Surat untukmu/ })
  await ownCard.click()
  await expect(ownCard).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Baca lebih besar' })).toBeVisible()
  await expect(page.getByTestId('reply')).toHaveCount(0)
  await page.waitForTimeout(500)
  expect(await openedAt()).toBeNull()

  // Penerima di HP lain, tanpa data pengirim. Membaca halaman belum menandai surat dibuka;
  // ketukan pertama yang menandai.
  const recipient = await (await browser.newContext()).newPage()
  expect((await recipient.goto(url))?.status()).toBe(200)
  await expect(recipient.getByTestId('own-letter-note')).toHaveCount(0)
  expect(await openedAt()).toBeNull()
  const card = recipient.getByRole('button', { name: /Surat untukmu/ })
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await expect(recipient.getByTestId('letter-page')).toContainText('Halo dari E2E')
  // Halaman surat juga bisa dibaca selebar layar, karena di dalam kartu tulisannya kecil di HP.
  await recipient.getByRole('button', { name: 'Baca lebih besar' }).click()
  const reader = recipient.getByTestId('letter-reader')
  await expect(reader).toContainText('Halo dari E2E')
  await reader.getByRole('button', { name: 'Tutup' }).click()
  await expect(reader).toBeHidden()
  await expect.poll(openedAt).not.toBeNull()

  await recipient.getByTestId('reply').click()
  await expect(recipient.getByTestId('reply-banner')).toBeVisible()
  await expect(recipient).toHaveURL(/\/letter\/new$/)
  const replyUrl = await sendFromEditorFromHere(recipient)
  const reply = await (await request.get(`/mock-api/l/${slugOf(replyUrl)}`)).json()
  expect(reply.replyTo).toBe(slug)
  await recipient.context().close()
})

test('tombol Back menutup tampilan baca, bukan meninggalkan surat', async ({ page, browser }) => {
  const url = await sendFromEditor(page, 'Surat untuk dibaca')
  const home = new URL('/', url).href
  const recipient = await (await browser.newContext()).newPage()
  await recipient.goto(home)
  await recipient.goto(url)
  await recipient.getByRole('button', { name: /Surat untukmu/ }).click()
  const open = recipient.getByRole('button', { name: 'Baca lebih besar' })
  const reader = recipient.getByTestId('letter-reader')

  await open.click()
  await expect(reader).toBeVisible()
  await recipient.goBack()
  await expect(reader).toBeHidden()
  await expect(recipient).toHaveURL(url)

  // Ditutup lewat tombol Tutup: Back berikutnya langsung kembali ke halaman sebelumnya.
  await open.click()
  await reader.getByRole('button', { name: 'Tutup' }).click()
  await expect(reader).toBeHidden()
  await recipient.goBack()
  await expect(recipient).toHaveURL(home)
  await recipient.context().close()
})

/** Kirim draf yang sedang terbuka tanpa memuat ulang halaman. */
async function sendFromEditorFromHere(page: Page): Promise<string> {
  await page.getByRole('textbox', { name: 'Isi surat' }).fill('Balasanku')
  await page.getByRole('button', { name: 'Buat link untuk dikirim' }).click()
  await expect(page.getByTestId('send-letter')).toHaveAttribute('data-state', 'done', {
    timeout: 20_000,
  })
  return page.getByTestId('sent-url').inputValue()
}

test('pengirim bisa menghapus surat dari dialog', async ({ page }) => {
  const url = await sendFromEditor(page, 'Salah kirim')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Hapus surat ini' }).click()
  await expect(page.getByTestId('send-letter')).toHaveAttribute('data-state', 'deleted')
  const response = await page.goto(url)
  expect(response?.status()).toBe(404)
  await expect(page.getByTestId('letter-missing')).toContainText('sudah tidak tersedia')
})

/** Surat dengan cover dan satu foto isi, langsung lewat API mock. */
async function letterWithPhotos(request: APIRequestContext): Promise<string> {
  const meta = { type: 'image/jpeg', width: 400, height: 300, size: 3 }
  const created = await (
    await request.post('/mock-api/letters', {
      data: {
        design: {
          illustration: 'upload',
          shape: 'portrait',
          foilMode: 'detail',
          foilBorder: true,
          foilColor: 'gold',
          paper: 'cream',
          template: 'photo-1',
        },
        content: {
          version: 1,
          elements: [
            {
              kind: 'photo',
              id: 'p1',
              x: 0.5,
              y: 0.35,
              width: 0.74,
              rotation: -2,
              photo: 'f1',
              aspect: 1.25,
            },
          ],
        },
        cover: meta,
        photos: [{ key: 'f1', ...meta }],
        og: { type: 'image/jpeg', width: 1200, height: 630, size: 3 },
        replyTo: null,
      },
    })
  ).json()
  for (const target of [created.uploads.cover, created.uploads.photos.f1, created.uploads.og]) {
    await request.put(target.signedUrl, {
      headers: { 'content-type': 'image/jpeg' },
      data: Buffer.from('abc'),
    })
  }
  const published = await (
    await request.post(`/mock-api/letters/${created.id}/publish`, {
      headers: { 'x-edit-token': created.editToken },
    })
  ).json()
  return published.slug
}

test('foto yang sudah dihapus jadi placeholder, sampul polos, dan OG bawaan', async ({
  page,
  request,
  baseURL,
}) => {
  const slug = await letterWithPhotos(request)
  await request.post(`/mock-api/_test/l/${slug}/hapus-foto`)

  await page.goto(`/l/${slug}`)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${baseURL}/og-surat.jpg`,
  )
  await expect(page.locator('.foil-rotor')).toBeVisible()
  await expect(page.locator('.foil-art')).toHaveCount(0)
  await page.getByRole('button', { name: /Surat untukmu/ }).click()
  await expect(page.getByTestId('letter-page')).toContainText('Foto sudah dihapus')
  await expect(page.getByTestId('received-page')).toContainText('Foto di dalamnya sudah dihapus')
})

test('slug yang tidak ada mendapat 404 dengan pesan yang jelas', async ({ page }) => {
  const response = await page.goto('/l/AAAAAAAAAA')
  expect(response?.status()).toBe(404)
  await expect(page.getByTestId('letter-missing')).toContainText('sudah tidak tersedia')
  await expect(page.getByRole('link', { name: 'Bikin surat sendiri' })).toHaveAttribute(
    'href',
    '/letter/new',
  )
})
