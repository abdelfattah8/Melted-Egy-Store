import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // seed.jsx is a Node.js script, not a browser file
  {
    files: ['seed.jsx'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // Playwright E2E specs run in Node (helpers also touch the browser via page.evaluate)
  {
    files: ['e2e/**/*.{js,mjs}', 'playwright.config.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
])
