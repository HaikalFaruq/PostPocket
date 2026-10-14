import { kotak } from '@postpocket/presets'
import { describe, expect, it } from 'vitest'
import {
  FOLDER_HEADROOM,
  createArtJob,
  fanSlot,
  hashString,
  openRoom,
  rng,
} from '../app/utils/folder-art'

function finish(width: number, height: number, seed: number, recipe = kotak.folders[0]!) {
  const job = createArtJob(width, height, recipe, seed)
  let steps = 0
  while (!job.step()) steps++
  return { job, steps }
}

describe('seni folder kaca', () => {
  it('selesai bertahap dan setiap piksel terisi tidak transparan', () => {
    const { job, steps } = finish(60, 48, 3)
    expect(job.width).toBe(60)
    expect(job.height).toBe(48)
    // Dikerjakan dalam beberapa potong, bukan satu tugas panjang.
    expect(steps).toBeGreaterThan(5)
    for (let i = 3; i < job.pixels.length; i += 4) expect(job.pixels[i]).toBe(255)
    // step() setelah selesai tetap aman dan tidak mengubah apa pun.
    const before = job.pixels.slice()
    expect(job.step()).toBe(true)
    expect(job.pixels).toEqual(before)
  })

  it('semai yang sama memberi gambar yang sama, semai lain memberi gambar lain', () => {
    const a = finish(40, 32, 7).job.pixels
    const b = finish(40, 32, 7).job.pixels
    const c = finish(40, 32, 8).job.pixels
    expect(b).toEqual(a)
    expect(c).not.toEqual(a)
  })

  it.each(kotak.folders.map((folder) => [folder.id, folder] as const))(
    'resep %s memakai warna yang beragam',
    (_, recipe) => {
      const { job } = finish(48, 40, 1, recipe)
      const colors = new Set<number>()
      for (let i = 0; i < job.pixels.length; i += 4) {
        colors.add(
          (job.pixels[i]! >> 4) * 256 + (job.pixels[i + 1]! >> 4) * 16 + (job.pixels[i + 2]! >> 4),
        )
      }
      expect(colors.size).toBeGreaterThan(12)
    },
  )
})

describe('alat bantu', () => {
  it('rng dan hashString bisa diulang', () => {
    const first = rng(42)
    const second = rng(42)
    expect([first(), first(), first()]).toEqual([second(), second(), second()])
    expect(hashString('kotak-1')).toBe(hashString('kotak-1'))
    expect(hashString('kotak-1')).not.toBe(hashString('kotak-2'))
  })

  it('fanSlot menyebar dari kiri ke kanan', () => {
    expect(fanSlot(0, 1)).toBe(0)
    expect([0, 1, 2].map((index) => fanSlot(index, 3))).toEqual([-1, 0, 1])
  })

  it('openRoom memberi ruang untuk kipas yang terbuka, tidak pernah kurang dari tertutup', () => {
    expect(openRoom(0)).toBe(FOLDER_HEADROOM)
    expect(openRoom(1)).toBe(FOLDER_HEADROOM)
    // Lembar paling belakang naik 96 + 30 per lapis, plus 38 untuk sorotan dan kemiringan.
    expect([2, 3, 4].map(openRoom)).toEqual([68, 98, 128])
  })
})
