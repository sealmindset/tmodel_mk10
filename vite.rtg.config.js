import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Dedicated Vite config for RTG client bundle
export default defineConfig({
  root: 'client/rtg',
  build: {
    outDir: '../../public/js',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'client/rtg/index.jsx'),
      output: {
        entryFileNames: 'rtg-ui.bundle.js',
        assetFileNames: 'rtg-ui.[name][extname]'
      }
    }
  },
  plugins: [react()]
});
