import type { LetterContent } from '@postpocket/presets'
import { describe, expect, it } from 'vitest'
import { boxRoom, letterPhotoCount, roomProblem } from '../app/utils/box-room'

const limits = { letters: 20, photos: 40 }

function content(photos: (string | null)[], text = 'Halo'): LetterContent {
  return {
    version: 1,
    elements: [
      ...photos.map((photo, index) => ({
        kind: 'photo' as const,
        id: `p${index}`,
        x: 0.5,
        y: 0.3,
        width: 0.5,
        rotation: 0,
        photo,
        aspect: 1,
      })),
      {
        kind: 'text',
        id: 't1',
        x: 0.5,
        y: 0.8,
        width: 0.8,
        rotation: 0,
        text,
        size: 0.06,
        align: 'center',
      },
    ],
  }
}

describe('sisa tempat kotak bareng', () => {
  it('menghitung surat dan foto yang masih muat, tidak pernah negatif', () => {
    expect(boxRoom(limits, { letters: 8, photos: 33 })).toEqual({ letters: 12, photos: 7 })
    expect(boxRoom(limits, { letters: 21, photos: 45 })).toEqual({ letters: 0, photos: 0 })
  })

  it('foto surat dihitung seperti server: gambar depan dari foto ditambah foto isi yang terisi', () => {
    expect(letterPhotoCount(content(['f1', 'f2', null]), false)).toBe(2)
    expect(letterPhotoCount(content(['f1', 'f2', null]), true)).toBe(3)
    expect(letterPhotoCount(content([]), false)).toBe(0)
  })

  it('kotak penuh surat lebih dulu dari foto; foto yang kebanyakan ditolak walau masih ada surat', () => {
    expect(roomProblem({ letters: 0, photos: 10 }, 0)).toBe('letters')
    expect(roomProblem({ letters: 3, photos: 2 }, 3)).toBe('photos')
    expect(roomProblem({ letters: 3, photos: 0 }, 1)).toBe('photos')
    expect(roomProblem({ letters: 3, photos: 0 }, 0)).toBeNull()
    expect(roomProblem({ letters: 1, photos: 5 }, 5)).toBeNull()
  })
})
