import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': resolve(rootDir, 'src') } },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      exclude: [
        'src/core/**/*.test.ts',
        'src/core/**/__fixtures__/**',
        'src/core/**/performance.test.ts',
        // Type-only modules compile to nothing; they report 0/0 and only add noise.
        'src/core/types/**',
        // Barrels are re-export manifests with no logic. Bad re-exports are
        // caught by tsc and by the public-surface test in src/index.test.ts.
        'src/core/**/index.ts',
      ],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
      reporter: ['text', 'html'],
    },
  },
});
