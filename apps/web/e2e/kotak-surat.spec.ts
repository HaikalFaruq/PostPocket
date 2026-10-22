import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

// Kotak surat: penerima menyimpan surat dari link di perangkatnya, lalu membukanya lagi dari
// folder kaca, juga setelah link dan fotonya dihapus server.

const jpeg = readFileSync(new URL('./fixtures/foto-kecil.jpg', import.meta.url))

interface Sent {
  slug: string
  id: string
  editToken: string
}

/** Surat berfoto depan dan satu foto isi, langsung lewat mock API. */
async function letterWithPhotos(request: APIRequestContext, text: string): Promise<Sent> {
  const meta = { type: 'image/jpeg', width: 32, height: 24, size: jpeg.length }
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
            {
              kind: 'text',
              id: 't1',
              x: 0.5,
              y: 0.8,
              width: 0.8,
              rotation: 0,
              text,
              size: 0.07,
              align: 'center',
            },
          ],
        },
        cover: meta,
        photos: [{ key: 'f1', ...meta }],
        og: { type: 'image/jpeg', width: 1200, height: 630, size: jpeg.length },
        replyTo: null,
      },
    })
  ).json()
  for (const target of [created.uploads.cover, created.uploads.photos.f1, created.uploads.og]) {
    await request.put(target.signedUrl, { headers: { 'content-type': 'image/jpeg' }, data: jpeg })
  }
  const published = await (
    await request.post(`/mock-api/letters/${created.id}/publish`, {
      headers: { 'x-edit-token': created.editToken },
    })
  ).json()
  return { slug: published.slug, id: created.id, editToken: created.editToken }
}

/** Surat yang sedang tampil di penampil, bukan yang sedang bergeser keluar. */
const shownCard = (viewer: Locator) =>
  viewer.locator('[data-testid="viewer-letter"]:not([aria-hidden="true"])')

async function openLetter(page: Page, slug: string) {
  await page.goto(`/l/${slug}`)
  const card = page.getByRole('button', { name: /Surat untukmu/ })
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
}

test('surat yang disimpan tetap bisa dibuka dari Kotak surat setelah link-nya mati', async ({
  page,
  request,
}) => {
  const sent = await letterWithPhotos(request, 'Simpan aku ya')
  await openLetter(page, sent.slug)

  const keep = page.getByTestId('keep-letter')
  await expect(keep).toHaveAttribute('data-state', 'idle')
  await expect(keep).toContainText('Simpan surat ini')
  await keep.getByTestId('keep-save').click()
  await expect(keep).toHaveAttribute('data-state', 'saved')
  await expect(keep).toContainText('Tersimpan di HP ini')
  await expect(keep).toContainText('CD "Surat untukmu"')

  // Dibuka lagi: tetap tercatat tersimpan.
  await openLetter(page, sent.slug)
  await expect(page.getByTestId('keep-letter')).toHaveAttribute('data-state', 'saved')

  // Link-nya mati: foto dihapus job, lalu suratnya dihapus pengirim.
  await request.post(`/mock-api/_test/l/${sent.slug}/hapus-foto`)
  await request.delete(`/mock-api/letters/${sent.id}`, {
    headers: { 'x-edit-token': sent.editToken },
  })
  expect((await page.goto(`/l/${sent.slug}`))?.status()).toBe(404)

  await page.goto('/kotak')
  const folder = page.getByTestId('saved-folder')
  await expect(folder).toHaveCount(1)
  const toggle = folder.getByTestId('folder-toggle')
  await expect(toggle).toHaveAccessibleName('Buka Surat untukmu, 1 surat')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(folder.getByRole('button', { name: /Simpan aku ya/ })).toBeVisible()

  await folder.getByTestId('folder-read').click()
  const viewer = page.getByTestId('letter-viewer')
  await expect(viewer.getByTestId('viewer-title')).toHaveText('Surat untukmu')
  await expect(viewer.getByTestId('viewer-count')).toHaveCount(0)
  const card = shownCard(viewer).getByRole('button', { name: /Surat untukmu/ })
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'true')
  const pageInside = shownCard(viewer).getByTestId('letter-page')
  await expect(pageInside).toContainText('Simpan aku ya')
  // Fotonya dibaca dari perangkat ini, bukan dari server yang sudah menghapusnya.
  await expect(pageInside.locator('img[src^="blob:"]')).toHaveCount(1)
  await expect(viewer.locator('.foil-art')).toHaveAttribute('src', /^blob:/)

  // Foto suratnya juga masuk CD di TV.
  await viewer.getByRole('button', { name: 'Tutup', exact: true }).click()
  await expect(viewer).toBeHidden()
  const tv = folder.getByTestId('folder-tv')
  const href = await tv.getAttribute('href')
  const album = new URL(href!, 'http://x').searchParams.get('album')
  await tv.click()
  await expect(page.getByTestId('tv-slideshow')).toBeVisible()
  await expect(page.getByTestId('tv-slot')).toHaveAttribute('data-state', 'loaded')
  await expect(page.locator('.cd-item.is-current')).toHaveAttribute('data-album', album!)
  await expect(page.getByTestId('tv-counter')).toContainText('2')
})

