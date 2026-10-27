import { createVault } from '../server/vault.ts';
import { createRecovery } from '../server/recovery.ts';
// Serveur de démonstration (npm run demo) : vraie base Postgres en mémoire, IA et paiement simulés.
// Permet d’essayer comptes, crédits et achat sans clé API ni compte FedaPay.
import { serve } from '@hono/node-server';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { createPayments } from '../server/payments.ts';
import { createTestimonials } from '../server/testimonials.ts';
import { createSupport } from '../server/support.ts';
import { testDb } from './pglite.ts';
import { sampleAdapt, sampleInterview, sampleLetter, sampleRevise, sampleTemplateAnalysis, sampleTranslation, sampleClarify, sampleTranscript, sampleStyle, sampleLetterQuestions } from './fixtures.ts';
const db = await testDb();
const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 0 });
const paid = new Set<string>();
const payments = createPayments(db, accounts, {
  name: 'fedapay',
  createCheckout: async () => ({ ref: 'tx42', url: 'http://localhost:8787/fake-pay?id=tx42' }),
  fetchStatus: async (ref) => (paid.has(ref) ? 'approved' : 'pending'),
});
// DEMO_DELAY_MS : simule le temps de réponse réel (vidéos de démonstration).
const wait = () => new Promise((r) => setTimeout(r, Number(process.env.DEMO_DELAY_MS ?? 0)));
const ai = {
  structure: async () => (await wait(), ({ cv: sampleAdapt.cv, suggestions: ['Ajoutez un lien LinkedIn'], language: 'fr' as const })),
  adapt: async () => (await wait(), sampleAdapt),
  coverLetter: async () => (await wait(), sampleLetter),
  translate: async () => (await wait(), sampleTranslation),
  interview: async () => (await wait(), sampleInterview),
  revise: async () => (await wait(), sampleRevise),
  analyzeTemplate: async () => (await wait(), sampleTemplateAnalysis),
  clarify: async () => (await wait(), sampleClarify),
  transcribe: async () => (await wait(), sampleTranscript),
  style: async () => (await wait(), sampleStyle),
  letterQuestions: async () => (await wait(), sampleLetterQuestions),
};
// E-mails simulés : le code s'affiche dans la console du serveur de démo.
const support = createSupport(db, async (t) => console.log('[notification]', t));
const vault = createVault(db, accounts, async (to, subject, text) => console.log('[e-mail]', to, subject, text.replace(/\n/g, ' ')));
const app = createApp({ ai, accounts, payments, vault, testimonials: createTestimonials(db), support, recovery: createRecovery(db, accounts, support), sessionSecret: 'dev', adminToken: 'demo', publicUrl: 'http://localhost:5173', allowedOrigins: [], rateLimitPerHour: 100 });
// Fausse page de paiement : « payer » puis revenir comme le ferait FedaPay.
app.get('/fake-pay', (c) => { paid.add(c.req.query('id')!); return c.redirect(`/api/payments/return?id=${c.req.query('id')}&status=approved`); });
serve({ fetch: app.fetch, port: 8787 }, () => console.log('e2e server ready'));
