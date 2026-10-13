import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Hari ini dibuat tetap supaya kalender dan judul bulan bisa dicek pasti.
const TODAY = '2026-10-10'

// Simpan kantong memproses foto di thread utama. WebKit di CI (tanpa GPU) kadang butuh lebih dari
// 5 detik sampai modalnya tertutup, jadi tunggu lebih lama dari batas bawaan expect.
const SAVE_TIMEOUT = 15_000

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 10, 10, 0))
})

/** Foto uji berwarna, dibuat di browser lalu dikirim sebagai JPEG. */
async function photos(page: Page, hues: number[]) {
  return Promise.all(
    hues.map(async (hue, i) => {
      const base64 = await page.evaluate((h) => {
        const canvas = document.createElement('canvas')
        canvas.width = 600
        canvas.height = 450
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = `hsl(${h} 70% 60%)`
        ctx.fillRect(0, 0, 600, 450)
        return canvas.toDataURL('image/jpeg').split(',')[1]!
      }, hue)
      return {
        name: `momen-${i}.jpg`,
        mimeType: 'image/jpeg',
        buffer: Buffer.from(base64, 'base64'),
      }
    }),
  )
}

/** Simpan satu hari lewat modal dengan desain bawaan dan foto-foto ini. */
async function saveDay(page: Page, day: string, hues: number[]) {
  await page.locator(`[data-day="${day}"]`).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.getByTestId('moment-upload').setInputFiles(await photos(page, hues))
  await expect(dialog.getByRole('button', { name: /^Hapus foto/ })).toHaveCount(hues.length)
  await dialog.getByRole('button', { name: 'Simpan kantong' }).click()
  await expect(dialog).toBeHidden({ timeout: SAVE_TIMEOUT })
}

/** Buka kantong hari ini dengan ketukan dan tunggu fotonya dijepit di tali. */
async function openPocket(page: Page) {
  await page.goto(`/pocket/${TODAY}`)
  await page.getByRole('button', { name: 'Buka kantong' }).click()
  await expect(page.getByTestId('pocket-day')).toHaveAttribute('data-torn', 'true')
}

// Penghitung ada di header (layar lebar) atau di kartu kalender (HP).
const savedCount = (page: Page) =>
  page.locator('[data-testid^="saved-count"]').filter({ visible: true })

test('kalender menandai hari ini, pindah bulan, dan lompat ke tahun lain', async ({ page }) => {
  await page.goto('/pocket')
  const label = page.getByTestId('month-label')
  await expect(label).toHaveText('Oktober 2026')
  await expect(page.locator(`[data-day="${TODAY}"]`)).toHaveAccessibleName(
    'Sabtu, 10 Oktober 2026, hari ini',
  )
  // Hari yang belum datang tidak bisa diisi.
  await expect(page.locator('[data-day="2026-10-11"]')).toHaveCount(0)
  await expect(savedCount(page)).toHaveText('0 hari tersimpan')

  await page.getByRole('button', { name: 'Bulan sebelumnya' }).click()
  await expect(label).toHaveText('September 2026')
  await expect(page.locator('[data-day="2026-09-30"]')).toBeVisible()
  await page.getByRole('button', { name: 'Bulan berikutnya' }).click()
  await expect(label).toHaveText('Oktober 2026')

  await page.getByRole('button', { name: 'Pilih bulan' }).click()
  await page.getByRole('button', { name: 'Tahun sebelumnya' }).click()
  await page.getByRole('button', { name: 'Februari 2025' }).click()
  await expect(label).toHaveText('Februari 2025')
  await expect(page.locator('[data-day="2025-02-28"]')).toBeVisible()
})

