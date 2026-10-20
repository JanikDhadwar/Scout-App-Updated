import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'public/assets']),
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
  {
    files: ['*.cjs'],
    ...js.configs.recommended,
    languageOptions: { sourceType:'commonjs', globals:globals.node },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars':['error',{argsIgnorePattern:'^_',caughtErrorsIgnorePattern:'^_',ignoreRestSiblings:true}] },
  },
  { files:['src/argus/deploy-cache.test.js'], languageOptions:{globals:globals.node} },
])
