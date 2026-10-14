// Khusus uji E2E: simulasi job pembersihan foto kotak bareng.
export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return deleteMockBoxPhotos(event, getRouterParam(event, 'slug') ?? '')
})
