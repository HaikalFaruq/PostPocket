import { describe, expect, it, vi } from 'vitest'
import { createBoxApi } from '../app/utils/box-api'
import { LetterApiError } from '../app/utils/letter-api'

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

function api(responses: Response[]) {
  const run = vi.fn(async () => responses.shift() ?? json(500, {}))
  return {
    run,
    box: createBoxApi({
      base: 'https://proyek.supabase.co/functions/v1/',
      apiKey: 'sb_publishable_x',
      fetch: run as unknown as typeof fetch,
      retryDelay: 0,
      region: 'ap-southeast-2',
    }),
  }
}

const call = (run: ReturnType<typeof vi.fn>, index = 0) => {
  const [url, init] = run.mock.calls[index] as [string, RequestInit]
  return {
    url,
    method: init.method,
    headers: init.headers as Record<string, string>,
    body: init.body,
  }
}

describe('klien kotak bareng', () => {
  it('membuat kotak lewat POST /boxes di region DB', async () => {
    const { run, box } = api([json(201, { id: 'b1', editToken: 't' })])
    await box.create({ title: 'Ultah', to: 'Rani', design: 'par-avion', opensAt: null })
    expect(call(run)).toEqual({
      url: 'https://proyek.supabase.co/functions/v1/boxes?forceFunctionRegion=ap-southeast-2',
      method: 'POST',
      headers: { apikey: 'sb_publishable_x', 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Ultah', to: 'Rani', design: 'par-avion', opensAt: null }),
    })
  })

  it('endpoint pembuat kotak membawa X-Edit-Token, termasuk PATCH dan hapus titipan', async () => {
    const { run, box } = api([json(200, {}), json(200, {}), json(204, null), json(204, null)])
    await box.get('b1', 'tok')
    await box.update('b1', 'tok', { opensAt: '2026-10-20T12:00:00.000Z' })
    await box.removeLetter('b1', 'tok', 'l/1')
    await box.remove('b1', 'tok')
    const calls = run.mock.calls.map((_, index) => call(run, index))
    expect(calls.map((item) => `${item.method} ${item.url.split('/v1')[1]}`)).toEqual([
      'GET /boxes/b1?forceFunctionRegion=ap-southeast-2',
      'PATCH /boxes/b1?forceFunctionRegion=ap-southeast-2',
      'DELETE /boxes/b1/letters/l%2F1?forceFunctionRegion=ap-southeast-2',
      'DELETE /boxes/b1?forceFunctionRegion=ap-southeast-2',
    ])
    for (const item of calls) expect(item.headers['x-edit-token']).toBe('tok')
    expect(calls[1]!.body).toBe(JSON.stringify({ opensAt: '2026-10-20T12:00:00.000Z' }))
  })

  it('halaman titip dan halaman penerima mencoba GET sekali lagi setelah gangguan sesaat', async () => {
    const { run, box } = api([
      json(503, {}),
      json(200, { title: 'Ultah' }),
      json(200, { slug: 'k' }),
    ])
    await expect(box.invite('Ab3dE6gH9jKm')).resolves.toEqual({ title: 'Ultah' })
    await expect(box.forRecipient('x7Kp2qLm9A')).resolves.toEqual({ slug: 'k' })
    expect(call(run, 0).url).toContain('/boxes/invite/Ab3dE6gH9jKm')
    expect(call(run, 2).url).toContain('/k/x7Kp2qLm9A')
  })

  it('kotak yang dibuka penerima dicatat lagi setelah gangguan sesaat', async () => {
    const { run, box } = api([json(503, {}), json(200, { openedAt: 'a', photosExpireAt: 'b' })])
    await expect(box.open('x7Kp2qLm9A')).resolves.toEqual({ openedAt: 'a', photosExpireAt: 'b' })
    expect(run).toHaveBeenCalledTimes(2)
    for (const index of [0, 1]) {
      expect(call(run, index).method).toBe('POST')
      expect(call(run, index).url).toContain('/k/x7Kp2qLm9A/open')
    }
  })

  it('error dari kontrak jadi LetterApiError dengan kodenya', async () => {
    const { box } = api([
      json(409, { error: { code: 'box_not_open', message: 'belum' } }),
      json(404, { error: { code: 'box_not_found', message: 'tidak ada' } }),
    ])
    await expect(box.open('x7Kp2qLm9A')).rejects.toMatchObject({
      code: 'box_not_open',
      status: 409,
    })
    const missing = await box.invite('Ab3dE6gH9jKm').catch((problem: unknown) => problem)
    expect(missing).toBeInstanceOf(LetterApiError)
    expect(missing).toMatchObject({ code: 'box_not_found' })
  })
})
