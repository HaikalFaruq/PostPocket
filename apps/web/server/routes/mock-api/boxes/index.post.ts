export default defineEventHandler(async (event) => {
  assertMockEnabled(event)
  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object')
    return fail(event, 400, 'invalid_request', 'body bukan JSON')
  return createMockBox(event, body)
})
