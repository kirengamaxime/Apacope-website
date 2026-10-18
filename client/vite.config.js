import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } },
  build: {
    target: 'es2019',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom'], charts: ['recharts'] } },
    },
  },
});
