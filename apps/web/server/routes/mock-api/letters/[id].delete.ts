export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return deleteMockLetter(event, getRouterParam(event, 'id') ?? '')
})
