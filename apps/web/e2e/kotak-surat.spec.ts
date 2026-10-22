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
  await viewer.getByRole('button', { name: 'Tutup' }).click()
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
  await viewer.getByRole('button', { name: 'Tutup' }).click()
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
  await reader.getByRole('button', { name: 'Tutup' }).click()
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
