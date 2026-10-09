import { defineConfig } from '@moeru/eslint-config'

export default defineConfig({
  masknet: false,
  perfectionist: true,
  preferArrow: false,
  sonarjs: false,
  sortPackageJsonScripts: false,
  typescript: true,
  unocss: false,
  vue: false,
}, {
  ignores: [
    'dist/**',
    '.worktrees/**',
    'test/fixture/**',
  ],
}, {
  rules: {
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
  },
})
