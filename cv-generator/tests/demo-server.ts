import type { LetterTranslateRequest } from '../shared/schema.ts';
import { createVault } from '../server/vault.ts';
import { createRecovery } from '../server/recovery.ts';
// Serveur de démonstration (npm run demo) : vraie base Postgres en mémoire, IA et paiement simulés.
// Permet d’essayer comptes, crédits et achat sans clé API ni compte FedaPay.
import { serve } from '@hono/node-server';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { createPayments } from '../server/payments.ts';
import { createTestimonials } from '../server/testimonials.ts';
import { createSources } from '../server/sources.ts';
import { createShares } from '../server/shares.ts';
import { createWatches, type WatchSearch } from '../server/watch.ts';

// Veille emploi de démonstration : offres fictives (aucune recherche réelle, aucun nom de personne).
const demoSearch: WatchSearch = async (criteria) => {
  await new Promise((r) => setTimeout(r, 1500));
  const job = criteria.jobs[0] ?? 'Comptable';
  const mk = (n: number, company: string, location: string, contract: string, salary: string, skills: string[], beninEligible: 'oui' | 'à vérifier' = 'oui') => ({
    title: n === 1 ? job : n === 2 ? `${job} junior` : `Assistant ${job.toLowerCase()}`,
    company,
    location,
    contract,
    salary,
    experience: n === 2 ? '0 à 2 ans' : '2 ans',
    beninEligible,
    deadline: n === 3 ? '' : `${20 + n}/12/2026`,
    url: `https://emplois.example.com/offre/${Date.now()}-${n}`,
    summary: 'Tenue de la comptabilité générale, préparation de la paie et des déclarations fiscales.',
    skills,
  });
  return {
    note: '3 nouvelles offres correspondent à vos critères.',
    offers: [
      mk(1, 'Société de logistique', 'Cotonou, Bénin', 'CDI', '250 000 FCFA / mois', ['Excel', 'Sage', 'Paie', 'Fiscalité']),
      mk(2, 'Cabinet d’expertise comptable', 'Abomey-Calavi, Bénin', 'CDD 12 mois', '', ['Excel', 'Saisie comptable', 'Rigueur']),
      mk(3, 'ONG internationale', 'Lomé, Togo', 'CDD', '', ['Anglais', 'Excel', 'Rapports financiers'], 'à vérifier'),
    ],
  };
};
import { createSupport } from '../server/support.ts';
import { testDb } from './pglite.ts';
import { createAmbassadors } from '../server/ambassadors.ts';
import { sampleAdapt, sampleInterview, sampleLetter, sampleRevise, sampleTemplateAnalysis, sampleTranslation, sampleClarify, sampleTranscript, sampleStyle, sampleLetterQuestions, sampleKeywords } from './fixtures.ts';
const db = await testDb();
const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 0 });
const ambassadors = createAmbassadors(db);
const paid = new Set<string>();
const payments = createPayments(db, accounts, {
  name: 'fedapay',
  createCheckout: async () => ({ ref: 'tx42', url: 'http://localhost:8787/fake-pay?id=tx42' }),
  fetchStatus: async (ref) => (paid.has(ref) ? 'approved' : 'pending'),
}, ambassadors);
// DEMO_DELAY_MS : simule le temps de réponse réel (vidéos de démonstration).
const wait = () => new Promise((r) => setTimeout(r, Number(process.env.DEMO_DELAY_MS ?? 0)));
const anonymous = (cv: typeof sampleAdapt.cv) => {
  const copy = structuredClone(cv);
  copy.personal = { ...copy.personal, firstName: 'Prénom', lastName: 'Nom', email: 'prenom.nom@email.com', linkedin: '' };
  return copy;
};
const ai = {
  // CV de démonstration sans nom de personne réelle (vidéos et captures).
  structure: async () => (await wait(), ({ cv: anonymous(sampleAdapt.cv), suggestions: ['Ajoutez un lien LinkedIn'], language: 'fr' as const })),
  // Version adaptée qui diffère vraiment du CV de départ (titre, une réalisation, une compétence), pour la revue des modifications.
  adapt: async () => {
    await wait();
    const cv = anonymous(sampleAdapt.cv);
    cv.personal.title = 'Responsable comptable SYSCOHADA';
    cv.experiences[0].achievements = ['Tenir la comptabilité selon le SYSCOHADA révisé et préparer les clôtures mensuelles', ...cv.experiences[0].achievements];
    cv.skills = [...cv.skills, 'Clôtures mensuelles'];
    return { ...sampleAdapt, cv };
  },
  coverLetter: async () => (await wait(), sampleLetter),
  translate: async () => (await wait(), sampleTranslation),
  interview: async () => (await wait(), sampleInterview),
  revise: async () => (await wait(), sampleRevise),
  analyzeTemplate: async () => (await wait(), sampleTemplateAnalysis),
  clarify: async () => (await wait(), sampleClarify),
  keywords: async () => (await wait(), sampleKeywords),
  transcribe: async () => (await wait(), sampleTranscript),
  style: async () => (await wait(), sampleStyle),
  letterQuestions: async () => (await wait(), sampleLetterQuestions),
  translateLetter: async (req: LetterTranslateRequest) => (
    await wait(),
    {
      language: req.targetLang,
      recipientName: req.letter.recipientName,
      recipientCompany: req.letter.recipientCompany,
      recipientAddress: req.letter.recipientAddress,
      subject: req.targetLang === 'en' ? 'Application for the position of Accountant' : 'Candidature au poste de Comptable',
      salutation: req.targetLang === 'en' ? 'Dear Hiring Manager,' : 'Madame, Monsieur,',
      paragraphs: req.letter.paragraphs.map((p: string) => (req.targetLang === 'en' ? `[EN] ${p}` : `[FR] ${p}`)),
      closing: req.targetLang === 'en' ? 'Yours sincerely,' : 'Je vous prie d’agréer, Madame, Monsieur, mes salutations distinguées.',
    }
  ),
};
// E-mails simulés : le code s'affiche dans la console du serveur de démo.
const support = createSupport(db, async (t) => console.log('[notification]', t));
const vault = createVault(db, accounts, async (to, subject, text) => console.log('[e-mail]', to, subject, text.replace(/\n/g, ' ')));
const app = createApp({ ai, accounts, payments, ambassadors, vault, testimonials: createTestimonials(db), support, recovery: createRecovery(db, accounts, support), sources: createSources(db), shares: createShares(db), watches: createWatches(db, accounts, demoSearch, null, 'http://localhost:5173'), cronSecret: 'demo', sessionSecret: 'dev', adminToken: 'demo', publicUrl: 'http://localhost:5173', allowedOrigins: [], rateLimitPerHour: 100 });
// Fausse page de paiement : « payer » puis revenir comme le ferait FedaPay.
app.get('/fake-pay', (c) => { paid.add(c.req.query('id')!); return c.redirect(`/api/payments/return?id=${c.req.query('id')}&status=approved`); });
// Démo seulement : donne à un ambassadeur validé quelques filleuls et des gains, pour les vidéos.
app.post('/demo/seed-ambassador', async (c) => {
  const { identifier } = await c.req.json();
  const [u] = await db.query<{ id: number }>('select id from users where identifier = $1', [identifier]);
  await db.query(`update ambassadors set status = 'active', activated_at = now() - interval '40 days', decided_at = now() where user_id = $1`, [u.id]);
  const rows: [string, number, number][] = [['signup', 50, -20], ['signup', 50, -20], ['signup', 50, -18], ['first_purchase', 100, -17], ['commission', 50, -17], ['first_purchase', 100, -16], ['commission', 150, -16], ['first_purchase', 100, -15], ['commission', 50, -15], ['first_purchase', 100, -10], ['commission', 150, -10], ['first_purchase', 100, -3], ['commission', 50, -3]];
  let n = 0;
  for (const [kind, amount, days] of rows) {
    const [f] = await db.query<{ id: number }>(`insert into users (identifier, name, password_hash, credits, referred_by) values ($1, 'Ami', 'x', 0, $2) returning id`, ['ami' + Date.now() + n++ + '@email.com', u.id]);
    await db.query(`insert into ambassador_earnings (ambassador_id, filleul_id, kind, amount, status, available_at, created_at) values ($1, $2, $3, $4, 'pending', now() + ($5 || ' days')::interval + interval '14 days', now() + ($5 || ' days')::interval)`, [u.id, f.id, kind, amount, String(days)]);
  }
  return c.json({ ok: true });
});
serve({ fetch: app.fetch, port: 8787 }, () => console.log('e2e server ready'));
