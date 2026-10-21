import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('Booth: hitung mundur, 4 jepretan jadi strip, lalu disimpan ke Pocket dan CD', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Kamera palsu hanya ada di Chromium')
  test.setTimeout(45_000)
  await page.goto('/tv?booth=1')
  await expect(page.getByTestId('booth-camera')).toBeVisible()
  // Judul halaman mengikuti Booth, bukan TV.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Booth')
  const record = page.getByTestId('booth-record')
  await expect(record).toBeEnabled({ timeout: 10_000 })
  await page.getByRole('radio', { name: 'Noir' }).click()
  // Pratinjau di pojok layar menunjukkan bentuk hasilnya sebelum merekam.
  const preview = page.getByTestId('booth-preview')
  await expect(preview).toHaveAttribute('data-layout', 'strip')
  await expect(preview.locator('.booth-preview__cell')).toHaveCount(4)
  await page.getByRole('radio', { name: 'Grid 2×2' }).click()
  await expect(preview).toHaveAttribute('data-layout', 'grid')
  await page.getByRole('radio', { name: 'Satu foto' }).click()
  await expect(preview.locator('.booth-preview__cell')).toHaveCount(1)
  await page.getByRole('radio', { name: 'Strip 1×4' }).click()
  await record.click()
  await expect(page.getByTestId('booth-countdown')).toHaveText('3')
  // Selama memotret, layar menunjukkan jepretan ke berapa, dan petak pratinjau terisi.
  await expect(page.getByTestId('booth-progress')).toContainText(/FOTO \d\/4/, { timeout: 10_000 })
  await expect(preview.locator('.booth-preview__cell.is-filled').first()).toBeVisible()

  const result = page.getByTestId('booth-result')
  await expect(result).toBeVisible({ timeout: 15_000 })
  const strip = page.getByTestId('booth-strip')
  await expect(strip).toHaveAttribute('src', /^blob:/)
  // Strip 1×4: tinggi jauh lebih besar dari lebar.
  const size = await strip.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ])
  expect(size[1]!).toBeGreaterThan(size[0]! * 2.5)

  await result.getByRole('button', { name: 'Simpan ke Pocket' }).click()
  await expect(result).toContainText('Tersimpan di kantong hari ini')
  await result.getByRole('button', { name: 'Masukkan ke CD' }).click()
  await expect(result).toContainText('Masuk ke CD Photo Booth')

  const download = page.waitForEvent('download')
  await result.getByRole('button', { name: 'Unduh gambar' }).click()
  expect((await download).suggestedFilename()).toMatch(/^postpocket-booth-\d{4}-\d{2}-\d{2}\.png$/)

  await result.getByRole('button', { name: 'Tutup' }).click()
  // Strip yang sudah disimpan lalu ditutup memunculkan dialog Traktir.
  const support = page.getByRole('dialog', { name: 'Traktir PostPocket' })
  await expect(support).toBeVisible()
  await support.getByRole('button', { name: 'Nanti saja' }).click()
  await expect(support).toBeHidden()
  await page.getByRole('button', { name: 'KELUAR' }).click()
  // Empat jepretan masuk album bulan ini dan CD Photo Booth, yang langsung terpilih di rak.
  await expect(page.getByTestId('cd-shelf').locator('.cd-case')).toHaveCount(2)
  await expect(page.locator('.cd-item.is-current .cd-case')).toHaveAccessibleName(/Photo Booth/)
  await expect(page.getByTestId('cd-thumbs').locator('li')).toHaveCount(4)
})

test('Booth tanpa izin kamera menawarkan foto dari galeri', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Di WebKit Playwright kamera tidak tersedia')
  await page.goto('/tv?booth=1')
  await expect(page.getByTestId('booth-denied')).toBeVisible({ timeout: 10_000 })
  // Petunjuknya tidak menyuruh menekan Rekam selagi kamera mati.
  await expect(page.getByTestId('tv-subtitle')).toHaveText(/kamera mati/i)
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3a7bd5'
    ctx.fillRect(0, 0, 640, 480)
    return canvas.toDataURL('image/jpeg').split(',')[1]!
  })
  await page.getByTestId('booth-upload').setInputFiles({
    name: 'galeri.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(base64, 'base64'),
  })
  await expect(page.getByTestId('booth-strip')).toHaveAttribute('src', /^blob:/)
})

test('izin kamera ditolak: pesannya jelas dan foto dari galeri jadi gantinya', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
      },
    })
  })
  await page.goto('/tv?booth=1')
  const denied = page.getByTestId('booth-denied')
  await expect(denied).toContainText('Izin kamera ditolak. Kamu tetap bisa pakai foto dari galeri.')
  await expect(page.getByTestId('tv-subtitle')).toHaveText(/kamera mati/i)
  await expect(page.getByTestId('booth-record')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ganti kamera' })).toBeDisabled()

  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3a7bd5'
    ctx.fillRect(0, 0, 640, 480)
    return canvas.toDataURL('image/jpeg').split(',')[1]!
  })
  const chooser = page.waitForEvent('filechooser')
  await denied.getByRole('button', { name: 'Pilih foto dari galeri' }).click()
  await (
    await chooser
  ).setFiles({ name: 'galeri.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') })
  await expect(page.getByTestId('booth-strip')).toHaveAttribute('src', /^blob:/)
})

