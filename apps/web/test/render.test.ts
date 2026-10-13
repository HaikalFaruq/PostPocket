import { expect, it } from 'vitest'
import { isSoftwareRenderer } from '../app/utils/render'

it('latar kabur dimatikan hanya kalau browser menggambar tanpa GPU', () => {
  expect(
    isSoftwareRenderer('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'),
  ).toBe(false)
  expect(isSoftwareRenderer('Apple GPU')).toBe(false)
  expect(isSoftwareRenderer('Mali-G57 MC2')).toBe(false)
  expect(isSoftwareRenderer('Adreno (TM) 610')).toBe(false)
  expect(
    isSoftwareRenderer(
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
    ),
  ).toBe(true)
  expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true)
  expect(isSoftwareRenderer('Microsoft Basic Render Driver')).toBe(true)
  expect(isSoftwareRenderer(null)).toBe(true)
})
