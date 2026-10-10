// Pengganti URL publik bucket letter-assets.
export default defineEventHandler((event) => {
  assertMockEnabled(event)
  const file = readMockUpload(getRouterParam(event, 'path') ?? '')
  if (!file) throw createError({ statusCode: 404 })
  setHeader(event, 'content-type', file.type)
  setHeader(event, 'cache-control', 'no-store')
  return file.bytes
})
