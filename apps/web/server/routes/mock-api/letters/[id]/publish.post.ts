export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return publishMockLetter(event, getRouterParam(event, 'id') ?? '')
})
