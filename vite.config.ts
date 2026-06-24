import { defineConfig } from 'vitest/config';

/*
 * `base` must match the GitHub Pages project path ('/<repo-name>/') or every
 * asset URL breaks on deploy. Multi-page inputs and the React plugin are added
 * in a later build step; the base lives here from the start so the demos are
 * built base-aware throughout.
 */
export default defineConfig({
  base: '/lit-nutrition-facts/',
  test: {
    // Pure logic and controller specs run in node; fetch and AbortController are
    // global in Node 20+, so no jsdom is needed for the unit suites.
    environment: 'node',
  },
});
