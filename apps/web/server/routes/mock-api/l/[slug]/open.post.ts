export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return openMockLetter(event, getRouterParam(event, 'slug') ?? '')
})
