import { defineConfig } from 'vite';

// base relativa para funcionar em GitHub Pages / qualquer subpasta
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1600 }, // o Phaser sozinho já passa de 1 MB
});
