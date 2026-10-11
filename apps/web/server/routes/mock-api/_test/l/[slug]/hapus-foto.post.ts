// Khusus uji E2E: simulasi job pembersihan foto backend.
export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return deleteMockPhotos(event, getRouterParam(event, 'slug') ?? '')
})
