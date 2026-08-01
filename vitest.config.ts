import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const alias = { '@': resolve(rootDir, 'src') };

export default defineConfig({
  resolve: { alias },
  test: {
    globals: false,
    projects: [
      {
        resolve: { alias },
        test: {
          // core/ is tested in node deliberately: if a pure module ever reaches
          // for a DOM global, it fails here rather than passing under jsdom.
          name: 'core',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
          css: true,
        },
      },
    ],
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
