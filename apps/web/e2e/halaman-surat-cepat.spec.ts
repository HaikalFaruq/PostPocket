import { expect, test, type APIRequestContext } from '@playwright/test'

// Halaman surat adalah halaman pertama yang dibuka penerima dari WhatsApp, sering lewat data
// seluler: gambar depan kartu (LCP) di-preload dari HTML, dan kartunya tidak melompat ukuran.

/** Surat bergambar ilustrasi "sprig" tanpa foto, langsung lewat API mock. */
async function sprigLetter(request: APIRequestContext): Promise<string> {
  const created = await (
    await request.post('/mock-api/letters', {
      data: {
        design: {
          illustration: 'sprig',
          shape: 'portrait',
          foilMode: 'design',
          foilBorder: false,
          foilColor: 'gold',
          paper: 'cream',
          template: 'text',
        },
        content: {
          version: 1,
          elements: [
            {
              kind: 'text',
              id: 't1',
              x: 0.5,
              y: 0.46,
              width: 0.82,
              rotation: 0,
              text: 'Halo dari halaman yang cepat',
              size: 0.075,
              align: 'left',
            },
          ],
        },
        cover: null,
        photos: [],
        og: { type: 'image/jpeg', width: 1200, height: 630, size: 3 },
        replyTo: null,
      },
    })
  ).json()
  await request.put(created.uploads.og.signedUrl, {
    headers: { 'content-type': 'image/jpeg' },
    data: Buffer.from('abc'),
  })
  const published = await (
    await request.post(`/mock-api/letters/${created.id}/publish`, {
      headers: { 'x-edit-token': created.editToken },
    })
  ).json()
  return published.slug
}

test('gambar depan kartu di-preload dari HTML halaman surat', async ({ request }) => {
  const slug = await sprigLetter(request)
  const html = await (await request.get(`/l/${slug}`)).text()
  expect(html).toMatch(
    /<link rel="preload" as="image" href="\/illustrations\/sprig\.svg" fetchpriority="high">/,
  )
  expect(html).toContain('href="/illustrations/sprig-foil.svg"')
})

test('kartu di halaman surat tidak melompat ukuran saat dimuat', async ({ page, request }) => {
  test.skip(
    test.info().project.name === 'iphone',
    'PerformanceObserver layout-shift hanya ada di Chromium',
  )
  const slug = await sprigLetter(request)
  // CPU diperlambat seperti HP kelas menengah; di sinilah kartu dulu sempat tampil 140 px.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => {
    const shifts: number[] = []
    Object.assign(window, { __shifts: shifts })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        shifts.push((entry as unknown as { value: number }).value)
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto(`/l/${slug}`)
  const card = page.getByRole('button', { name: /Surat untukmu/ })
  await expect(card).toBeVisible()
  await page.waitForTimeout(1000)
  const total = await page.evaluate(() =>
    (window as unknown as { __shifts: number[] }).__shifts.reduce((sum, value) => sum + value, 0),
  )
  expect(total).toBeLessThan(0.01)

  // Isi kartu tetap muncul begitu kartu dibuka.
  await card.click()
  await expect(page.getByTestId('letter-page')).toContainText('Halo dari halaman yang cepat')
})
