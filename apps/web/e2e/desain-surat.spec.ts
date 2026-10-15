import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'

const illustrations: { id: string; hidden?: boolean }[] = JSON.parse(
  readFileSync(new URL('../../../packages/presets/letter.json', import.meta.url), 'utf8'),
).illustrations

const editor = (page: Page) => page.getByTestId('letter-editor')
const frontMask = (page: Page) =>
  page.locator('.foil-face--front .foil-mask:not(.foil-mask--emboss)')
const cardPage = (page: Page) => page.getByTestId('letter-page')
const editorPage = (page: Page) => page.getByTestId('content-page')

async function chooseShape(page: Page, name: string) {
  await page.getByRole('radiogroup', { name: 'Bentuk kartu' }).getByRole('radio', { name }).click()
}

async function chooseFront(page: Page, name: string) {
  await page.getByRole('radiogroup', { name: 'Gambar depan' }).getByRole('radio', { name }).click()
}

async function chooseTemplate(page: Page, name: string) {
  await editor(page)
    .getByRole('radiogroup', { name: 'Template isi surat' })
    .getByRole('radio', { name })
    .click()
}

/** Foto uji bergradasi berukuran `width` × `height`, dibuat di browser lalu dikirim sebagai PNG. */
async function photoPng(page: Page, width: number, height: number): Promise<Buffer> {
  const base64 = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement('canvas')
      canvas.width = w!
      canvas.height = h!
      const ctx = canvas.getContext('2d')!
      const gradient = ctx.createLinearGradient(0, 0, w!, h!)
      gradient.addColorStop(0, '#f6b48f')
      gradient.addColorStop(1, '#5b7fc7')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w!, h!)
      return canvas.toDataURL('image/png').split(',')[1]!
    },
    [width, height],
  )
  return Buffer.from(base64, 'base64')
}

/** Tunggu dua frame, supaya perubahan gaya sudah tergambar. */
async function nextFrame(page: Page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
}

/** Kotak di layar beberapa elemen sekaligus. */
async function boxes(locator: Locator) {
  return locator.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    }),
  )
}

type Box = Awaited<ReturnType<typeof boxes>>[number]
const overlaps = (a: Box, b: Box) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
const inside = (inner: Box, outer: Box) =>
  inner.left >= outer.left - 0.5 &&
  inner.right <= outer.right + 0.5 &&
  inner.top >= outer.top - 0.5 &&
  inner.bottom <= outer.bottom + 0.5

/**
 * Tulisan dan foto di `page` tidak saling menimpa dan semuanya di dalam halaman. Semua kotak
 * diukur sekaligus, dan diulang sampai lolos: halaman editor ikut berubah ukuran saat panel alat
 * muncul atau hilang, dan kartu sedang membuka.
 */
async function expectTidy(page: Locator) {
  await expect(async () => {
    const { sheet, texts, photos } = await page.evaluate((root) => {
      const box = (el: Element) => {
        const rect = el.getBoundingClientRect()
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
      }
      return {
        sheet: box(root),
        texts: [...root.querySelectorAll('[data-kind="text"] p')].map(box),
        photos: [...root.querySelectorAll('[data-kind="photo"] .letter-photo')].map(box),
      }
    })
    for (const box of [...texts, ...photos]) expect(inside(box, sheet)).toBe(true)
    for (const text of texts) for (const photo of photos) expect(overlaps(text, photo)).toBe(false)
    for (let i = 0; i < photos.length; i++) {
      for (let j = i + 1; j < photos.length; j++) {
        expect(overlaps(photos[i]!, photos[j]!)).toBe(false)
      }
    }
  }).toPass({ timeout: 5_000 })
}

const longMessage =
  'Halo Rara,\nSelamat ulang tahun ya! Semoga tahun ini penuh hal baik, sehat terus, dan semua rencanamu jalan. Makasih udah jadi teman yang selalu ada, dari zaman kita masih sering telat masuk kelas sampai sekarang sibuk kerja. Aku masih ingat waktu kita nyasar pas liburan ke Bandung dan malah nemu warung kopi paling enak. Nanti kita ulang lagi ya. Jangan lupa istirahat, jangan terlalu keras sama diri sendiri. Kamu hebat banget, beneran. Peluk jauh dari aku, sampai ketemu bulan depan!\nSalam sayang,\nDinda'

