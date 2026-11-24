import { defineConfig } from 'tsup'

// Library build: ESM + types, no Node built-ins, so it runs in the browser and Node.
export default defineConfig({
  entry: {
    index: 'src/illustration/index.ts',
    core: 'src/illustration/core/index.ts',
    react: 'src/illustration/react/index.ts',
  },
  format: ['esm'],
  dts: true,
  platform: 'neutral',
  target: 'es2022',
  clean: true,
  splitting: true,
  external: ['react', 'react/jsx-runtime'],
})
