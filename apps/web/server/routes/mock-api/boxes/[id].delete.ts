export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return deleteMockBox(event, getRouterParam(event, 'id') ?? '')
})
