import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  entry: { index: 'src/index.ts' },
  format: 'esm',
  // The action runs `dist/index.mjs` without an install step, so the bundle contains its dependencies.
  noExternal: [/.*/],
})