test('modal simpan hari: preview langsung berubah, sel dan penghitung langsung terisi, tetap ada setelah dimuat ulang', async ({
  page,
}) => {
  await page.goto('/pocket')
  await page.locator(`[data-day="${TODAY}"]`).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Simpan satu hari kecil' })).toBeVisible()
  await expect(dialog).toContainText('Sabtu, 10 Oktober 2026')

  const preview = page.getByTestId('packet-preview')
  const packet = preview.locator('.packet')
  const combo = page.getByTestId('combo-name')
  await expect(combo).toHaveText('Rasa blueberry, stiker hati')
  const blue = await packet.getAttribute('style')
  await dialog.getByRole('radio', { name: 'Pink' }).click()
  await expect(packet).not.toHaveAttribute('style', blue!)
  await dialog.getByRole('radio', { name: 'Bunga sakura' }).click()
  await expect(combo).toHaveText('Rasa stroberi, stiker bunga sakura')
  await expect(preview.locator('.packet__sticker').first()).toHaveAttribute(
    'href',
    '/stickers/cherry-blossom.webp',
  )
  // Nama kombinasi tidak tertimpa kantong, termasuk di layar HP yang sempit.
  const packetBox = (await packet.boundingBox())!
  const comboBox = (await combo.boundingBox())!
  const overlaps =
    comboBox.x < packetBox.x + packetBox.width &&
    packetBox.x < comboBox.x + comboBox.width &&
    comboBox.y < packetBox.y + packetBox.height &&
    packetBox.y < comboBox.y + comboBox.height
  expect(overlaps).toBe(false)

  // Foto pertama langsung menyelip di depan kantong, dengan bingkai pilihan.
  await page.getByTestId('moment-upload').setInputFiles(await photos(page, [20, 200]))
  await expect(dialog.getByRole('button', { name: /^Hapus foto/ })).toHaveCount(2)
  await expect(preview.locator('.photo-frame img')).toHaveAttribute('src', /^blob:/)
  await dialog.getByRole('radio', { name: 'Prangko' }).click()
  await expect(preview.locator('.photo-frame')).toHaveClass(/is-stamp/)
  // Pilihan bingkai menunjukkan foto pertama dalam tiap bingkai.
  await expect(dialog.getByRole('radio', { name: /Tiket bioskop/ }).locator('img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(dialog).toContainText('2 foto terselip')

  await dialog.getByRole('button', { name: 'Simpan kantong' }).click()
  await expect(dialog).toBeHidden({ timeout: SAVE_TIMEOUT })
  const cell = page.locator(`[data-day="${TODAY}"]`)
  await expect(cell).toHaveAttribute('data-saved', 'true')
  await expect(cell.locator('.packet')).toBeVisible()
  await expect(savedCount(page)).toHaveText('1 hari tersimpan')

  await page.reload()
  await expect(cell).toHaveAttribute('data-saved', 'true')
  await expect(savedCount(page)).toHaveText('1 hari tersimpan')
})

test('menutup modal dengan foto yang belum disimpan bertanya dulu', async ({ page }) => {
  await page.goto('/pocket')
  await page.locator(`[data-day="${TODAY}"]`).click()
  const dialog = page.getByRole('dialog')
  await page.getByTestId('moment-upload').setInputFiles(await photos(page, [20]))
  await expect(dialog.getByRole('button', { name: /^Hapus foto/ })).toHaveCount(1)

  page.once('dialog', (confirm) => confirm.dismiss())
  await dialog.getByRole('button', { name: 'Batal' }).click()
  await expect(dialog).toBeVisible()

  // Back di HP juga bertanya dulu, dan tidak meninggalkan Pocket.
  page.once('dialog', (confirm) => confirm.dismiss())
  await page.goBack()
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/pocket$/)

  page.once('dialog', (confirm) => confirm.accept())
  await page.goBack()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/pocket$/)
  await expect(page.locator(`[data-day="${TODAY}"]`)).not.toHaveAttribute('data-saved', 'true')
})

test('foto yang ditambah ke kantong kosong langsung bisa dikirim sebagai surat', async ({
  page,
}) => {
  // Kantong disimpan tanpa foto, lalu fotonya ditambah setelah kantong disobek.
  await page.goto('/pocket')
  await page.locator(`[data-day="${TODAY}"]`).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /^Simpan/ }).click()
  await expect(dialog).toBeHidden()

  await openPocket(page)
  await expect(page.getByTestId('pocket-no-photos')).toBeVisible()
  const send = page.getByRole('button', { name: 'Kirim sebagai surat' })
  await expect(send).toBeDisabled()
  await page.getByLabel('Tambah foto ke kantong').setInputFiles(await photos(page, [20]))
  await expect(page.getByTestId('line-photo')).toHaveCount(1)
  await expect(send).toBeEnabled()
})

