import { describe, expect, it } from 'vitest'
import {
  countdown,
  formatDay,
  formatWhen,
  fromLocalInput,
  scheduleRange,
  toLocalInput,
  zoneLabel,
} from '../app/utils/box-time'

describe('waktu kotak bareng', () => {
  it('jadwal ditulis dalam WIB, sama di server dan browser', () => {
    // 12.00 UTC = 19.00 WIB.
    expect(formatWhen('2026-10-20T12:00:00.000Z')).toBe('20 Oktober, 19.00 WIB')
    // 18.30 UTC sudah berganti hari di WIB.
    expect(formatWhen('2026-10-20T18:30:00.000Z')).toBe('21 Oktober, 01.30 WIB')
    expect(formatDay('2026-10-20T18:30:00.000Z')).toBe('21 Okt')
  })

  it('halaman yang hanya dirender di browser memakai zona waktu HP dengan nama Indonesia', () => {
    expect(formatWhen('2026-10-20T12:00:00.000Z', 'Asia/Makassar')).toBe('20 Oktober, 20.00 WITA')
    expect(formatWhen('2026-10-20T12:00:00.000Z', 'Asia/Jayapura')).toBe('20 Oktober, 21.00 WIT')
    expect(formatDay('2026-10-20T16:30:00.000Z', 'Asia/Jayapura')).toBe('21 Okt')
    expect(zoneLabel('Asia/Pontianak')).toBe('WIB')
    // Di luar Indonesia memakai singkatan dari browser, bukan nama IANA-nya.
    const abroad = zoneLabel('Europe/Amsterdam', new Date('2026-10-20T12:00:00Z'))
    expect(abroad).toBeTruthy()
    expect(abroad).not.toBe('Europe/Amsterdam')
  })

  it('hitung mundur memakai satuan terbesar yang berarti', () => {
    const minute = 60_000
    expect(countdown(30_000)).toBe('kurang dari semenit')
    expect(countdown(5 * minute)).toBe('5 menit')
    expect(countdown(60 * minute)).toBe('1 jam')
    expect(countdown(135 * minute)).toBe('2 jam 15 menit')
    expect(countdown(3 * 24 * 60 * minute)).toBe('3 hari')
    expect(countdown((2 * 24 + 3) * 60 * minute + 5 * minute)).toBe('2 hari 3 jam')
  })

  it('nilai datetime-local bolak-balik dalam waktu perangkat, tanpa detik', () => {
    const date = new Date(2026, 9, 20, 19, 5, 42)
    expect(toLocalInput(date)).toBe('2026-10-20T19:05')
    expect(fromLocalInput('2026-10-20T19:05')?.getTime()).toBe(
      new Date(2026, 9, 20, 19, 5).getTime(),
    )
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('besok')).toBeNull()
  })

  it('jadwal yang boleh dipilih: 10 menit lagi sampai 30 hari setelah kotak dibuat', () => {
    const created = Date.UTC(2026, 9, 14)
    const now = created + 60_000
    expect(scheduleRange(created, now)).toEqual({
      min: now + 10 * 60_000,
      max: created + 30 * 24 * 60 * 60_000,
    })
  })
})
