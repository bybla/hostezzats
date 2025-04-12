import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bot.ts'],
  format: ['cjs'],
  dts: true,
  minify: true,
  clean: true,
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  skipNodeModulesBundle: true,
  esbuildOptions(options) {
    options.external = ['@prisma/client', 'prisma'];
  },
});