test('Booth mulai dari kamera depan dan bisa ganti ke kamera belakang', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Kamera palsu hanya ada di Chromium')
  // Catat facingMode yang diminta setiap kali kamera dibuka.
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices
    const open = devices.getUserMedia.bind(devices)
    const asked: unknown[] = []
    Object.assign(window, { cameraFacing: asked })
    devices.getUserMedia = (constraints) => {
      asked.push((constraints?.video as MediaTrackConstraints | undefined)?.facingMode)
      return open(constraints)
    }
  })
  const facing = () =>
    page.evaluate(
      () => (window as unknown as { cameraFacing: unknown[] }).cameraFacing.slice(-1)[0],
    )
  await page.goto('/tv?booth=1')
  const record = page.getByTestId('booth-record')
  await expect(record).toBeEnabled({ timeout: 10_000 })
  expect(await facing()).toBe('user')
  // Kamera depan dicerminkan seperti cermin, kamera belakang tidak.
  const video = page.getByTestId('booth-camera').locator('video')
  await expect(video).toHaveClass(/-scale-x-100/)

  const flip = page.getByRole('button', { name: 'Ganti kamera' })
  await flip.click()
  await expect.poll(facing).toBe('environment')
  await expect(video).not.toHaveClass(/-scale-x-100/)
  await expect(record).toBeEnabled({ timeout: 10_000 })

  await flip.click()
  await expect.poll(facing).toBe('user')
  await expect(video).toHaveClass(/-scale-x-100/)
  await expect(record).toBeEnabled({ timeout: 10_000 })
})

test('strip yang diunduh memuat filter yang sama dengan layar', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Kamera palsu hanya ada di Chromium')
  test.setTimeout(45_000)
  await page.goto('/tv?booth=1')
  await page.getByRole('radio', { name: 'Satu foto' }).click()
  const record = page.getByTestId('booth-record')
  await expect(record).toBeEnabled({ timeout: 10_000 })
  await page.getByRole('radio', { name: 'Noir' }).click()

  // Di layar, gambar kamera yang berwarna dibuat hitam putih oleh filter Noir.
  const video = page.getByTestId('booth-camera').locator('video')
  await expect(video).toHaveCSS('filter', /grayscale\(1\)/)
  const cameraSpread = await video.evaluate((el: HTMLVideoElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 120
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(el, 0, 0, 160, 120)
    const { data } = ctx.getImageData(0, 0, 160, 120)
    let spread = 0
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!]
      spread = Math.max(spread, Math.max(r, g, b) - Math.min(r, g, b))
    }
    return spread
  })
  expect(cameraSpread).toBeGreaterThan(30)

  await record.click()
  const result = page.getByTestId('booth-result')
  await expect(result).toBeVisible({ timeout: 10_000 })
  const download = page.waitForEvent('download')
  await result.getByRole('button', { name: 'Unduh gambar' }).click()
  const png = readFileSync(await (await download).path()).toString('base64')
  // Satu foto: jepretannya di (40, 40) berukuran 960×720 (stripGeometry), dan harus abu-abu.
  const stripSpread = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(40, 40, 960, 720)
    let spread = 0
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!]
      spread = Math.max(spread, Math.max(r, g, b) - Math.min(r, g, b))
    }
    return spread
  }, png)
  expect(stripSpread).toBeLessThanOrEqual(2)
})

test('Pakai di surat membawa strip ke editor surat', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Kamera palsu hanya ada di Chromium')
  test.setTimeout(45_000)
  await page.goto('/tv?booth=1')
  await page.getByRole('radio', { name: 'Satu foto' }).click()
  const record = page.getByTestId('booth-record')
  await expect(record).toBeEnabled({ timeout: 10_000 })
  await record.click()
  await expect(page.getByTestId('booth-result')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Pakai di surat' }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
  await expect(page.getByTestId('letter-page').locator('[data-kind="photo"] img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(page.getByText('1 foto', { exact: true })).toBeVisible()
})

test('strip yang belum disimpan tidak dibuang tanpa bertanya', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Kamera palsu hanya ada di Chromium')
  test.setTimeout(45_000)
  await page.goto('/tv?booth=1')
  await page.getByRole('radio', { name: 'Satu foto' }).click()
  const record = page.getByTestId('booth-record')
  await expect(record).toBeEnabled({ timeout: 10_000 })
  await record.click()
  const result = page.getByTestId('booth-result')
  await expect(result).toBeVisible({ timeout: 10_000 })
  // Fokus mulai di tombol utama dan tidak keluar dari lembar ini.
  await expect(result.getByRole('button', { name: 'Simpan ke Pocket hari ini' })).toBeFocused()
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
  expect(await result.evaluate((el) => el.contains(document.activeElement))).toBe(true)

  let asked = ''
  page.once('dialog', (dialog) => {
    asked = dialog.message()
    dialog.dismiss()
  })
  await result.getByRole('button', { name: 'Ulangi' }).click()
  expect(asked).toContain('belum disimpan')
  await expect(result).toBeVisible()

  // Back di HP juga bertanya dulu, dan tidak meninggalkan TV.
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.goBack()
  await expect(result).toBeVisible()
  await expect(page).toHaveURL(/\/tv\?booth=1$/)

  // Setelah disimpan, menutup tidak bertanya lagi.
  await result.getByRole('button', { name: /Simpan ke Pocket/ }).click()
  await expect(result).toContainText('Tersimpan di kantong hari ini')
  await result.getByRole('button', { name: 'Tutup' }).click()
  await expect(result).toBeHidden()
})
