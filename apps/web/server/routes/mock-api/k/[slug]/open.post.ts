export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return openMockBox(event, getRouterParam(event, 'slug') ?? '')
})
