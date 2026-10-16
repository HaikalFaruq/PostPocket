// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Mesin gambar Hairline disalin apa adanya dari sumbernya (lihat docs/assets.md). Hasil
  // Playwright berisi skrip dari trace yang sedang ditulis.
  { ignores: ['app/utils/hairline/kernel.js', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['app/components/**/*.vue'],
    rules: {
      // Nama komponen mengikuti PRD (Modal, Swatch) dan tidak bentrok dengan elemen HTML.
      'vue/multi-word-component-names': ['error', { ignores: ['Icon', 'Modal', 'Swatch'] }],
    },
  },
  {
    rules: {
      // Format template diurus Prettier.
      'vue/html-self-closing': 'off',
    },
  },
)
