import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/my-portfolio/' : '/',
  optimizeDeps: {
    exclude: ['@portfolio/overmind-3d', '@portfolio/shared'],
  },
  resolve: {
    dedupe: ['three', 'react', 'react-dom'],
  },
  build: {
    target: 'ES2022',
  },
});
