import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const input = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/*
 * `base` must match the GitHub Pages project path ('/<repo-name>/') or every
 * asset URL breaks on deploy. The build emits two pages: the vanilla showcase
 * and the React consumer. The React plugin only affects react/main.tsx.
 */
export default defineConfig({
  base: '/lit-nutrition-facts/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: input('./index.html'),
        react: input('./react/index.html'),
      },
    },
  },
  test: {
    // Pure logic and controller specs run in node; fetch and AbortController are
    // global in Node 20+. Element specs opt into happy-dom per-file via a
    // docblock. The setup file polyfills attachInternals, which happy-dom lacks.
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
  },
});
