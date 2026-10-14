export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return getMockBoxForRecipient(event, getRouterParam(event, 'slug') ?? '')
})
