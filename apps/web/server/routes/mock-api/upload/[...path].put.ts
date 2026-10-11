// Pengganti URL upload bertanda tangan Supabase Storage: PUT dengan body berkas.
export default defineEventHandler(async (event) => {
  assertMockEnabled(event)
  const path = getRouterParam(event, 'path') ?? ''
  const token = String(getQuery(event).token ?? '')
  const bytes = Buffer.from((await readRawBody(event, false)) ?? [])
  const type = getHeader(event, 'content-type') ?? 'application/octet-stream'
  if (!storeMockUpload(path, token, type, bytes)) {
    return fail(event, 400, 'upload_invalid', 'path atau token upload salah')
  }
  return { Key: `letter-assets/${path}` }
})
