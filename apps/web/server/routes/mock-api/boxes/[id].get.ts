export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return getMockBox(event, getRouterParam(event, 'id') ?? '')
})
