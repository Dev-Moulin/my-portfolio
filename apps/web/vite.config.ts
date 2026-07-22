import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { perfCollectorPlugin } from './perfPlugin';

export default defineConfig({
  plugins: [react(), perfCollectorPlugin()],
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
