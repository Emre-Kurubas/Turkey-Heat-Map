import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': resolve(rootDir, 'src') } },
  build: {
    lib: {
      entry: resolve(rootDir, 'src/index.ts'),
      name: 'TurkiyeSucHaritasi',
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs'),
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: { assetFileNames: 'style.css' },
    },
    sourcemap: true,
    target: 'es2022',
  },
});
