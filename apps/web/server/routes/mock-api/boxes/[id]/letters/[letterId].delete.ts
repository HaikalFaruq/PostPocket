export default defineEventHandler((event) => {
  assertMockEnabled(event)
  return removeMockBoxLetter(
    event,
    getRouterParam(event, 'id') ?? '',
    getRouterParam(event, 'letterId') ?? '',
  )
})