test('surat di Kotak surat dibaca satu per satu lalu dihapus dari perangkat', async ({
  page,
  request,
}) => {
  const letters = [
    await letterWithPhotos(request, 'Surat pertama'),
    await letterWithPhotos(request, 'Surat kedua'),
  ]
  for (const sent of letters) {
    await openLetter(page, sent.slug)
    await page.getByTestId('keep-save').click()
    await expect(page.getByTestId('keep-letter')).toHaveAttribute('data-state', 'saved')
  }
  // "Buka Kotak surat" langsung membuka folder suratnya.
  await page.getByTestId('keep-open-box').click()
  await expect(page).toHaveURL(/\/kotak$/)

  const folder = page.getByTestId('saved-folder')
  await expect(folder.getByTestId('folder-toggle')).toHaveAttribute('aria-expanded', 'true')
  // Surat untukmu seperti kotak masuk: yang terbaru di depan. Lembar paling depan diketuk di
  // bagian yang menyembul di atas kaca.
  const newest = folder.getByRole('button', { name: /Surat kedua/ })
  const box = (await newest.boundingBox())!
  await newest.click({ position: { x: box.width / 2, y: 24 } })
  const viewer = page.getByTestId('letter-viewer')
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 1 dari 2')
  await expect(viewer.getByTestId('viewer-prev')).toBeDisabled()
  // Fokus awal di kartunya, bukan di tombol Hapus.
  await expect(shownCard(viewer).getByRole('button', { name: /Surat untukmu/ })).toBeFocused()
  // Dengan keyboard: di surat terakhir tombol Berikutnya nonaktif, jadi fokusnya pindah ke
  // Sebelumnya dan tidak lepas dari penampil.
  await viewer.getByTestId('viewer-next').focus()
  await page.keyboard.press('Enter')
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 2 dari 2')
  await expect(viewer.getByTestId('viewer-next')).toBeDisabled()
  await expect(viewer.getByTestId('viewer-prev')).toBeFocused()
  await shownCard(viewer)
    .getByRole('button', { name: /Surat untukmu/ })
    .click()
  await expect(shownCard(viewer).getByTestId('letter-page')).toContainText('Surat pertama')

  // Lembar di belakang juga bisa dipilih dengan keyboard.
  await viewer.getByRole('button', { name: 'Tutup', exact: true }).click()
  await expect(viewer).toBeHidden()
  await folder.getByRole('button', { name: /Surat pertama/ }).focus()
  await page.keyboard.press('Enter')
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 2 dari 2')
  await viewer.getByTestId('viewer-prev').click()
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 1 dari 2')
  const card = shownCard(viewer).getByRole('button', { name: /Surat untukmu/ })
  await expect(card).toHaveAttribute('aria-pressed', 'false')
  await card.click()
  await expect(shownCard(viewer).getByTestId('letter-page')).toContainText('Surat kedua')

  // Baca lebih besar memakai halaman yang sama.
  await viewer.getByRole('button', { name: 'Baca lebih besar' }).click()
  const reader = page.getByTestId('letter-reader')
  await expect(reader).toContainText('Surat kedua')
  // Tampilan baca menutupi penampil sepenuhnya, termasuk kepala dan kaki penampil.
  const layers = await page.evaluate(() => {
    const z = (id: string) =>
      Number(getComputedStyle(document.querySelector(`[data-testid="${id}"]`)!).zIndex)
    return { overlay: z('letter-reader-overlay'), viewer: z('letter-viewer') }
  })
  expect(layers.overlay).toBeGreaterThan(layers.viewer)
  await reader.getByRole('button', { name: 'Tutup', exact: true }).click()
  await expect(reader).toBeHidden()
  await expect(viewer).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await viewer.getByTestId('viewer-remove').click()
  await expect(viewer.getByTestId('viewer-count')).toHaveCount(0)
  await expect(viewer.getByTestId('viewer-title')).toHaveText('Surat untukmu')
  // Halaman di belakang penampil disembunyikan dari pembaca layar, jadi labelnya dicek langsung.
  await expect(folder.getByTestId('folder-toggle')).toHaveAttribute('aria-label', /1 surat/)

  page.once('dialog', (dialog) => dialog.accept())
  await viewer.getByTestId('viewer-remove').click()
  await expect(viewer).toBeHidden()
  await expect(page.getByTestId('kotak-empty')).toBeVisible()
  // Lembar yang membuka penampil ikut hilang bersama foldernya, jadi fokus pindah ke judul.
  await expect(page.getByRole('heading', { name: 'Kotak surat', level: 1 })).toBeFocused()
})

