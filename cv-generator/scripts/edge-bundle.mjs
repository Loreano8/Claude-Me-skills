// Prépare supabase/functions/api : copie le code du serveur à côté du point d'entrée de la fonction.
// Usage : npm run edge:bundle, puis supabase functions deploy api --no-verify-jwt
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const fn = new URL('../supabase/functions/api/', import.meta.url);
for (const dir of ['server', 'shared']) rmSync(new URL(dir, fn), { recursive: true, force: true });
mkdirSync(new URL('server', fn), { recursive: true });
mkdirSync(new URL('shared', fn), { recursive: true });
for (const f of ['ai.ts', 'app.ts', 'accounts.ts', 'auth.ts', 'config.ts', 'db.ts', 'edge.ts', 'payments.ts', 'prompts.ts']) {
  cpSync(new URL(`../server/${f}`, import.meta.url), new URL(`server/${f}`, fn));
}
cpSync(new URL('../shared/schema.ts', import.meta.url), new URL('shared/schema.ts', fn));
console.log('supabase/functions/api prêt');
