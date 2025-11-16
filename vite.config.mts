import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/wallhaven': {
        target: 'https://wallhaven.cc',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/wallhaven/, ''),
      },
      '/proxy/image': {
        target: 'https://w.wallhaven.cc',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/image/, ''),
      },
    },
  },
});
