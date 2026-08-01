import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// A separate config because the library config's `build.lib` block fights the
// dev server: the playground is an app, not a library entry point.
export default defineConfig({
  root: resolve(rootDir, 'playground'),
  plugins: [react()],
  resolve: { alias: { '@': resolve(rootDir, 'src') } },
  css: { modules: { generateScopedName: 'hm-[local]-[hash:base64:5]' } },
  server: { port: 5175, open: false },
});
