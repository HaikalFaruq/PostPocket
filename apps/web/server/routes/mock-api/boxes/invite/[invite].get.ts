export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return getMockBoxInvite(event, getRouterParam(event, 'invite') ?? '')
})
