import { expect, test, type Page } from '@playwright/test'

/** Foto uji berwarna, dibuat di browser lalu dikirim sebagai JPEG. */
async function photo(page: Page, hue: number): Promise<Buffer> {
  const base64 = await page.evaluate((h) => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 450
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = `hsl(${h} 70% 60%)`
    ctx.fillRect(0, 0, 600, 450)
    return canvas.toDataURL('image/jpeg').split(',')[1]!
  }, hue)
  return Buffer.from(base64, 'base64')
}

/** Tambah foto lewat tombol "+ Foto" album yang sedang di tengah rak. */
async function addPhotos(page: Page, hues: number[]) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Foto', exact: true }).click()
  await (
    await chooser
  ).setFiles(
    await Promise.all(
      hues.map(async (hue, i) => ({
        name: `foto-${i}.jpg`,
        mimeType: 'image/jpeg',
        buffer: await photo(page, hue),
      })),
    ),
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tv')
  await expect(page.getByTestId('tv-idle')).toContainText('NO SIGNAL')
})

test('ganti warna clay langsung mengubah badan TV tanpa memuat gambar', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.getByRole('radio', { name: 'Sage' }).click()
  await expect(page.locator('.tv')).toHaveAttribute('style', /--clay: #9db99b/)
  expect(requests.filter((url) => /\.(png|jpe?g|webp|svg)/.test(url))).toEqual([])
})

test('layar TV yang kosong diketuk membawa ke rak CD, dan ganti filter terlihat di layar', async ({
  page,
}) => {
  await expect(page.getByTestId('tv-idle')).toContainText('KETUK UNTUK PILIH CD')
  await page.getByTestId('tv-pick-cd').click()
  await expect(page.getByTestId('cd-shelf')).toBeFocused()
  await page.getByRole('radio', { name: 'Noir' }).click()
  await expect(page.getByTestId('tv-screen')).toContainText('FILTER NOIR')
})

