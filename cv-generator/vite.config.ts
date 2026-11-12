/// <reference types="vitest/config" />
import { copyFileSync, createReadStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Politique de contenu, ajoutée seulement à la construction (le mode développement de Vite a besoin de scripts en ligne) :
// le navigateur n'exécute que le code du site et ne parle qu'à notre serveur.
const apiOrigin = (() => {
  try {
    return new URL(process.env.VITE_API_URL ?? '').origin;
  } catch {
    return 'https://clgmqhyzyiswnekmoygw.supabase.co';
  }
})();
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  `connect-src 'self' ${apiOrigin} blob: data:`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const csp = (): Plugin => ({
  name: 'cvcasa-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta name="theme-color"', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="theme-color"`),
});

// Moteur de détourage de la photo (MediaPipe) : servi depuis node_modules en développement, copié dans le site à la construction.
const MEDIAPIPE = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];
const mediapipeDir = join(import.meta.dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
const mediapipe = (): Plugin => ({
  name: 'cvcasa-mediapipe',
  configureServer(server) {
    server.middlewares.use('/mediapipe/', (req, res, next) => {
      const file = MEDIAPIPE.find((f) => req.url?.startsWith(`/${f}`));
      if (!file) return next();
      res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
      createReadStream(join(mediapipeDir, file)).pipe(res);
    });
  },
  writeBundle(options) {
    const out = join(options.dir ?? 'dist', 'mediapipe');
    mkdirSync(out, { recursive: true });
    for (const f of MEDIAPIPE) copyFileSync(join(mediapipeDir, f), join(out, f));
  },
});

export default defineConfig({
  // Chemins relatifs : le même build marche sur un domaine, dans un sous-dossier (GitHub Pages) et dans l'appli Android.
  base: './',
  plugins: [react(), tailwindcss(), csp(), mediapipe()],
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