test('foto surat bisa diunduh ke perangkat', async ({ page, request, browserName }) => {
  test.skip(browserName === 'webkit', 'Unduhan beruntun diuji di Chromium')
  const sent = await letterWithPhotos(request, 'Unduh fotoku')
  await openLetter(page, sent.slug)
  const names: string[] = []
  page.on('download', (download) => names.push(download.suggestedFilename()))
  await page.getByTestId('keep-download').click()
  await expect.poll(() => names.length).toBe(2)
  expect(names.sort()).toEqual([
    `postpocket-surat-${sent.slug.toLowerCase()}-1.jpg`,
    `postpocket-surat-${sent.slug.toLowerCase()}-2.jpg`,
  ])
  await expect(page.getByTestId('keep-letter')).toContainText('2 foto diunduh')
})

test('surat yang fotonya sudah dihapus tetap bisa disimpan, slot fotonya diberi keterangan', async ({
  page,
  request,
}) => {
  const sent = await letterWithPhotos(request, 'Foto sudah lewat 7 hari')
  await request.post(`/mock-api/_test/l/${sent.slug}/hapus-foto`)
  await openLetter(page, sent.slug)
  await expect(page.getByTestId('keep-download')).toHaveCount(0)
  await page.getByTestId('keep-save').click()
  await expect(page.getByTestId('keep-letter')).toHaveAttribute('data-state', 'saved')
  await expect(page.getByTestId('keep-letter')).not.toContainText('CD')

  await page.goto('/kotak')
  await page.getByTestId('folder-toggle').click()
  await expect(page.getByTestId('folder-tv')).toHaveCount(0)
  await page.getByTestId('folder-read').click()
  const viewer = page.getByTestId('letter-viewer')
  await shownCard(viewer)
    .getByRole('button', { name: /Surat untukmu/ })
    .click()
  await expect(shownCard(viewer).getByTestId('letter-page')).toContainText('Foto tidak tersimpan')
})

