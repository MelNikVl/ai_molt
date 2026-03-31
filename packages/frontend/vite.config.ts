import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 47778,
    proxy: {
      '/api': 'http://localhost:47777'
    }
  },
  build: {
    outDir: '../backend/public',
    emptyOutDir: true
  }
});
