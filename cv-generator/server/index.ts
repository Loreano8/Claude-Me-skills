import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import Anthropic from '@anthropic-ai/sdk';
import { createAi, DEFAULT_MODEL } from './ai.ts';
import { createApp } from './app.ts';

try {
  process.loadEnvFile();
} catch {
  // Pas de fichier .env : on utilise les variables d'environnement déjà définies.
}

const port = Number(process.env.PORT ?? 8787);
const model = process.env.CLAUDE_MODEL || DEFAULT_MODEL;
const ai = process.env.ANTHROPIC_API_KEY ? createAi(new Anthropic(), model) : null;

const app = createApp({
  ai,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,https://localhost,capacitor://localhost')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  rateLimitPerHour: Number(process.env.RATE_LIMIT_PER_HOUR ?? 30),
});

// En production, le même serveur sert aussi le site web compilé (dossier dist).
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`API CV Studio sur http://localhost:${port} — IA ${ai ? `active (${model})` : 'désactivée : ANTHROPIC_API_KEY manquante'}`);
});