test('pengirim yang melihat suratnya sendiri tidak diajak menyimpan', async ({ page }) => {
  await page.goto('/letter/new')
  await expect(page.locator('.foil-rotor')).toBeVisible()
  await page.getByRole('textbox', { name: 'Isi surat' }).fill('Suratku sendiri')
  await page.getByRole('button', { name: 'Buat link untuk dikirim' }).click()
  await expect(page.getByTestId('send-letter')).toHaveAttribute('data-state', 'done', {
    timeout: 20_000,
  })
  const url = await page.getByTestId('sent-url').inputValue()
  await page.goto(url)
  await expect(page.getByTestId('own-letter-note')).toBeVisible()
  await page.getByRole('button', { name: /Surat untukmu/ }).click()
  await expect(page.getByRole('button', { name: 'Baca lebih besar' })).toBeVisible()
  await expect(page.getByTestId('keep-letter')).toHaveCount(0)
})

test('Kotak surat yang masih kosong mengajak menulis surat', async ({ page }) => {
  await page.goto('/kotak')
  await expect(page.getByTestId('kotak-empty')).toContainText('Belum ada surat tersimpan')
  await expect(page.getByRole('link', { name: 'Tulis surat' })).toHaveAttribute(
    'href',
    '/letter/new',
  )
})

test('link surat yang sudah mati mengarah ke salinannya di Kotak surat', async ({
  page,
  request,
}) => {
  const sent = await letterWithPhotos(request, 'Masih ada di HP')
  await openLetter(page, sent.slug)
  await page.getByTestId('keep-save').click()
  await expect(page.getByTestId('keep-letter')).toHaveAttribute('data-state', 'saved')
  await request.delete(`/mock-api/letters/${sent.id}`, {
    headers: { 'x-edit-token': sent.editToken },
  })

  expect((await page.goto(`/l/${sent.slug}`))?.status()).toBe(404)
  await expect(page.getByTestId('letter-missing')).toContainText('kamu sudah menyimpannya')
  await page.getByTestId('letter-kept').click()
  const viewer = page.getByTestId('letter-viewer')
  await expect(viewer).toBeVisible()
  await shownCard(viewer)
    .getByRole('button', { name: /Surat untukmu/ })
    .click()
  await expect(shownCard(viewer).getByTestId('letter-page')).toContainText('Masih ada di HP')
})

