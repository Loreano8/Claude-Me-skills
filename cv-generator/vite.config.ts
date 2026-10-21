/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Chemins relatifs : le même build marche sur un domaine, dans un sous-dossier (GitHub Pages) et dans l'appli Android.
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: 'node',
    // La base Postgres en mémoire (PGlite) met quelques secondes à démarrer.
    testTimeout: 30_000,
  },
});
