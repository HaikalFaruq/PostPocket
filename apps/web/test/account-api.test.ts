import { describe, expect, it, vi } from 'vitest'
import { deleteAccount } from '../app/utils/account-api'
import { LetterApiError } from '../app/utils/letter-api'

const options = (fetch: typeof globalThis.fetch) => ({
  base: 'https://proyek.supabase.co/functions/v1',
  apiKey: 'sb_publishable_x',
  region: 'ap-southeast-2',
  fetch,
  retryDelay: 0,
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('deleteAccount', () => {
  it('DELETE /account membawa publishable key dan sesi login, tanpa body', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 204 }))
    await expect(deleteAccount(options(fetch), 'jwt-user')).resolves.toBeUndefined()
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe(
      'https://proyek.supabase.co/functions/v1/account?forceFunctionRegion=ap-southeast-2',
    )
    expect(init?.method).toBe('DELETE')
    expect(init?.body).toBeUndefined()
    expect(init?.headers).toEqual({ apikey: 'sb_publishable_x', authorization: 'Bearer jwt-user' })
  })

  it('sesi yang tidak berlaku jadi LetterApiError 401', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json(401, { error: { code: 'unauthorized', message: 'sesi tidak berlaku' } }),
    )
    const problem = await deleteAccount(options(fetch), 'lama').catch((error: unknown) => error)
    expect(problem).toBeInstanceOf(LetterApiError)
    expect(problem).toMatchObject({ code: 'unauthorized', status: 401 })
  })

  it('401 dari gateway tanpa body kontrak tetap terbaca statusnya', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(401, { msg: 'Invalid JWT' }))
    await expect(deleteAccount(options(fetch), 'rusak')).rejects.toMatchObject({ status: 401 })
  })

  it('tidak diulang otomatis: menghapus akun bukan request yang aman diulang diam-diam', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('down', { status: 503 }))
    await expect(deleteAccount(options(fetch), 'jwt-user')).rejects.toMatchObject({ status: 503 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
