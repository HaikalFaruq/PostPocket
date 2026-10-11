export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return getMockLetter(event, getRouterParam(event, 'slug') ?? '')
})