test('dari link, foldernya terbuka seperti diketuk lalu suratnya tumbuh dari lembarnya', async ({
  page,
  request,
}) => {
  const [sent] = await keepLetters(page, request, ['Dari link'])
  await page.addInitScript(() => {
    // Seperti HP dengan GPU: animasinya tidak dilewati (di tes otomatis biasanya dilewati).
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
    const getParameter = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = function (param: number) {
      return param === 0x9246 || param === 0x1f01 ? 'Apple GPU' : getParameter.call(this, param)
    }
    // Keadaan folder yang tergambar di tiap frame (dicatat sesudah frame-nya digambar), dan
    // keyframe awal animasi kartu di penampil.
    const painted: string[] = []
    const starts: string[] = []
    Object.assign(window, { painted, starts })
    const frame = () => {
      setTimeout(() => {
        const toggle = document.querySelector('[data-testid=folder-toggle]')
        if (toggle) painted.push(toggle.getAttribute('aria-expanded') ?? '')
      })
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    const animate = Element.prototype.animate
    Element.prototype.animate = function (keyframes, options) {
      if (Array.isArray(keyframes)) starts.push(String(keyframes[0]?.transform ?? ''))
      return animate.call(this, keyframes, options)
    }
  })
  await page.goto(`/kotak?surat=${sent!.slug}&baca=1`)
  await expect(page.getByTestId('letter-viewer')).toBeVisible()
  const recorded = () =>
    page.evaluate(() => {
      const { painted, starts } = window as unknown as { painted: string[]; starts: string[] }
      return { painted: [...painted], starts: [...starts] }
    })
  await expect.poll(async () => (await recorded()).starts.length).toBeGreaterThan(0)
  const { painted, starts } = await recorded()
  // Foldernya tergambar tertutup dulu, baru terbuka, jadi animasi bukanya berjalan.
  expect(painted.indexOf('false')).toBeGreaterThanOrEqual(0)
  expect(painted.indexOf('false')).toBeLessThan(painted.indexOf('true'))
  // Kartunya mulai dari lembarnya (digeser dan diperkecil ke lembar), bukan naik dari bawah.
  expect(starts[0]).toMatch(/^translate\(.+\) scale\(/)
})

test('penampil: panah keyboard pindah surat, bukan membalik kartu', async ({ page, request }) => {
  for (const text of ['Surat satu', 'Surat dua', 'Surat tiga']) {
    const sent = await letterWithPhotos(request, text)
    await openLetter(page, sent.slug)
    await page.getByTestId('keep-save').click()
    await expect(page.getByTestId('keep-letter')).toHaveAttribute('data-state', 'saved')
  }
  await page.goto('/kotak')
  await page.getByTestId('folder-toggle').click()
  await page.getByTestId('folder-read').click()
  const viewer = page.getByTestId('letter-viewer')
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 1 dari 3')
  await page.keyboard.press('ArrowRight')
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 2 dari 3')
  // Fokusnya pindah ke kartu baru, tidak hilang bersama kartu yang bergeser keluar.
  await expect(shownCard(viewer).getByRole('button', { name: /Surat untukmu/ })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 3 dari 3')
  await page.keyboard.press('ArrowLeft')
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 2 dari 3')
  // Kartunya tetap menghadap depan.
  await expect(shownCard(viewer).locator('.foil-rotor')).not.toHaveAttribute(
    'style',
    /rotateY\(180/,
  )
})

test('penampil di HP: geser ke samping di luar kartu pindah surat, geser ke bawah menutup', async ({
  page,
  request,
  browserName,
  hasTouch,
}) => {
  test.skip(browserName !== 'chromium' || !hasTouch, 'Sentuhan lewat CDP, khusus HP Chromium')
  for (const text of ['Surat satu', 'Surat dua']) {
    const sent = await letterWithPhotos(request, text)
    await openLetter(page, sent.slug)
    await page.getByTestId('keep-save').click()
    await expect(page.getByTestId('keep-letter')).toHaveAttribute('data-state', 'saved')
  }
  await page.goto('/kotak')
  await page.getByTestId('folder-toggle').click()
  await page.getByTestId('folder-read').click()
  const viewer = page.getByTestId('letter-viewer')
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 1 dari 2')

  // Jari di bawah kartu, di ruang kosong panggung penampil.
  const footer = (await viewer.locator('footer').boundingBox())!
  const y = footer.y - 24
  const cdp = await page.context().newCDPSession(page)
  async function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    const point = (t: number) => [
      { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
    ]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(0) })
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(step / 8),
      })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const middle = footer.x + footer.width / 2
  await drag({ x: middle + 80, y }, { x: middle - 80, y })
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 2 dari 2')
  await page.waitForTimeout(400)
  await drag({ x: middle - 80, y }, { x: middle + 80, y })
  await expect(viewer.getByTestId('viewer-count')).toHaveText('Surat 1 dari 2')
  await page.waitForTimeout(400)
  const header = (await viewer.locator('header').boundingBox())!
  await drag(
    { x: 24, y: header.y + header.height + 30 },
    { x: 24, y: header.y + header.height + 200 },
  )
  await expect(viewer).toBeHidden()
})

test('memori HP penuh: Simpan surat memberi tahu, bukan menyalahkan browser', async ({
  page,
  request,
}) => {
  const sent = await letterWithPhotos(request, 'Memori penuh')
  await openLetter(page, sent.slug)
  // IndexedDB menolak tulisan karena kuotanya habis.
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }
  })
  await page.getByTestId('keep-save').click()
  const keep = page.getByTestId('keep-letter')
  await expect(keep).toHaveAttribute('data-state', 'idle')
  await expect(keep.getByRole('status')).toContainText('Memori HP untuk browser ini sudah penuh')
  await expect(keep.getByRole('status')).toBeInViewport()
})

