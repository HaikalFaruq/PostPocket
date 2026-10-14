import { describe, expect, it } from 'vitest'
import { markRead, readLetters } from '../app/utils/box-read'

/** Penyimpanan palsu seperti localStorage. */
function memory(initial: Record<string, string> = {}): Storage {
  const items = new Map(Object.entries(initial))
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  }
}

describe('surat kotak yang sudah dibuka', () => {
  it('dicatat per kotak dan bertahan di penyimpanan', () => {
    const storage = memory()
    expect([...readLetters('kotakA', storage)]).toEqual([])
    markRead('kotakA', 'surat-1', storage)
    markRead('kotakA', 'surat-2', storage)
    markRead('kotakA', 'surat-1', storage)
    expect([...readLetters('kotakA', storage)]).toEqual(['surat-1', 'surat-2'])
    expect([...readLetters('kotakB', storage)]).toEqual([])
  })

  it('isi yang rusak atau penyimpanan yang menolak tidak membuat halaman gagal', () => {
    expect([
      ...readLetters('kotakA', memory({ 'postpocket:kotak-dibaca:kotakA': '{rusak' })),
    ]).toEqual([])
    expect([
      ...readLetters('kotakA', memory({ 'postpocket:kotak-dibaca:kotakA': '[1,"a"]' })),
    ]).toEqual(['a'])
    const full = memory()
    full.setItem = () => {
      throw new DOMException('penuh', 'QuotaExceededError')
    }
    expect([...markRead('kotakA', 'surat-1', full)]).toEqual(['surat-1'])
    expect([...readLetters('kotakA', undefined)]).toEqual([])
  })
})
