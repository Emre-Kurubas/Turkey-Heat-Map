import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(rootDir, 'src') } },
  css: {
    // Deterministic class names, so snapshots stay stable and a consumer can
    // target a class without guessing at a build-specific hash.
    modules: { generateScopedName: 'hm-[local]-[hash:base64:5]' },
  },
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