/** Simpan surat-surat ini ke Kotak surat lewat halaman penerimanya. */
async function keepLetters(page: Page, request: APIRequestContext, texts: string[]) {
  const sent: Sent[] = []
  for (const text of texts) {
    const letter = await letterWithPhotos(request, text)
    await openLetter(page, letter.slug)
    await page.getByTestId('keep-save').click()
    await expect(page.getByTestId('keep-letter')).toHaveAttribute('data-state', 'saved')
    sent.push(letter)
  }
  return sent
}

test('Back menutup folder yang terbuka dulu, baru meninggalkan Kotak surat', async ({
  page,
  request,
}) => {
  await keepLetters(page, request, ['Satu'])
  await page.goto('/kotak')
  const toggle = page.getByTestId('folder-toggle')
  // Ketukan ganda (kebiasaan di HP) membuka folder, tidak langsung menutupnya lagi.
  await toggle.dblclick()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.waitForTimeout(400)
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.goBack()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page).toHaveURL(/\/kotak$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/l\//)
})

test('ketukan ganda yang pelan tidak membuka surat yang baru naik ke bawah jari', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  await keepLetters(page, request, ['Satu', 'Dua', 'Tiga', 'Empat'])
  await page.goto('/kotak')
  const toggle = page.getByTestId('folder-toggle')
  await expect(page.getByTestId('glass-folder')).toHaveAttribute('data-entered', 'true')
  await page.waitForTimeout(1000)
  const glass = (await toggle.boundingBox())!
  const point = { x: glass.x + glass.width / 2, y: glass.y + glass.height / 2 }
  // Kedua ketukan dijalankan di halaman dengan jeda 200 ms yang pasti, bukan lewat Playwright
  // yang jedanya bisa melar saat mesin sibuk. Kipasnya membuat kaca turun, jadi ketukan kedua di
  // titik yang sama jatuh di lembar depan; di HP lambat kacanya belum sempat turun, dan ketukan
  // di kaca sudah diabaikan sendiri. Ketukan keduanya dikirim ke lembar depan, supaya jalur
  // lembar yang diuji.
  const second = await page.evaluate(async ({ x, y }) => {
    // Klik jari: koordinat dan hitungan ketukannya ada, tidak seperti click() dari skrip.
    const tap = (el: Element | null | undefined, detail: number) =>
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, detail }))
    tap(document.elementFromPoint(x, y), 1)
    await new Promise((resolve) => setTimeout(resolve, 200))
    const front = document.querySelector('[data-testid=saved-folder] .gf-sheet')
    tap(front, 2)
    return front ? 'lembar' : null
  }, point)
  expect(second).toBe('lembar')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.waitForTimeout(400)
  await expect(page.getByTestId('letter-viewer')).toHaveCount(0)
})

test('folder yang ditutup setelah halamannya digulir tetap di tempatnya di layar', async ({
  page,
  request,
}) => {
  await keepLetters(page, request, ['Satu', 'Dua'])
  await page.setViewportSize({ width: 390, height: 520 })
  // Ditutup dengan ketukan, lalu dengan Back. Tiap kali halamannya dimuat baru, karena Chrome
  // hanya memulihkan posisi gulir sendiri (ke posisi saat foldernya dibuka) sebelum Nuxt memakai
  // scrollRestoration "manual".
  for (const close of ['ketuk', 'back'] as const) {
    await page.goto('/kotak')
    const toggle = page.getByTestId('folder-toggle')
    await toggle.click()
    await page.waitForTimeout(900)
    await page.evaluate(() => window.scrollBy(0, 80))
    const glassTop = () => toggle.evaluate((el) => Math.round(el.getBoundingClientRect().top))
    const before = await glassTop()
    const scrolled = await page.evaluate(() => Math.round(window.scrollY))
    if (close === 'ketuk') await toggle.dispatchEvent('click')
    else await page.goBack()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await page.waitForTimeout(900)
    // Ruang kipas di atas kaca mengecil, jadi halamannya digulir naik sebanyak itu dan kacanya
    // tidak bergeser.
    expect(Math.abs((await glassTop()) - before)).toBeLessThanOrEqual(2)
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(scrolled)
  }
})

