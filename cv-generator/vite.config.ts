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
// Site public : l'application y lit la fiche des mises à jour (app-update/latest.json).
const siteOrigin = (() => {
  try {
    return new URL(process.env.VITE_PUBLIC_SITE ?? 'https://cvcasa.com').origin;
  } catch {
    return 'https://cvcasa.com';
  }
})();
/** Version du code (commit) : identique pour l'APK compilée sur GitHub et pour le site compilé sur Render. */
export const BUILD_ID = (process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || 'dev').slice(0, 12);
export const CSP = [
  "default-src 'self'",
  // Vérification anti-robot (Cloudflare Turnstile) : son script et son cadre, sur l'inscription et le contact.
  "script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  `connect-src 'self' ${apiOrigin} ${siteOrigin} https://challenges.cloudflare.com blob: data:`,
  "frame-src https://challenges.cloudflare.com",
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
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  test: {
    environment: 'node',
    // La base Postgres en mémoire (PGlite) met quelques secondes à démarrer.
    testTimeout: 30_000,
  },
});
