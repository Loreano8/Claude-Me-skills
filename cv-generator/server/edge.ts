// Fonction Supabase (Deno) : même serveur que server/index.ts, sans mise en veille.
// Les réglages (clés secrètes…) sont lus dans la table privée cvstudio.settings.
import pg from 'pg';
import { createServer, type Settings } from './config.ts';

declare const Deno: {
  env: { get(key: string): string | undefined; toObject(): Record<string, string> };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

async function loadSettings(): Promise<Settings> {
  const url = Deno.env.get('SUPABASE_DB_URL');
  if (!url) return {};
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ key: string; value: string }>('select key, value from cvstudio.settings');
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } finally {
    await client.end();
  }
}

// Construit une seule fois par instance, au premier appel.
let server: Promise<(req: Request) => Response | Promise<Response>> | null = null;

function handler(): Promise<(req: Request) => Response | Promise<Response>> {
  server ??= (async () => {
    const settings = { NODE_ENV: 'production', ...Deno.env.toObject(), ...(await loadSettings()) };
    const { app, summary } = await createServer(settings);
    console.log(`CV Studio (fonction Supabase) — ${summary}`);
    return app.fetch;
  })().catch((error) => {
    server = null;
    throw error;
  });
  return server;
}

Deno.serve(async (req) => (await handler())(req));
