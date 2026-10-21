// Crée ou met à jour les tables : npm run migrate (DATABASE_URL et DATABASE_SSL dans .env).
import { createPgDb, migrate } from './db.ts';

try {
  process.loadEnvFile();
} catch {
  // Variables déjà définies dans l'environnement.
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquante.');
await migrate(createPgDb(process.env.DATABASE_URL, process.env.DATABASE_SSL === 'true'));
console.log('Tables à jour.');
process.exit(0);
