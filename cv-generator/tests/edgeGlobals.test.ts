import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// La fonction Supabase (Deno) n'a pas les variables globales de Node : Buffer doit être importé de « node:buffer ».
// Sans cet import, tout marche en local (Node) mais plante en ligne : c'est ce qui a cassé le partage du CV et le portfolio.
describe('code serveur compatible avec la fonction en ligne', () => {
  const dir = join(import.meta.dirname, '..', 'server');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !['index.ts', 'migrate.ts'].includes(f));
  it.each(files)('%s importe Buffer avant de s’en servir', (f) => {
    const src = readFileSync(join(dir, f), 'utf8');
    if (/\bBuffer\b/.test(src)) expect(src).toMatch(/import \{[^}]*\bBuffer\b[^}]*\} from 'node:buffer'/);
  });
});
