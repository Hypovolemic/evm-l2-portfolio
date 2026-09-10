import { defineConfig } from 'vite';

/**
 * Built for GitHub Pages at /evm-l2-portfolio/w01/, served from / in dev.
 * Each week's app gets its own subpath so the twelve artefacts can coexist.
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/evm-l2-portfolio/w01/' : '/',
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
}));
