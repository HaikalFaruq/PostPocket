// Pengganti URL publik bucket letter-assets.
export default defineEventHandler((event) => {
  assertMockEnabled(event)
  const file = readMockUpload(getRouterParam(event, 'path') ?? '')
  if (!file) throw createError({ statusCode: 404 })
  setHeader(event, 'content-type', file.type)
  // Sama dengan objek publik Storage Supabase (cacheControl bawaan 3600 detik), supaya perilaku
  // muat gambar di lokal sama dengan produksi.
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return file.bytes
})
