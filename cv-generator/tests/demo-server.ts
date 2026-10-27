// Serveur de démonstration (npm run demo) : vraie base Postgres en mémoire, IA et paiement simulés.
// Permet d’essayer comptes, crédits et achat sans clé API ni compte FedaPay.
import { serve } from '@hono/node-server';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { createPayments } from '../server/payments.ts';
import { createTestimonials } from '../server/testimonials.ts';
import { createSupport } from '../server/support.ts';
import { testDb } from './pglite.ts';
import { sampleAdapt, sampleInterview, sampleLetter, sampleRevise, sampleTemplateAnalysis, sampleTranslation, sampleClarify } from './fixtures.ts';
const db = await testDb();
const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 0 });
const paid = new Set<string>();
const payments = createPayments(db, accounts, {
  name: 'fedapay',
  createCheckout: async () => ({ ref: 'tx42', url: 'http://localhost:8787/fake-pay?id=tx42' }),
  fetchStatus: async (ref) => (paid.has(ref) ? 'approved' : 'pending'),
});
const ai = {
  structure: async () => ({ cv: sampleAdapt.cv, suggestions: ['Ajoutez un lien LinkedIn'], language: 'fr' as const }),
  adapt: async () => sampleAdapt,
  coverLetter: async () => sampleLetter,
  translate: async () => sampleTranslation,
  interview: async () => sampleInterview,
  revise: async () => sampleRevise,
  analyzeTemplate: async () => sampleTemplateAnalysis,
  clarify: async () => sampleClarify,
};
const app = createApp({ ai, accounts, payments, testimonials: createTestimonials(db), support: createSupport(db, async (t) => console.log('[notification]', t)), sessionSecret: 'dev', adminToken: 'demo', publicUrl: 'http://localhost:5173', allowedOrigins: [], rateLimitPerHour: 100 });
// Fausse page de paiement : « payer » puis revenir comme le ferait FedaPay.
app.get('/fake-pay', (c) => { paid.add(c.req.query('id')!); return c.redirect(`/api/payments/return?id=${c.req.query('id')}&status=approved`); });
serve({ fetch: app.fetch, port: 8787 }, () => console.log('e2e server ready'));
