import { describe, expect, it } from 'vitest'
import { PHOTO_MAX_SIDE, idealPhotoSize, ratioLabel } from '../app/utils/front-image'

describe('saran ukuran foto depan', () => {
  it('rasio bentuk kartu dengan sisi panjang sebesar yang disimpan', () => {
    expect(idealPhotoSize(0.75)).toEqual({ width: 1536, height: PHOTO_MAX_SIDE })
    expect(idealPhotoSize(1)).toEqual({ width: PHOTO_MAX_SIDE, height: PHOTO_MAX_SIDE })
    expect(idealPhotoSize(1.3333)).toEqual({ width: PHOTO_MAX_SIDE, height: 1536 })
  })

  it('rasio ditulis dengan bilangan bulat kecil', () => {
    expect(ratioLabel(0.75)).toBe('3:4')
    expect(ratioLabel(1)).toBe('1:1')
    expect(ratioLabel(1.3333)).toBe('4:3')
    expect(ratioLabel(16 / 9)).toBe('16:9')
  })
})
