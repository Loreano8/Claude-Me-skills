// Serveur Node : développement local, tests, ou hébergement classique (Render…).
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createServer } from './config.ts';

try {
  process.loadEnvFile();
} catch {
  // Pas de fichier .env : on utilise les variables d'environnement déjà définies.
}

const port = Number(process.env.PORT ?? 8787);
const { app, summary } = await createServer(process.env);

// En production, le même serveur sert aussi le site web compilé (dossier dist).
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

serve({ fetch: app.fetch, port }, () => console.log(`API CV Studio sur http://localhost:${port} — ${summary}`));