test('Back di HP menutup Booth dan kembali ke TV', async ({ page }) => {
  await page.getByRole('button', { name: 'PHOTO BOOTH' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Booth')
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Memori TV')
  await expect(page).toHaveURL(/\/tv$/)
})

test('foto masuk album, CD diputar dengan filter, lalu dikeluarkan', async ({ page }) => {
  await addPhotos(page, [20, 200])
  await expect(page.getByTestId('cd-shelf').locator('[data-album^="bulan-"]')).toHaveCount(1)
  // CD kosong pertama jadi CD bulan ini (bukan dua CD yang isinya sama), dan rak memberi tahu
  // fotonya sudah masuk.
  await expect(page.locator('.cd-item.is-current')).toHaveAttribute('data-album', /^bulan-/)
  await expect(page.getByTestId('cd-notice')).toHaveText(/2 foto masuk ke /)
  await expect(page.getByTestId('cd-thumbs').locator('li')).toHaveCount(2)

  // "Masukkan CD": piringan keluar dari case, terbang ke slot, lalu TV menyala.
  await page.getByTestId('cd-insert').click()
  const slideshow = page.getByTestId('tv-slideshow')
  await expect(slideshow).toBeVisible()
  await expect(page.getByTestId('tv-slot')).toHaveAttribute('data-state', 'loaded')
  await expect(slideshow.locator('img')).toHaveAttribute('src', /^blob:/)
  await expect(slideshow).toContainText('/2')
  // Ketuk layar untuk foto berikutnya.
  const counter = page.getByTestId('tv-counter')
  const before = (await counter.textContent())!
  await page.getByTestId('tv-next').click()
  await expect(counter).not.toHaveText(before)
  // Rak CD memberi tahu bahwa album di tengah sedang diputar, bukan menyuruh memasukkannya lagi.
  await expect(page.getByTestId('cd-hint')).toContainText(/sedang diputar di TV/i)
  await page.getByRole('radio', { name: 'Noir' }).click()
  await expect(slideshow).toHaveAttribute('data-filter', 'noir')
  // Saat foto berganti ada dua gambar yang bersilang; yang baru selalu yang terakhir.
  await expect(slideshow.locator('img').last()).toHaveCSS('filter', /grayscale/)

  // Foto yang ditambahkan ke CD yang sedang diputar langsung tampil di TV.
  await addPhotos(page, [300])
  await expect(slideshow).toContainText('3/3')

  await page.getByRole('button', { name: 'KELUARKAN CD', exact: true }).click()
  await expect(page.getByTestId('tv-idle')).toBeVisible()
  await expect(page.getByTestId('tv-slot')).toHaveAttribute('data-state', 'idle')
  // Piringannya kembali ke case dalam keadaan terbuka, siap dimasukkan lagi.
  await expect(page.getByTestId('cd-shelf')).toHaveAttribute('data-open', 'true')
  await expect(page.getByTestId('cd-hint')).toContainText(/seret piringan ke TV/i)
})

test('piringan diseret ke TV mulai diputar; dilepas di luar TV kembali ke rak', async ({
  page,
}) => {
  await addPhotos(page, [60, 240])
  await expect(page.getByTestId('cd-notice')).toBeVisible()
  // Ketuk CD yang terpilih untuk membuka case-nya.
  await page.locator('.cd-item.is-current .cd-case').click()
  await expect(page.getByTestId('cd-shelf')).toHaveAttribute('data-open', 'true')
  const disc = page.getByTestId('cd-disc')

  /** Seret piringan ke titik `to` (belum dilepas). Tunggu dulu animasi case dan gulir selesai. */
  async function dragDisc(to: { x: number; y: number }) {
    const box = (await disc.boundingBox())!
    const from = { x: box.x + box.width * 0.75, y: box.y + box.height / 2 }
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(
        from.x + ((to.x - from.x) * i) / 12,
        from.y + ((to.y - from.y) * i) / 12,
      )
    }
    return from
  }

  // Dilepas di samping rak: tidak diputar, piringannya kembali.
  await page.waitForTimeout(600)
  const box = (await disc.boundingBox())!
  await dragDisc({ x: box.x + box.width * 0.75 + 60, y: box.y + box.height / 2 - 20 })
  await page.mouse.up()
  await expect(disc).toBeVisible()
  await expect(page.getByTestId('tv-idle')).toBeVisible()

  // Dilepas di atas TV: slot terbuka selama piringan di atasnya, lalu TV memutar albumnya.
  // Piringan di tengah layar, jadi bagian bawah TV kelihatan di atasnya, juga di HP.
  await disc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(600)
  const tv = (await page.locator('.tv').boundingBox())!
  await dragDisc({ x: tv.x + tv.width / 2, y: tv.y + tv.height - 40 })
  await expect(page.getByTestId('tv-slot')).toHaveAttribute('data-state', 'open')
  await page.mouse.up()
  await expect(page.getByTestId('tv-slideshow')).toBeVisible()
  await expect(page.getByTestId('tv-slot')).toHaveAttribute('data-state', 'loaded')
})

test('CD baru bisa dibuat dan diberi nama; CD kosong belum bisa diputar; rak bisa digeser keyboard', async ({
  page,
}) => {
  await addPhotos(page, [40])
  await expect(page.getByTestId('cd-notice')).toBeVisible()
  const shelf = page.getByTestId('cd-shelf')
  await expect(shelf.locator('.cd-item')).toHaveCount(1)

  // CD buatan sendiri langsung dipilih dan siap diberi nama.
  await page.getByRole('button', { name: 'CD baru' }).click()
  await expect(shelf.locator('.cd-item')).toHaveCount(2)
  await expect(shelf).toHaveAttribute('data-index', '1')
  await page.getByLabel('Nama album').fill('Liburan')
  await page.getByRole('button', { name: 'Simpan', exact: true }).click()
  await expect(page.locator('.cd-item.is-current .cd-case')).toHaveAccessibleName(/Liburan/)

  // CD kosong: Enter tidak memutar apa-apa, dan user diminta menambah foto dulu.
  await shelf.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('cd-notice')).toHaveText(/masih kosong/)
  await expect(page.getByTestId('tv-idle')).toBeVisible()

  // Panah pindah album, Spasi membuka case, Enter memasukkan CD.
  await page.keyboard.press('ArrowLeft')
  await expect(shelf).toHaveAttribute('data-index', '0')
  await page.keyboard.press(' ')
  await expect(shelf).toHaveAttribute('data-open', 'true')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('tv-slideshow')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('cd-shelf').locator('.cd-item')).toHaveCount(2)
})
