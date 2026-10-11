import { expect, test } from '@playwright/test'

// Worker HEIC berisi libheif (sekitar 2 MB) dan hanya dibutuhkan saat ada foto HEIC. Halaman
// mana pun, terutama halaman surat yang dibuka penerima dari WhatsApp, tidak boleh memuatnya
// lebih dulu lewat preload atau prefetch (lihat hook build:manifest di nuxt.config.ts).
for (const path of ['/', '/l/AbCdEfGhIj', '/letter/new', '/pocket', '/tv']) {
  test(`${path} tidak memuat worker HEIC lebih dulu`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    expect(html).not.toContain('heic.worker')
  })
}