test('ketukan di lembar lain tepat setelah folder dibuka langsung membuka suratnya', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  await keepLetters(page, request, ['Satu', 'Dua', 'Tiga', 'Empat'])
  await page.goto('/kotak')
  const toggle = page.getByTestId('folder-toggle')
  await expect(page.getByTestId('glass-folder')).toHaveAttribute('data-entered', 'true')
  const glass = (await toggle.boundingBox())!
  const point = { x: glass.x + glass.width / 2, y: glass.y + glass.height / 2 }
  // 200 ms setelah folder dibuka, kipasnya masih bergerak. Lembar paling belakang jauh dari
  // ketukan pertama, jadi ketukan itu bukan ketukan ganda.
  const distance = await page.evaluate(async ({ x, y }) => {
    const tap = (el: Element | null, clientX: number, clientY: number) =>
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX, clientY, detail: 1 }))
    tap(document.elementFromPoint(x, y), x, y)
    await new Promise((resolve) => setTimeout(resolve, 200))
    const sheets = document.querySelectorAll('[data-testid=saved-folder] .gf-sheet')
    const back = sheets[sheets.length - 1]!
    const rect = back.getBoundingClientRect()
    const at = { x: rect.left + rect.width / 2, y: rect.top + 16 }
    tap(back, at.x, at.y)
    return Math.hypot(at.x - x, at.y - y)
  }, point)
  expect(distance).toBeGreaterThan(48)
  await expect(page.getByTestId('letter-viewer').getByTestId('viewer-count')).toHaveText(
    'Surat 4 dari 4',
  )
})

test('kembali dari TV, folder yang tadi terbuka tampil lagi di tempat yang sama', async ({
  page,
  request,
}) => {
  await keepLetters(page, request, ['Fotonya diputar'])
  // Layar pendek, jadi tombol TV di bawah folder yang terbuka perlu digulir dulu.
  await page.setViewportSize({ width: 390, height: 520 })
  await page.goto('/kotak')
  const toggle = page.getByTestId('folder-toggle')
  await toggle.click()
  const tv = page.getByTestId('folder-tv')
  // Setelah kipas dan tombol di bawahnya selesai bergerak, tombol TV ditaruh di tengah layar,
  // jadi klik Playwright tidak menggulirnya lagi.
  await page.waitForTimeout(900)
  await tv.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  const onScreen = () => tv.evaluate((el) => Math.round(el.getBoundingClientRect().top))
  const before = await onScreen()
  await tv.click()
  await expect(page.getByTestId('tv-slideshow')).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/kotak$/)
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  // Foldernya terbuka di tempat yang sama di layar, jadi tombol TV juga.
  await expect.poll(async () => Math.abs((await onScreen()) - before)).toBeLessThanOrEqual(2)
})

/**
 * Jalur tersempit lembar-lembar di belakang kipas yang terbuka, dalam px: bagian lembar yang
 * bisa diketuk di atas lembar depannya, diukur per kolom dengan hit test.
 */
function narrowestStrip(page: Page) {
  return page.evaluate(() => {
    const sheets = [...document.querySelectorAll('[data-testid=saved-folder] .gf-sheet')]
    let narrowest = Number.POSITIVE_INFINITY
    for (const sheet of sheets.slice(1)) {
      const r = sheet.getBoundingClientRect()
      const hits = (x: number, y: number) => sheet.contains(document.elementFromPoint(x, y))
      // Di 15% kiri dan kanan kotaknya, kolomnya memotong sisi lembar yang miring, bukan tepi
      // atasnya. Batas jalurnya dicari per 4 px lalu dipersempit per 1 px, supaya hit test-nya
      // tidak memakan CPU tes lain yang berjalan bersamaan di CI.
      for (let fx = 0.15; fx <= 0.851; fx += 0.05) {
        const x = r.left + r.width * fx
        if (x < 1 || x > innerWidth - 1) continue
        let y = Math.max(0, r.top)
        while (y < r.bottom && !hits(x, y)) y += 4
        if (y >= r.bottom) continue
        let start = y
        while (start > r.top && hits(x, start - 1)) start--
        while (y < r.bottom && hits(x, y)) y += 4
        let end = y
        while (end > start && !hits(x, end - 1)) end--
        narrowest = Math.min(narrowest, end - start)
      }
    }
    return narrowest
  })
}

