import { expect, test, type Page } from '@playwright/test'

const rotateY = async (page: Page) =>
  page.locator('.foil-rotor').evaluate((el) => {
    const match = /rotateY\((-?[\d.]+)deg\)/.exec((el as HTMLElement).style.transform)
    return match ? Number(match[1]) : 0
  })

/** Sudut rotateY kartu dan posisi pantulan cahaya foil (`--gx`), dibaca dari frame yang sama. */
const pose = async (page: Page) =>
  page.locator('.foil-rotor').evaluate((el) => {
    const style = (el as HTMLElement).style
    const match = /rotateY\((-?[\d.]+)deg\)/.exec(style.transform)
    return {
      angle: match ? Number(match[1]) : 0,
      glare: Number.parseFloat(style.getPropertyValue('--gx')) || 0,
    }
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

test('drag dengan jari memutar kartu, dan kilau foil ikut sudutnya', async ({
  page,
  browserName,
  hasTouch,
}) => {
  test.skip(browserName !== 'chromium' || !hasTouch, 'Sentuhan lewat CDP, khusus HP Chromium')
  const box = (await page.locator('.foil-rotor').boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: string, dx?: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: dx === undefined ? [] : [{ x: x + dx, y }],
    })
  await touch('touchStart', 0)
  for (let dx = 15; dx <= 120; dx += 15) {
    await touch('touchMove', dx)
    await page.waitForTimeout(16)
  }
  await expect.poll(async () => (await pose(page)).angle).toBeGreaterThan(20)
  // Pantulan cahaya bergeser searah putaran kartu.
  expect((await pose(page)).glare).toBeGreaterThan(10)
  for (let dx = 140; dx <= 380; dx += 20) {
    await touch('touchMove', dx)
    await page.waitForTimeout(16)
  }
  // Ditahan diam dulu: kartu tidak boleh terlempar saat jari diangkat.
  await page.waitForTimeout(150)
  await touch('touchEnd')
  await expect.poll(() => rotateY(page), { timeout: 8000 }).toBe(180)
  // Di sampul belakang pantulannya kembali ke tengah.
  expect(Math.abs((await pose(page)).glare)).toBeLessThan(1)
})

test('tap dan Enter membuka serta menutup kartu', async ({ page }) => {
  const card = page.getByRole('button', { name: /Kartu surat/ })
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.foil-spread')).toHaveClass(/is-open/)
  await card.press('Enter')
  await expect(card).toHaveAttribute('aria-pressed', 'false')
})

test('animasi buka dan tutup kartu selesai di bawah 600 ms', async ({ page }) => {
  // Lama transisi sampul depan (bukan transisi di dalamnya), sekali per buka atau tutup.
  const watch = () =>
    page.evaluate(() => {
      const leaf = document.querySelector('.foil-leaf--front')!
      const turned = new Promise<number>((resolve) => {
        leaf.addEventListener('transitionend', function done(event) {
          const transition = event as TransitionEvent
          if (transition.target !== leaf || transition.propertyName !== 'transform') return
          leaf.removeEventListener('transitionend', done)
          resolve(transition.elapsedTime * 1000)
        })
      })
      Object.assign(window, { turned })
    })
  const turned = () =>
    page.evaluate(() => (window as unknown as { turned: Promise<number> }).turned)
  const card = page.getByRole('button', { name: /Kartu surat/ })

  await watch()
  await card.click()
  const opening = await turned()
  await watch()
  await card.press('Enter')
  const closing = await turned()
  for (const ms of [opening, closing]) {
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThan(600)
  }
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
