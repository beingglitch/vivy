import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * MV3 needs each entry point as its own IIFE-free ES module at a predictable
 * path, so we build multiple entries with fixed names rather than letting Vite
 * hash them - `manifest.json` references these by name.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    rollupOptions: {
      input: {
        background: resolve(import.meta.dirname, 'src/background.ts'),
        'content-youtube': resolve(import.meta.dirname, 'src/content-youtube.ts'),
        options: resolve(import.meta.dirname, 'src/options.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name][extname]',
        format: 'es',
      },
    },
  },
  plugins: [
    {
      name: 'vivy-copy-static',
      closeBundle() {
        const out = resolve(import.meta.dirname, 'dist');
        mkdirSync(out, { recursive: true });
        for (const file of ['manifest.json', 'options.html']) {
          copyFileSync(resolve(import.meta.dirname, file), resolve(out, file));
        }
      },
    },
  ],
});
