import type { APIRequestContext } from '@playwright/test'
import { WHATSAPP_AGENT, isLocalUrl, previewChecks, readMeta } from '../scripts/link-preview.mjs'

/**
 * Cek preview WhatsApp untuk link surat, sama seperti `pnpm check:preview`: halaman dan gambar
 * OG diambil dengan user agent WhatsApp. Mengembalikan cek yang gagal. Http hanya diterima untuk
 * server lokal.
 */
export async function previewProblems(request: APIRequestContext, url: string) {
  const headers = { 'user-agent': WHATSAPP_AGENT }
  const page = await request.get(url, { headers })
  const html = await page.text()
  const imageUrl = readMeta(html)['og:image']
  const image = imageUrl ? await request.get(imageUrl, { headers }) : null
  return previewChecks({
    page: { status: page.status(), headers: page.headers(), html },
    image: image && {
      status: image.status(),
      headers: image.headers(),
      bytes: new Uint8Array(await image.body()),
    },
    allowHttp: isLocalUrl(url),
  }).filter((check) => !check.ok)
}