test('lembar di belakang kipas bisa diketuk di bagian yang menyembul', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await keepLetters(page, request, ['Surat A', 'Surat B', 'Surat C', 'Surat D'])
  // Paling sedikit 44 px di titik tersempitnya, juga di HP 320 px yang foldernya diperkecil.
  const own = page.viewportSize()!
  for (const width of [320, own.width]) {
    await page.setViewportSize({ width, height: Math.max(own.height, 760) })
    await page.goto('/kotak')
    await page.getByTestId('folder-toggle').click()
    // Mouse di desktop jangan menyorot salah satu lembar.
    await page.mouse.move(1, 1)
    await page.waitForTimeout(1200)
    expect(await narrowestStrip(page)).toBeGreaterThanOrEqual(44)
  }
  await page.setViewportSize(own)
  await page.goto('/kotak')
  await page.getByTestId('folder-toggle').click()
  const viewer = page.getByTestId('letter-viewer')
  // Surat untukmu urut dari yang terbaru: D di depan, A paling belakang.
  for (const [index, name] of ['Surat C', 'Surat B', 'Surat A'].entries()) {
    const sheet = page.getByTestId('saved-folder').getByRole('button', { name: new RegExp(name) })
    await page.waitForTimeout(900)
    const box = (await sheet.boundingBox())!
    // 36 px di bawah tepi atas lembarnya: lebih dalam dari jalur 30 px yang dulu.
    await sheet.click({ position: { x: box.width / 2, y: 36 } })
    await expect(viewer.getByTestId('viewer-count')).toHaveText(`Surat ${index + 2} dari 4`)
    await viewer.getByRole('button', { name: 'Tutup', exact: true }).click()
    await expect(viewer).toBeHidden()
  }
})

test('kartu yang ditutup lagi tetap memberi tahu suratnya sudah tersimpan', async ({
  page,
  request,
}) => {
  const [sent] = await keepLetters(page, request, ['Sudah disimpan'])
  const card = page.getByRole('button', { name: /Surat untukmu/ })
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed', 'false')
  const note = page.getByTestId('kept-note')
  await expect(note).toContainText('Tersimpan di Kotak surat')
  await expect(note.getByRole('link', { name: 'Kotak surat' })).toHaveAttribute(
    'href',
    `/kotak?surat=${sent!.slug}`,
  )
})

test('Kotak surat bisa dicapai dari editor surat, TV, dan Pocket', async ({ page }) => {
  await page.goto('/letter/new')
  await expect(page.getByTestId('editor-kotak')).toHaveAttribute('href', '/kotak')
  await page.goto('/tv')
  await expect(page.getByTestId('tv-kotak')).toHaveAttribute('href', '/kotak')
  await page.goto('/pocket')
  const link = page.getByTestId('pocket-kotak')
  await expect(link).toHaveAttribute('href', '/kotak')
  // Bidang ketuknya setinggi jari, walau tautannya di baris teks kecil.
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
})

test('memori HP yang hampir penuh diberi tahu sebelum menyimpan gagal', async ({ page }) => {
  await page.addInitScript(() => {
    StorageManager.prototype.estimate = async () => ({ usage: 950, quota: 1000 })
  })
  await page.goto('/kotak')
  await expect(page.getByTestId('storage-nearly-full')).toContainText('hampir penuh')
})