test.beforeEach(async ({ page }) => {
  await page.goto('/letter/new')
  await expect(page.locator('.foil-rotor')).toBeVisible()
})

test('sampul dan thumbnail memakai komposisi untuk bentuk kartu yang dipilih', async ({ page }) => {
  await chooseFront(page, 'Malam berbintang')
  for (const [shape, file] of [
    ['Mendatar', 'night-landscape'],
    ['Persegi', 'night-square'],
    ['Tegak', 'night-portrait'],
    ['Asli', 'night'],
  ] as const) {
    await chooseShape(page, shape)
    await expect(page.locator('.foil-art')).toHaveAttribute('src', `/illustrations/${file}.svg`)
    await expect
      .poll(() =>
        frontMask(page).evaluate(
          (el) => (el as HTMLElement).style.maskImage || (el as HTMLElement).style.webkitMaskImage,
        ),
      )
      .toContain(`/illustrations/${file}-foil.svg`)
  }

  // Thumbnail gambar depan ikut berbentuk kartu Mendatar (4:3).
  await chooseShape(page, 'Mendatar')
  const tile = await page
    .getByRole('radiogroup', { name: 'Gambar depan' })
    .getByRole('radio', { name: 'Ranting' })
    .boundingBox()
  expect(tile!.width / tile!.height).toBeCloseTo(4 / 3, 1)
})

test('desain baru Ulang tahun dan Lebaran: dipilih di editor setelah server mengenalinya', async ({
  page,
}) => {
  const picker = page.getByRole('radiogroup', { name: 'Gambar depan' })
  for (const [label, id] of [
    ['Ulang tahun', 'birthday'],
    ['Lebaran', 'lebaran'],
  ] as const) {
    // `hidden` di preset: belum ditawarkan selama fungsi letters belum di-deploy ulang.
    if (illustrations.find((item) => item.id === id)?.hidden) {
      await expect(picker.getByRole('radio', { name: label })).toHaveCount(0)
      continue
    }
    await chooseFront(page, label)
    await expect(editor(page)).toHaveAttribute('data-front', id)
    await expect(page.locator('.foil-art')).toHaveAttribute('src', `/illustrations/${id}.svg`)
  }
})

test('ikon info di samping Unggah foto memberi saran ukuran sesuai bentuk', async ({
  page,
  isMobile,
}) => {
  const info = page.getByTestId('photo-size-info')
  const hint = page.getByTestId('photo-size-hint')
  await chooseShape(page, 'Mendatar')
  if (isMobile) {
    // Layar sentuh: diketuk untuk membuka, diketuk lagi untuk menutup.
    await info.tap()
    await expect(hint).toContainText('2048 × 1536 px')
    await expect(hint).toContainText('rasio 4:3')
    await info.tap()
    await expect(hint).toBeHidden()
  } else {
    // Mouse: muncul selama ikonnya disorot.
    await info.hover()
    await expect(hint).toContainText('2048 × 1536 px')
    await expect(hint).toContainText('rasio 4:3')
    await page.mouse.move(0, 0)
    await expect(hint).toBeHidden()
  }

  await chooseShape(page, 'Asli')
  await (isMobile ? info.tap() : info.hover())
  await expect(hint).toContainText('Bentuk Asli mengikuti fotomu')
})

