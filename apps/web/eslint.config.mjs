// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
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
