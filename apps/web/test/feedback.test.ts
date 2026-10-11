import { describe, expect, it } from 'vitest'
import { DEFAULT_FEEDBACK_URL, feedbackHref, feedbackText, safePath } from '../app/utils/feedback'

describe('laporan tester', () => {
  it('slug surat disamarkan supaya link surat tidak ikut terkirim', () => {
    expect(safePath('/l/Om6Cgh2DWU')).toBe('/l/…')
    expect(safePath('/l/Om6Cgh2DWU/')).toBe('/l/…/')
    expect(safePath('/letter/new')).toBe('/letter/new')
  })

  it('isi laporan memuat halaman, versi, dan perangkat; kanal publik diberi peringatan', () => {
    const text = feedbackText({
      path: '/l/Om6Cgh2DWU',
      version: 'abc1234',
      device: 'Mozilla/5.0 (Linux; Android 14)',
      isPublic: true,
    })
    expect(text).toContain('bisa dibaca publik')
    expect(text).toContain('Halaman: /l/…')
    expect(text).toContain('Versi: abc1234')
    expect(text).toContain('Perangkat: Mozilla/5.0 (Linux; Android 14)')
    expect(text).not.toContain('Om6Cgh2DWU')
    const privateText = feedbackText({ path: '/', version: 'x', device: 'y', isPublic: false })
    expect(privateText).not.toContain('publik')
  })

  it('isi laporan di-encode ke tempat {pesan}', () => {
    expect(feedbackHref('https://wa.me/62811?text={pesan}', 'Halo & #1')).toBe(
      'https://wa.me/62811?text=Halo%20%26%20%231',
    )
    expect(feedbackHref(DEFAULT_FEEDBACK_URL, '')).toMatch(/issues\/new\?title=.*&body=$/)
  })
})
