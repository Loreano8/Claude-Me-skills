// Serveur de démonstration (npm run demo) : vraie base Postgres en mémoire, IA et paiement simulés.
// Permet d’essayer comptes, crédits et achat sans clé API ni compte FedaPay.
import { serve } from '@hono/node-server';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { createPayments } from '../server/payments.ts';
import { testDb } from './pglite.ts';
import { sampleAdapt, sampleLetter, sampleTranslation } from './fixtures.ts';
const db = await testDb();
const accounts = createAccounts(db, { freeCredits: 1, maxFreeSignupsPerIp: 10 });
const paid = new Set<string>();
const payments = createPayments(db, accounts, {
  name: 'fedapay',
  createCheckout: async () => ({ ref: 'tx42', url: 'http://localhost:8787/fake-pay?id=tx42' }),
  fetchStatus: async (ref) => (paid.has(ref) ? 'approved' : 'pending'),
});
const ai = {
  structure: async () => ({ cv: sampleAdapt.cv, suggestions: ['Ajoutez un lien LinkedIn'] }),
  adapt: async () => sampleAdapt,
  coverLetter: async () => sampleLetter,
  translate: async () => sampleTranslation,
};
const app = createApp({ ai, accounts, payments, sessionSecret: 'dev', publicUrl: 'http://localhost:5173', allowedOrigins: [], rateLimitPerHour: 100 });
// Fausse page de paiement : « payer » puis revenir comme le ferait FedaPay.
app.get('/fake-pay', (c) => { paid.add(c.req.query('id')!); return c.redirect(`/api/payments/return?id=${c.req.query('id')}&status=approved`); });
serve({ fetch: app.fetch, port: 8787 }, () => console.log('e2e server ready'));
