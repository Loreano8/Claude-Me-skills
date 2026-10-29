// Fonction Supabase (Deno) : même serveur que server/index.ts, sans mise en veille.
// Les réglages (clés secrètes…) sont lus dans la table privée cvstudio.settings.
import { createServer, type Settings } from './config.ts';
import { createPgDb, type Db } from './db.ts';

declare const Deno: {
  env: { get(key: string): string | undefined; toObject(): Record<string, string> };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

// Une seule connexion à la base, ouverte avec l'adresse fournie par Supabase puis restreinte
// à l'utilisateur de l'application et à son schéma privé.
async function connect(): Promise<{ db: Db | undefined; settings: Settings }> {
  const url = Deno.env.get('SUPABASE_DB_URL');
  if (!url) return { db: undefined, settings: {} };
  const db = createPgDb(url, false, '-c role=cvstudio_app -c search_path=cvstudio');
  const rows = await db.query<{ key: string; value: string }>('select key, value from settings');
  return { db, settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}

// Construit une seule fois par instance, au premier appel.
let server: Promise<(req: Request) => Response | Promise<Response>> | null = null;

function handler(): Promise<(req: Request) => Response | Promise<Response>> {
  server ??= (async () => {
    const { db, settings } = await connect();
    // Les tables existent déjà : pas de vérification à chaque démarrage (npm run migrate pour les mettre à jour).
    const { app, summary } = await createServer({ NODE_ENV: 'production', ...Deno.env.toObject(), ...settings }, { db, migrate: false });
    console.log(`CVCasa (fonction Supabase) — ${summary}`);
    return app.fetch;
  })().catch((error) => {
    server = null;
    throw error;
  });
  return server;
}

Deno.serve(async (req) => (await handler())(req));
