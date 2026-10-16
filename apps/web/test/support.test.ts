import { describe, expect, it } from 'vitest'
import { postmarkDate, SUPPORT_URL } from '../app/utils/support'

describe('dukungan Sociabuzz', () => {
  it('membuka halaman PostPocket di Sociabuzz lewat https', () => {
    const url = new URL(SUPPORT_URL)
    expect(url.protocol).toBe('https:')
    expect(url.hostname).toBe('sociabuzz.com')
    expect(url.pathname).toBe('/byhund/tribe')
  })

  it('tanggal cap pos memakai bulan Indonesia dan waktu Jakarta', () => {
    expect(postmarkDate(new Date('2026-10-16T03:00:00Z'))).toBe('16 OKT 2026')
    expect(postmarkDate(new Date('2026-05-01T00:00:00Z'))).toBe('1 MEI 2026')
    // 31 Desember 18.00 UTC sudah 1 Januari di Jakarta.
    expect(postmarkDate(new Date('2026-12-31T18:00:00Z'))).toBe('1 JAN 2027')
  })
})
