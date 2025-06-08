import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: 'client/merge',
  build: {
    outDir: '../../public',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'client/merge/index.jsx'),
      output: {
        entryFileNames: 'merge-ui.bundle.js'
      }
    }
  },
  plugins: [react()]
});
