import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { perfCollectorPlugin } from './perfPlugin';

// HTTPS local (script `dev:https`) : indispensable pour tester sur iOS les API à contexte sécurisé
// (gyroscope/DeviceOrientation refuse le HTTP). Le `dev` normal reste en HTTP (inchangé).
const useHttps = process.env.VITE_HTTPS === '1';

export default defineConfig({
  plugins: [react(), perfCollectorPlugin(), ...(useHttps ? [basicSsl()] : [])],
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