test('buka kantong: disobek, foto dijepit di tali, foto yang di tengah dikirim sebagai surat', async ({
  page,
}) => {
  await page.goto('/pocket')
  await saveDay(page, TODAY, [20, 200, 300])
  await page.locator(`[data-day="${TODAY}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/pocket/${TODAY}$`))

  const day = page.getByTestId('pocket-day')
  await expect(day).toHaveAttribute('data-torn', 'false')
  await expect(page.getByText('Ketuk kantong, atau geser jari di')).toBeVisible()
  await page.getByRole('button', { name: 'Buka kantong' }).click()
  await expect(day).toHaveAttribute('data-torn', 'true')

  const line = page.getByTestId('photo-line')
  await expect(line.getByTestId('line-photo')).toHaveCount(3)
  await expect(line.getByTestId('line-photo').nth(1).locator('img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(line.getByTestId('line-count')).toHaveText('01 / 03')
  // Di HP pendek, tombol-tombolnya digulir sampai kelihatan setelah fotonya keluar.
  await expect(page.getByRole('button', { name: 'Kirim sebagai surat' })).toBeInViewport()

  // Tombol, keyboard, dan ketuk foto tetangga menggeser tali. Dua ketukan cepat pindah dua foto.
  const next = line.getByRole('button', { name: 'Foto berikutnya' })
  await next.click()
  await next.click()
  await expect(line).toHaveAttribute('data-index', '2')
  await line.getByRole('button', { name: 'Foto sebelumnya' }).click()
  await expect(line).toHaveAttribute('data-index', '1')
  await line.focus()
  await page.keyboard.press('End')
  await expect(line).toHaveAttribute('data-index', '2')
  await expect(line.getByRole('button', { name: 'Foto berikutnya' })).toBeDisabled()
  await page.keyboard.press('ArrowLeft')
  await expect(line).toHaveAttribute('data-index', '1')
  await expect(line.getByTestId('line-count')).toHaveText('02 / 03')

  await page.getByRole('button', { name: 'Kirim sebagai surat' }).click()
  await expect(page).toHaveURL(/\/letter\/new$/)
  await expect(page.getByTestId('letter-page').locator('[data-kind="photo"] img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(page.getByText('1 foto', { exact: true })).toBeVisible()
})

test('kantong bisa digores: sobekan mengikuti jari, berhenti di tengah, lalu dituntaskan', async ({
  page,
}) => {
  await page.goto('/pocket')
  await saveDay(page, TODAY, [20, 200])
  await page.goto(`/pocket/${TODAY}`)
  const packet = page.getByTestId('tearable-packet')
  const art = (await packet.locator('svg').boundingBox())!
  const unit = art.width / 200
  const at = (x: number, y: number) => [art.x + x * unit, art.y + y * unit] as const

  // Gores dari kanan ke tengah: sobek sebagian, kantong belum terbuka.
  await page.mouse.move(...at(190, 38))
  await page.mouse.down()
  for (let x = 180; x >= 90; x -= 10) await page.mouse.move(...at(x, 38 + (x % 20) / 4))
  await page.mouse.up()
  const progress = Number(await packet.getAttribute('data-progress'))
  expect(progress).toBeGreaterThan(0.4)
  expect(progress).toBeLessThan(0.7)
  await expect(page.getByTestId('pocket-day')).toHaveAttribute('data-torn', 'false')
  await expect(page.getByText('Geser terus sampai ujung')).toBeVisible()

  // Goresan berikutnya melanjutkan sobekan yang sama sampai ujung.
  await page.mouse.move(...at(95, 40))
  await page.mouse.down()
  for (let x = 85; x >= -10; x -= 12) await page.mouse.move(...at(x, 40))
  await page.mouse.up()
  await expect(page.getByTestId('pocket-day')).toHaveAttribute('data-torn', 'true')
  await expect(page.getByTestId('line-photo')).toHaveCount(2)
})

test('kantong juga bisa dibuka dengan keyboard', async ({ page }) => {
  await page.goto('/pocket')
  await saveDay(page, TODAY, [20])
  await page.goto(`/pocket/${TODAY}`)
  await page.getByRole('button', { name: 'Buka kantong' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('pocket-day')).toHaveAttribute('data-torn', 'true')
  await expect(page.getByRole('button', { name: 'Kantong sudah dibuka' })).toBeDisabled()
})

test('ganti desain: foto lama bisa dikeluarkan, kantong bisa dihapus, latarnya kabur', async ({
  page,
}) => {
  // Dua kali membuka modal desain dengan belasan langkah; WebKit di CI butuh lebih dari 30 detik.
  test.setTimeout(60_000)
  await page.goto('/pocket')
  await saveDay(page, TODAY, [20, 200])
  await openPocket(page)
  await page.getByRole('button', { name: 'Ganti desain kantong' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Ganti desain kantong' })).toBeVisible()
  // Latar di belakang modal kabur. Di tes otomatis dan browser tanpa GPU cukup diredupkan (lihat
  // plugins/render.client.ts); latar kaburnya dicek lewat screenshot.
  const scrim = await page
    .locator('.scrim')
    .first()
    .evaluate((el) => ({
      blur: getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter,
      software: document.documentElement.dataset.render === 'cpu',
    }))
  expect(scrim.blur).toContain(scrim.software ? 'none' : 'blur')

  await expect(dialog).toContainText('2 foto terselip')
  await dialog.getByRole('button', { name: 'Keluarkan foto 1 dari kantong' }).click()
  await expect(dialog).toContainText('1 foto terselip')
  // Yang dikeluarkan masih bisa dikembalikan sebelum disimpan.
  await dialog.getByRole('button', { name: 'Kembalikan foto 1 ke kantong' }).click()
  await expect(dialog).toContainText('2 foto terselip')
  await dialog.getByRole('button', { name: 'Keluarkan foto 1 dari kantong' }).click()
  await dialog.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('line-photo')).toHaveCount(1)

  // Hapus kantong ditanyakan di dalam modal, bukan dialog bawaan browser.
  await page.getByRole('button', { name: 'Ganti desain kantong' }).click()
  await dialog.getByRole('button', { name: 'Hapus kantong' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Hapus kantong ini beserta 1 fotonya?')
  await dialog.getByRole('button', { name: 'Hapus', exact: true }).click()
  await expect(page).toHaveURL(/\/pocket$/)
  await expect(page.locator(`[data-day="${TODAY}"]`)).not.toHaveAttribute('data-saved', 'true')
})

test('goresan jari yang berhenti di tengah dituntaskan dengan satu ketukan', async ({
  page,
  browserName,
  hasTouch,
}) => {
  test.skip(browserName !== 'chromium' || !hasTouch, 'Sentuhan lewat CDP, khusus HP Chromium')
  await page.goto('/pocket')
  await saveDay(page, TODAY, [20])
  await page.goto(`/pocket/${TODAY}`)
  const packet = page.getByTestId('tearable-packet')
  const art = (await packet.locator('svg').boundingBox())!
  const unit = art.width / 200
  const y = art.y + 38 * unit
  // Jari sungguhan: setelah seretan, browser tidak mengirim klik.
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: string, x?: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: x === undefined ? [] : [{ x, y }],
    })
  await touch('touchStart', art.x + 8 * unit)
  for (let x = 18; x <= 90; x += 8) {
    await touch('touchMove', art.x + x * unit)
    await page.waitForTimeout(16)
  }
  await touch('touchEnd')
  await expect(page.getByText('Geser terus sampai ujung')).toBeVisible()
  // Jari diangkat sebentar dulu: ketukan yang langsung menyusul goresan dipakai Chrome untuk
  // menghentikan sisa gerak goresannya, bukan untuk klik.
  await page.waitForTimeout(400)
  await page.touchscreen.tap(art.x + art.width / 2, art.y + art.height / 2)
  await expect(page.getByTestId('pocket-day')).toHaveAttribute('data-torn', 'true')
})

test('Back dari TV kembali ke kantong yang sudah terbuka, di foto yang sama', async ({ page }) => {
  await page.goto('/pocket')
  await saveDay(page, TODAY, [20, 200])
  await openPocket(page)
  const line = page.getByTestId('photo-line')
  await line.getByRole('button', { name: 'Foto berikutnya' }).click()
  await expect(line).toHaveAttribute('data-index', '1')
  await page.getByRole('link', { name: 'Putar di TV' }).click()
  await expect(page).toHaveURL(/\/tv\?hari=/)
  await page.goBack()
  await expect(page.getByTestId('pocket-day')).toHaveAttribute('data-torn', 'true')
  await expect(line).toHaveAttribute('data-index', '1')
  // Kunjungan baru dari kalender mulai tersegel lagi.
  await page.getByRole('link', { name: 'Kalender' }).click()
  await page.locator(`[data-day="${TODAY}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/pocket/${TODAY}$`))
  await expect(page.getByTestId('pocket-day')).toHaveAttribute('data-torn', 'false')
})

test('di layar lebar, foto yang muat semua tergantung di tengah tali', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1000, 'Khusus layar lebar')
  await page.goto('/pocket')
  await saveDay(page, TODAY, [20, 200, 300])
  await openPocket(page)
  const prints = page.getByTestId('line-photo')
  await expect(prints).toHaveCount(3)
  await page.waitForTimeout(2500)
  const first = (await prints.first().boundingBox())!
  const last = (await prints.last().boundingBox())!
  const middle = (first.x + last.x + last.width) / 2
  expect(Math.abs(middle - page.viewportSize()!.width / 2)).toBeLessThan(40)
})

test('putar di TV: isi kantong langsung diputar, foto baru masuk ke kantong yang sama', async ({
  page,
}) => {
  await page.goto('/pocket')
  await saveDay(page, TODAY, [20, 200])
  await openPocket(page)
  await page.getByRole('link', { name: 'Putar di TV' }).click()
  await expect(page).toHaveURL(new RegExp(`/tv\\?hari=${TODAY}$`))

  const slideshow = page.getByTestId('tv-slideshow')
  await expect(slideshow).toContainText('10 OKTOBER 2026')
  await expect(slideshow).toContainText('/2')

  // "+ Foto" di CD kantong menambah foto ke hari itu juga.
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Foto', exact: true }).click()
  await (await chooser).setFiles(await photos(page, [300]))
  await expect(slideshow).toContainText('/3')

  await openPocket(page)
  await expect(page.getByTestId('line-photo')).toHaveCount(3)
})

test('foto kenangan pertama meminta penyimpanan permanen, sekali saja', async ({ page }) => {
  // Penyimpanan permanen dipalsukan supaya bisa dihitung; browser sungguhan bisa menolaknya.
  // Dipasang di prototype karena WebKit bisa membuat ulang objek navigator.storage.
  await page.addInitScript(() => {
    const state = { granted: false, calls: 0 }
    Object.assign(window, { storageState: state })
    if (!('StorageManager' in window)) return
    StorageManager.prototype.persisted = async () => state.granted
    StorageManager.prototype.persist = async () => {
      state.calls++
      state.granted = true
      return true
    }
  })
  const calls = () =>
    page.evaluate(
      () => (window as unknown as { storageState: { calls: number } }).storageState.calls,
    )
  await page.goto('/pocket')
  test.skip(!(await page.evaluate(() => 'StorageManager' in window)), 'StorageManager tidak ada')
  await saveDay(page, TODAY, [20])
  await expect.poll(calls).toBe(1)

  await openPocket(page)
  await page.getByTestId('pocket-upload').setInputFiles(await photos(page, [200]))
  await expect(page.getByTestId('line-photo')).toHaveCount(2)
  // Tali bergeser ke foto yang baru ditambahkan.
  await expect(page.getByTestId('photo-line')).toHaveAttribute('data-index', '1')
  expect(await calls()).toBe(1)
})

test('latar Pocket sampai ke tepi layar dan kembali normal setelah pindah halaman', async ({
  page,
}) => {
  const themeColor = page.locator('meta[name="theme-color"]')
  await page.goto('/pocket')
  await expect(page.locator('[data-day]').first()).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/bg-pocket-page/)
  await expect(themeColor).toHaveAttribute('content', '#f1f4f8')

  await page.getByRole('link', { name: /PostPocket/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('html')).not.toHaveClass(/bg-pocket-page/)
  await expect(themeColor).toHaveAttribute('content', '#f1f4f8')
})

test('tanggal tanpa kantong menawarkan untuk membuatnya, tanggal yang belum datang ditolak', async ({
  page,
}) => {
  await page.goto('/pocket/2026-10-09')
  await expect(page.getByTestId('pocket-empty')).toBeVisible()
  await page.getByRole('button', { name: 'Buat kantong' }).click()
  await expect(page.getByRole('dialog')).toContainText('Jumat, 9 Oktober 2026')

  await page.goto('/pocket/2026-10-11')
  await expect(page).toHaveURL(/\/pocket$/)
  await expect(page.getByTestId('month-label')).toHaveText('Oktober 2026')
})

test('foto HEIC bisa dipilih dan tampil, juga di browser yang tidak membuka HEIC sendiri', async ({
  page,
}) => {
  // Foto HEIC asli 480×360. Chrome dan Firefox mengubahnya ke JPEG di Web Worker.
  const heic = readFileSync(new URL('./fixtures/foto.heic', import.meta.url))
  await page.goto('/pocket')
  await page.locator(`[data-day="${TODAY}"]`).click()
  const dialog = page.getByRole('dialog')
  await page
    .getByTestId('moment-upload')
    .setInputFiles({ name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: heic })
  const thumb = dialog.locator('img[src^="blob:"]').first()
  await expect
    .poll(() => thumb.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]), {
      timeout: 20_000,
    })
    .toEqual([480, 360])
  await dialog.getByRole('button', { name: 'Simpan kantong' }).click()
  await expect(dialog).toBeHidden({ timeout: SAVE_TIMEOUT })

  await openPocket(page)
  await expect(page.getByTestId('line-photo')).toHaveCount(1)
})