test('bingkai foil hanya garis di tepi kartu, tidak menutupi gambarnya', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Screenshot WebKit tidak menggambar kartu CSS 3D')
  await chooseFront(page, 'Ranting')
  await chooseShape(page, 'Mendatar')
  const face = page.locator('.foil-face--front')
  // Gambar Mendatar dan lapisan foilnya (mask CSS) sudah termuat sebelum dibandingkan.
  await expect
    .poll(() =>
      page
        .locator('.foil-art')
        .evaluate(
          (img: HTMLImageElement) =>
            img.complete &&
            img.naturalWidth > 0 &&
            img.currentSrc.endsWith('/illustrations/sprig-landscape.svg'),
        ),
    )
    .toBe(true)
  await page.waitForLoadState('networkidle')
  await nextFrame(page)
  const before = await face.screenshot({ animations: 'disabled' })
  await page.getByLabel('Bingkai foil di tepi').check()
  await expect(page.locator('.foil-border')).toBeVisible()
  await nextFrame(page)
  const after = await face.screenshot({ animations: 'disabled' })

  // Bagian piksel yang berubah: di tengah kartu (harus tetap) dan di pita tepinya (harus jadi foil).
  const changed = await page.evaluate(
    async ([a, b]) => {
      const load = async (base64: string) => {
        const image = new Image()
        image.src = `data:image/png;base64,${base64}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(image, 0, 0)
        return ctx.getImageData(0, 0, image.width, image.height)
      }
      const [x, y] = await Promise.all([load(a!), load(b!)])
      const share = (x0: number, y0: number, x1: number, y1: number) => {
        let differ = 0
        let total = 0
        for (let row = Math.floor(y0 * x.height); row < y1 * x.height; row++) {
          for (let col = Math.floor(x0 * x.width); col < x1 * x.width; col++) {
            const i = (row * x.width + col) * 4
            const delta =
              Math.abs(x.data[i]! - y.data[i]!) +
              Math.abs(x.data[i + 1]! - y.data[i + 1]!) +
              Math.abs(x.data[i + 2]! - y.data[i + 2]!)
            if (delta > 30) differ++
            total++
          }
        }
        return differ / total
      }
      return {
        // Tengah kartu, jauh dari bingkai.
        center: share(0.15, 0.15, 0.85, 0.85),
        // Pita vertikal tempat garis kiri bingkai (4% sisi pendek dari tepi).
        edge: share(0.025, 0.3, 0.06, 0.7),
      }
    },
    [before.toString('base64'), after.toString('base64')],
  )
  expect(changed.center).toBeLessThan(0.01)
  expect(changed.edge).toBeGreaterThan(0.1)
})

test('isi surat: tulisan panjang mengecil di ruangnya, tidak menabrak foto atau keluar halaman', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await chooseTemplate(page, '1 foto + teks')
  await page.getByRole('textbox', { name: 'Isi surat' }).fill(longMessage)
  await page.getByTestId('open-content-editor').click()
  await page.getByTestId('content-photo-upload').setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: await photoPng(page, 400, 300),
  })
  await expect(editorPage(page).locator('[data-kind="photo"] img')).toHaveAttribute('src', /^blob:/)
  await expectTidy(editorPage(page))

  // Teksnya dipilih: editor memberi tahu hurufnya diperkecil.
  await editorPage(page).locator('[data-kind="text"]').click()
  await expect(page.getByTestId('text-shrunk')).toBeVisible()
  await page
    .getByTestId('content-editor')
    .getByRole('button', { name: 'Selesai', exact: true })
    .click()

  // Kartu yang terbuka memakai tata letak yang sama.
  await expect(cardPage(page).locator('[data-kind="text"] p')).toHaveAttribute('data-fit', /0\.\d+/)
  await expectTidy(cardPage(page))
})

test('ganti bentuk kartu menyusun ulang isi surat, tidak ada yang bertumpuk', async ({ page }) => {
  test.setTimeout(60_000)
  await chooseShape(page, 'Tegak')
  await chooseTemplate(page, '2 foto + teks')
  await page.getByRole('textbox', { name: 'Isi surat' }).fill(longMessage)
  await page.getByTestId('open-content-editor').click()
  const upload = page.getByTestId('content-photo-upload')
  await upload.setInputFiles({
    name: 'tegak.png',
    mimeType: 'image/png',
    buffer: await photoPng(page, 300, 400),
  })
  await expect(editorPage(page).locator('[data-kind="photo"] img').first()).toBeVisible()
  await upload.setInputFiles({
    name: 'mendatar.png',
    mimeType: 'image/png',
    buffer: await photoPng(page, 400, 300),
  })
  await expect(editorPage(page).locator('[data-kind="photo"] img')).toHaveCount(2)

  // Bingkai slot mengikuti bentuk fotonya, jadi foto tegak tampil utuh (3:4), tidak dipotong.
  const [portrait] = await boxes(editorPage(page).locator('[data-kind="photo"] .letter-photo'))
  expect((portrait!.right - portrait!.left) / (portrait!.bottom - portrait!.top)).toBeCloseTo(
    0.75,
    1,
  )
  await page
    .getByTestId('content-editor')
    .getByRole('button', { name: 'Selesai', exact: true })
    .click()

  for (const shape of ['Mendatar', 'Persegi', 'Asli']) {
    await chooseShape(page, shape)
    await page.getByTestId('open-content-editor').click()
    await expectTidy(editorPage(page))
    await page
      .getByTestId('content-editor')
      .getByRole('button', { name: 'Selesai', exact: true })
      .click()
  }
})

test('ganti foto berkali-kali: bingkainya mengikuti foto tanpa terus mengecil', async ({
  page,
}) => {
  await chooseTemplate(page, '1 foto + teks')
  await page.getByTestId('open-content-editor').click()
  const tools = page.getByTestId('content-editor')
  const frame = editorPage(page).locator('[data-kind="photo"] .letter-photo')
  const image = frame.locator('img')
  const area = async () => {
    const box = (await frame.boundingBox())!
    return box.width * box.height
  }
  const landscape = await photoPng(page, 400, 300)
  const portrait = await photoPng(page, 300, 400)
  await page
    .getByTestId('content-photo-upload')
    .setInputFiles({ name: 'awal.png', mimeType: 'image/png', buffer: landscape })
  await expect(image).toHaveAttribute('src', /^blob:/)
  const first = await area()

  for (const [index, buffer] of [portrait, landscape, portrait, landscape].entries()) {
    const before = await image.getAttribute('src')
    const chooser = page.waitForEvent('filechooser')
    await tools.getByRole('button', { name: 'Ganti foto' }).click()
    await (await chooser).setFiles({ name: `ganti-${index}.png`, mimeType: 'image/png', buffer })
    await expect(image).not.toHaveAttribute('src', before!)
  }
  // Foto 4:3 terakhir sama besar dengan foto 4:3 pertama.
  expect(Math.abs((await area()) / first - 1)).toBeLessThan(0.03)
})

test('template dengan slot foto lebih sedikit dimatikan, dan teks baru tidak menimpa foto', async ({
  page,
}) => {
  await chooseTemplate(page, '2 foto + teks')
  await page.getByTestId('open-content-editor').click()
  const upload = page.getByTestId('content-photo-upload')
  for (const [index, size] of [
    [400, 300],
    [300, 400],
  ].entries()) {
    await upload.setInputFiles({
      name: `foto-${index}.png`,
      mimeType: 'image/png',
      buffer: await photoPng(page, size[0]!, size[1]!),
    })
    await expect(editorPage(page).locator('[data-kind="photo"] img')).toHaveCount(index + 1)
  }
  const tools = page.getByTestId('content-editor')
  await tools.getByRole('button', { name: 'Lepas pilihan' }).click()

  // Dua foto: template satu foto dan teks saja tidak bisa dipilih.
  const templates = tools.getByRole('radiogroup', { name: 'Template isi surat' })
  await expect(templates.getByRole('radio', { name: 'Teks saja' })).toBeDisabled()
  await expect(templates.getByRole('radio', { name: '1 foto + teks' })).toBeDisabled()
  await expect(templates.getByRole('radio', { name: 'Kolase 4 foto' })).toBeEnabled()

  // Dua blok teks baru: tidak ada yang ditaruh di atas foto.
  for (let i = 0; i < 2; i++) {
    await tools.getByRole('button', { name: 'Teks', exact: true }).click()
    await page.keyboard.type(`Tambahan ${i + 1}`)
    await tools.getByRole('button', { name: 'Lepas pilihan' }).click()
  }
  await expectTidy(editorPage(page))
  await tools.getByRole('button', { name: 'Selesai', exact: true }).click()
  await expect(page.getByTestId('template-limit')).toContainText('2 foto')
})

test('editor: elemen tidak bisa digeser keluar halaman', async ({ page }) => {
  await page.getByTestId('open-content-editor').click()
  const tools = page.getByTestId('content-editor')
  await tools.getByRole('button', { name: 'Stiker', exact: true }).click()
  await tools.getByRole('button', { name: 'Hati', exact: true }).click()
  const sticker = editorPage(page).locator('[data-kind="sticker"]')
  const start = (await sticker.boundingBox())!
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + 2000, start.y + 2000, { steps: 8 })
  await page.mouse.up()
  const [sheet] = await boxes(editorPage(page))
  const [moved] = await boxes(sticker)
  expect(inside(moved!, sheet!)).toBe(true)
  // Menempel di pojok kanan bawah, tidak tertahan di tengah.
  expect(sheet!.right - moved!.right).toBeLessThan(4)
  expect(sheet!.bottom - moved!.bottom).toBeLessThan(4)
})
