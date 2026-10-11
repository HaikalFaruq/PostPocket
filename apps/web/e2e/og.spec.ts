import { expect, test } from '@playwright/test'

test('Beranda memakai gambar OG absolut, dan gambar OG bawaan surat tersedia', async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto('/')
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${baseURL}/og-beranda.jpg`,
  )
  for (const file of ['/og-beranda.jpg', '/og-surat.jpg']) {
    const response = await request.get(file)
    expect(response.headers()['content-type'], file).toBe('image/jpeg')
    // WhatsApp tidak menampilkan gambar OG yang lebih dari sekitar 300 KB.
    expect((await response.body()).length, file).toBeLessThanOrEqual(300_000)
    const size = await page.evaluate(async (src) => {
      const image = new Image()
      image.src = src
      await image.decode()
      return [image.naturalWidth, image.naturalHeight]
    }, file)
    expect(size, file).toEqual([1200, 630])
  }
})
