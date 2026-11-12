import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { Db } from './db.ts';
import { AccountError, type Accounts, type User } from './accounts.ts';
import type { Mailer } from './vault.ts';
import { WATCH_PRICE, type WatchCriteria, type WatchFrequency, type WatchOffer, type WatchRun, type WatchSaveRequest, type WatchState } from '../shared/schema.ts';

export { WATCH_PRICE };

// Veille emploi : la personne coche ses métiers, contrats et zones ; la plateforme cherche de vraies offres sur le web
// (jamais inventées : chaque lien doit venir des résultats de recherche), écarte celles déjà envoyées, et les envoie
// par e-mail et dans l'appli, chaque matin ou chaque semaine.
//
// Coût : chaque recherche web est payante pour CVCasa. Première veille offerte, puis crédits par semaine.
// Les personnes qui ont exactement les mêmes critères partagent la même recherche du jour (cache), ce qui baisse le coût.

/** Une veille lancée à la main, une fois la première offerte utilisée. */
export const WATCH_RUN_COST = 1;
const CACHE_HOURS = 20;
/** Heure d'envoi : 7 h 30 au Bénin (UTC+1, sans heure d'été) = 6 h 30 UTC. */
const SEND_UTC = { h: 6, m: 30 };
const DAY = 24 * 3600 * 1000;

export class WatchError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 402 | 404 | 409 | 502 | 503,
    readonly code = '',
  ) {
    super(message);
  }
}

export type RawOffer = Omit<WatchOffer, 'match' | 'matched' | 'missing'>;
export type WatchSearch = (criteria: WatchCriteria, exclude: string[]) => Promise<{ offers: RawOffer[]; note: string }>;

// ---- Fonctions pures ----------------------------------------------------------

/** Prochain envoi : demain (ou dans 7 jours) à 7 h 30, heure du Bénin. */
export function nextRunAt(frequency: WatchFrequency, from: Date): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), SEND_UTC.h, SEND_UTC.m));
  while (d.getTime() <= from.getTime()) d.setTime(d.getTime() + DAY);
  if (frequency === 'weekly') d.setTime(d.getTime() + 6 * DAY);
  return d;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();

/** Une compétence demandée est « présente » si tous ses mots significatifs apparaissent dans le profil. */
export function matchOffer(offer: RawOffer, profile: string): Pick<WatchOffer, 'match' | 'matched' | 'missing'> {
  const words = new Set(norm(profile).split(' '));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of offer.skills.slice(0, 12)) {
    const parts = norm(skill)
      .split(' ')
      .filter((w) => w.length > 2 || /\d|\+|#/.test(w));
    if (parts.length && parts.every((w) => words.has(w) || [...words].some((p) => p.length > 4 && w.length > 4 && (p.startsWith(w) || w.startsWith(p))))) matched.push(skill);
    else missing.push(skill);
  }
  const total = matched.length + missing.length;
  return { match: total ? Math.round((matched.length / total) * 100) : 0, matched, missing };
}

export function cacheKey(c: WatchCriteria): string {
  const sorted = (a: string[]) => [...a].map(norm).sort();
  const key = { j: sorted(c.jobs), c: sorted(c.contracts), z: sorted(c.zones), l: c.level, s: c.minSalary, k: norm(c.keywords) };
  return createHash('sha256').update(JSON.stringify(key)).digest('hex').slice(0, 32);
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    for (const p of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(p)) u.searchParams.delete(p);
    return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`.toLowerCase();
  } catch {
    return '';
  }
}

/** Ne garde que des offres avec un vrai lien, issu des résultats de recherche, et pas déjà envoyées. */
export function cleanOffers(offers: RawOffer[], resultHosts: Set<string>, seen: Set<string>): RawOffer[] {
  const out: RawOffer[] = [];
  const kept = new Set<string>();
  for (const o of offers) {
    if (!/^https?:\/\//i.test(o.url) || !o.title.trim()) continue;
    const key = normalizeUrl(o.url);
    if (!key || seen.has(key) || kept.has(key)) continue;
    const host = key.split('/')[0];
    if (resultHosts.size && ![...resultHosts].some((h) => host === h || host.endsWith(`.${h}`) || h.endsWith(`.${host}`))) continue;
    kept.add(key);
    out.push(o);
  }
  return out.slice(0, 15);
}

const CONTRACT_LABEL: Record<string, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  stage: 'stage',
  freelance: 'freelance ou mission',
  teletravail: 'télétravail',
  programme: 'programme (jeunes talents, bourse, formation rémunérée, volontariat)',
};
const ZONE_LABEL: Record<string, string> = {
  benin: 'Bénin (Cotonou, Porto-Novo, Parakou…)',
  'afrique-ouest': 'Afrique de l’Ouest (Togo, Côte d’Ivoire, Sénégal, Burkina Faso, Niger, Nigeria, Ghana…)',
  afrique: 'reste de l’Afrique',
  international: 'télétravail international ouvert aux candidats basés au Bénin',
};
const LEVEL_LABEL: Record<string, string> = {
  debutant: 'débutant ou junior (0 à 2 ans d’expérience)',
  confirme: 'confirmé (3 ans d’expérience ou plus)',
  tous: 'tous niveaux',
};

export function searchPrompt(c: WatchCriteria, exclude: string[], today: Date): string {
  const lines = [
    `Date du jour : ${today.toISOString().slice(0, 10)}.`,
    `Métiers ou domaines recherchés : ${c.jobs.join(' ; ')}.`,
    `Types d’opportunités : ${c.contracts.map((k) => CONTRACT_LABEL[k]).join(', ')}.`,
    `Zones : ${c.zones.map((z) => ZONE_LABEL[z]).join(' ; ')}.`,
    `Niveau : ${LEVEL_LABEL[c.level]}.`,
    c.minSalary ? `Rémunération minimale : ${c.minSalary.toLocaleString('fr-FR')} FCFA par mois (garder une offre sans salaire indiqué, l’écarter si le salaire affiché est plus bas).` : '',
    c.keywords.trim() ? `Mots-clés en plus : ${c.keywords.trim()}.` : '',
    exclude.length ? `Liens déjà envoyés, à ne pas reproposer :\n${exclude.slice(0, 60).join('\n')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export const SEARCH_SYSTEM = `Tu fais une veille d’offres d’emploi pour une personne qui cherche du travail, le plus souvent au Bénin ou en Afrique de l’Ouest.

Méthode :
- Fais de vraies recherches sur le web, au moins 5 requêtes différentes avant de conclure : sites d’emploi du pays et de la région, pages carrières d’entreprises, cabinets de recrutement, organisations internationales et ONG (ReliefWeb, sites des Nations unies…), programmes jeunes. Varie les requêtes : métier + pays ou ville, métier + « recrutement », métier + « avis de recrutement », métier + « offre d’emploi » + mois en cours, et les intitulés proches (ex. comptable, assistant comptable, aide-comptable, chargé de comptabilité).
- Ne garde que des offres encore ouvertes : date limite non dépassée, ou publiées depuis moins de 30 jours s’il n’y a pas de date limite. Une offre dont la date limite n’est pas indiquée n’est pas à écarter pour autant.
- N’invente jamais une offre, une entreprise, un salaire ou un lien. Le lien doit être celui de la page de l’offre (ou de la page carrière qui la publie) trouvé dans les résultats de recherche.
- Écarte les annonces douteuses : frais demandés au candidat, promesses irréalistes, contact uniquement par messagerie privée, absence d’entreprise identifiable.
- Pour une offre à l’étranger ou en télétravail, indique si une personne basée au Bénin peut postuler (oui, non, à vérifier).
- Écarte les liens déjà envoyés.
- Champs inconnus : chaîne vide. Résumé : 1 à 2 phrases simples. Compétences : 3 à 8 compétences demandées, courtes.

Quand tu as fini de chercher, appelle l’outil enregistrer_offres une seule fois avec 0 à 12 offres, des plus intéressantes aux moins intéressantes. S’il n’y a rien de nouveau, appelle-le avec une liste vide et explique-le simplement dans la note.`;

const str = { type: 'string' } as const;
const OFFERS_TOOL: Anthropic.Messages.Tool = {
  name: 'enregistrer_offres',
  description: 'Enregistre les offres trouvées pour la personne. À appeler une seule fois, à la fin.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['offers', 'note'],
    properties: {
      note: { type: 'string', description: 'Une phrase pour la personne : ce qui a été trouvé, ou pourquoi il n’y a rien de nouveau.' },
      offers: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'company', 'location', 'contract', 'salary', 'experience', 'beninEligible', 'deadline', 'url', 'summary', 'skills'],
          properties: {
            title: str,
            company: str,
            location: str,
            contract: str,
            salary: str,
            experience: str,
            beninEligible: { type: 'string', enum: ['oui', 'non', 'à vérifier'] },
            deadline: { type: 'string', description: 'JJ/MM/AAAA, ou vide' },
            url: str,
            summary: str,
            skills: { type: 'array', items: str },
          },
        },
      },
    },
  },
};

function collectResultHosts(blocks: unknown, into: Set<string>): void {
  if (Array.isArray(blocks)) {
    for (const b of blocks) collectResultHosts(b, into);
    return;
  }
  if (!blocks || typeof blocks !== 'object') return;
  const b = blocks as Record<string, unknown>;
  if (b.type === 'web_search_result' && typeof b.url === 'string') {
    const host = normalizeUrl(b.url).split('/')[0];
    if (host) into.add(host);
  }
  if (b.type === 'web_search_tool_result' || b.type === 'web_search_result') collectResultHosts(b.content, into);
}

/** Recherche web avec Claude : outil de recherche côté serveur + outil qui rend les offres sous forme structurée. */
export function claudeWatchSearch(client: Anthropic, model: string): WatchSearch {
  return async (criteria, exclude) => {
    const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: searchPrompt(criteria, exclude, new Date()) }];
    const hosts = new Set<string>();
    let reminded = false;
    for (let i = 0; i < 6; i++) {
      let res: Anthropic.Messages.Message;
      try {
        res = await client.messages.create(
          {
            model,
            max_tokens: 16000,
            output_config: { effort: 'medium' },
            system: SEARCH_SYSTEM,
            tools: [
              {
                type: 'web_search_20260209',
                name: 'web_search',
                max_uses: 8,
                // Le Bénin n'est pas accepté comme pays par l'outil de recherche : seul le fuseau horaire est donné, les zones sont dans la demande.
                user_location: { type: 'approximate', timezone: 'Africa/Porto-Novo' },
              },
              OFFERS_TOOL,
            ],
            messages,
          },
          { timeout: 120_000, maxRetries: 1 },
        );
      } catch (error) {
        console.error('Veille : recherche', error);
        throw new WatchError('La recherche n’a pas pu se faire pour le moment. Réessayez plus tard.', 502);
      }
      collectResultHosts(res.content, hosts);
      // Suivi du coût réel (jetons et recherches), visible dans les journaux du serveur.
      console.log('Veille : appel', JSON.stringify({ model, stop: res.stop_reason, in: res.usage.input_tokens, out: res.usage.output_tokens, cacheRead: res.usage.cache_read_input_tokens, searches: res.usage.server_tool_use?.web_search_requests ?? 0 }));
      if (res.stop_reason === 'refusal') throw new WatchError('Cette recherche n’a pas pu être faite. Modifiez vos critères.', 502);
      const call = res.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use' && b.name === OFFERS_TOOL.name);
      if (call) {
        const input = call.input as { offers?: RawOffer[]; note?: string };
        return { offers: cleanOffers(Array.isArray(input.offers) ? input.offers : [], hosts, new Set(exclude.map(normalizeUrl))), note: String(input.note ?? '') };
      }
      messages.push({ role: 'assistant', content: res.content });
      if (res.stop_reason === 'pause_turn') continue;
      if (reminded) break;
      reminded = true;
      messages.push({ role: 'user', content: 'Appelle maintenant l’outil enregistrer_offres avec les offres trouvées (liste vide s’il n’y en a pas).' });
    }
    throw new WatchError('La recherche n’a pas abouti. Réessayez plus tard.', 502);
  };
}

// ---- Stockage, crédits et envois -------------------------------------------------

interface WatchRow {
  user_id: number;
  criteria: WatchCriteria;
  profile: string;
  frequency: WatchFrequency;
  active: boolean;
  paid_until: Date | null;
  next_run_at: Date | null;
  free_run_used: boolean;
}

const toState = (r: WatchRow): WatchState => ({
  criteria: r.criteria,
  profile: r.profile,
  frequency: r.frequency,
  active: r.active,
  paidUntil: r.paid_until ? new Date(r.paid_until).toISOString() : null,
  nextRunAt: r.active && r.next_run_at ? new Date(r.next_run_at).toISOString() : null,
  freeRunUsed: r.free_run_used,
});

const recipient = (user: Pick<User, 'identifier'>, c: WatchCriteria) => {
  const email = c.email.trim() || user.identifier;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

export function offersEmail(offers: WatchOffer[], note: string, appUrl: string): { subject: string; text: string } {
  if (!offers.length) {
    return {
      subject: 'Votre veille emploi : rien de nouveau aujourd’hui',
      text: `Bonjour,\n\nPas de nouvelle offre correspondant à vos critères pour le moment. ${note}\n\nVos critères : ${appUrl}\n\nCVCasa`,
    };
  }
  const list = offers
    .map((o, i) =>
      [
        `${i + 1}. ${o.title}${o.company ? ` – ${o.company}` : ''}`,
        [o.location, o.contract, o.salary].filter(Boolean).join(' · '),
        o.deadline ? `Date limite : ${o.deadline}` : '',
        o.summary,
        o.matched.length ? `Vous avez déjà : ${o.matched.join(', ')}` : '',
        `Voir l’offre : ${o.url}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
  return {
    subject: `Votre veille emploi : ${offers.length} offre${offers.length > 1 ? 's' : ''} pour vous`,
    text: `Bonjour,\n\n${note ? `${note}\n\n` : ''}${list}\n\nPour adapter votre CV à l’une de ces offres en un clic : ${appUrl}\n\nCVCasa – vérifiez toujours l’offre sur le site de l’employeur avant de postuler. Aucun recruteur sérieux ne demande d’argent.`,
  };
}

export function createWatches(db: Db, accounts: Accounts, search: WatchSearch | null, mailer: Mailer | null, publicUrl: string) {
  const appUrl = `${publicUrl.replace(/\/$/, '')}/#veille`;

  const row = async (userId: number) => (await db.query<WatchRow>('select * from job_watches where user_id = $1', [userId]))[0] ?? null;

  async function runs(userId: number, limit = 10): Promise<WatchRun[]> {
    const rows = await db.query<{ id: number; created_at: Date; offers: WatchOffer[]; note: string }>(
      'select id, created_at, offers, note from job_watch_runs where user_id = $1 order by id desc limit $2',
      [userId, limit],
    );
    return rows.map((r) => ({ id: r.id, createdAt: new Date(r.created_at).toISOString(), offers: r.offers, note: r.note }));
  }

  /** Cherche (ou reprend la recherche du jour d'une autre personne aux mêmes critères), filtre, enregistre, envoie. */
  async function execute(user: Pick<User, 'id' | 'identifier'>, w: WatchRow, sendMail: boolean): Promise<WatchRun> {
    if (!search) throw new WatchError('La veille n’est pas disponible sur ce serveur.', 503);
    const seenRows = await db.query<{ offers: WatchOffer[] }>('select offers from job_watch_runs where user_id = $1 order by id desc limit 30', [user.id]);
    const sent = seenRows.flatMap((r) => r.offers.map((o) => o.url));
    const key = cacheKey(w.criteria);
    const [cached] = await db.query<{ offers: RawOffer[]; note: string }>(
      `select offers, note from job_search_cache where key = $1 and created_at > now() - interval '${CACHE_HOURS} hours'`,
      [key],
    );
    let found = cached;
    if (!found) {
      found = await search(w.criteria, sent);
      await db.query(
        `insert into job_search_cache (key, offers, note, created_at) values ($1, $2, $3, now())
         on conflict (key) do update set offers = excluded.offers, note = excluded.note, created_at = now()`,
        [key, JSON.stringify(found.offers), found.note],
      );
    }
    const fresh = cleanOffers(found.offers, new Set(), new Set(sent.map(normalizeUrl)));
    const offers: WatchOffer[] = fresh.map((o) => ({ ...o, ...matchOffer(o, `${w.profile} ${w.criteria.jobs.join(' ')}`) }));
    // Recherche sans résultat : on garde l'explication de la recherche ; offres trouvées mais déjà envoyées : message simple.
    const note = offers.length || !found.offers.length ? found.note : 'Pas de nouvelle offre depuis le dernier envoi. La veille continue.';
    const [saved] = await db.query<{ id: number; created_at: Date }>(
      'insert into job_watch_runs (user_id, offers, note) values ($1, $2, $3) returning id, created_at',
      [user.id, JSON.stringify(offers), note],
    );
    const to = recipient(user, w.criteria);
    if (sendMail && mailer && to) {
      const mail = offersEmail(offers, note, appUrl);
      await mailer(to, mail.subject, mail.text).catch((e) => console.error('Veille : e-mail', e));
    }
    return { id: saved.id, createdAt: new Date(saved.created_at).toISOString(), offers, note };
  }

  return {
    enabled: search !== null,

    async get(userId: number): Promise<{ watch: WatchState | null; runs: WatchRun[] }> {
      const w = await row(userId);
      return { watch: w ? toState(w) : null, runs: w ? await runs(userId) : [] };
    },

    async save(userId: number, req: WatchSaveRequest): Promise<WatchState> {
      const [w] = await db.query<WatchRow>(
        `insert into job_watches (user_id, criteria, profile, frequency) values ($1, $2, $3, $4)
         on conflict (user_id) do update set criteria = excluded.criteria, profile = excluded.profile, frequency = excluded.frequency, updated_at = now(),
           -- Passer de « chaque semaine » à « chaque matin » : la semaine déjà payée ne couvre pas le prix du quotidien.
           paid_until = case when job_watches.frequency = 'weekly' and excluded.frequency = 'daily' then null else job_watches.paid_until end,
           active = case when job_watches.frequency = 'weekly' and excluded.frequency = 'daily' then false else job_watches.active end
         returning *`,
        [userId, JSON.stringify(req.criteria), req.profile.slice(0, 2_000), req.frequency],
      );
      return toState(w);
    },

    /** « Lancer maintenant » : la première fois offerte, ensuite 1 crédit (remboursé si la recherche échoue). */
    async runNow(user: User): Promise<{ run: WatchRun; credits: number | null; free: boolean }> {
      const w = await row(user.id);
      if (!w) throw new WatchError('Enregistrez d’abord vos critères.', 404);
      const [lock] = await db.query<{ ok: boolean }>(
        `update job_watches set running_since = now() where user_id = $1 and (running_since is null or running_since < now() - interval '5 minutes') returning true as ok`,
        [user.id],
      );
      if (!lock) throw new WatchError('Une recherche est déjà en cours. Patientez une minute.', 409);
      const free = !w.free_run_used;
      let credits: number | null = null;
      try {
        if (!free) {
          try {
            credits = await accounts.spend(user.id, 'veille', WATCH_RUN_COST);
          } catch (error) {
            if (error instanceof AccountError && error.status === 402) throw new WatchError('Vous n’avez plus de crédits. Rechargez pour lancer une recherche.', 402, 'credits');
            throw error;
          }
        }
        try {
          const run = await execute(user, w, false);
          if (free) await db.query('update job_watches set free_run_used = true where user_id = $1', [user.id]);
          return { run, credits, free };
        } catch (error) {
          if (!free) credits = await accounts.refund(user.id, 'veille', WATCH_RUN_COST).catch(() => credits);
          throw error;
        }
      } finally {
        await db.query('update job_watches set running_since = null where user_id = $1', [user.id]);
      }
    },

    /** Active la veille automatique : débite la première semaine. */
    async start(user: User): Promise<{ watch: WatchState; credits: number }> {
      const w = await row(user.id);
      if (!w) throw new WatchError('Enregistrez d’abord vos critères.', 404);
      const price = WATCH_PRICE[w.frequency];
      const now = new Date();
      const paid = w.paid_until && new Date(w.paid_until) > now;
      let credits = user.credits;
      if (!paid) {
        try {
          credits = await accounts.spend(user.id, `veille-${w.frequency}`, price);
        } catch (error) {
          if (error instanceof AccountError && error.status === 402) {
            throw new WatchError(`La veille ${w.frequency === 'daily' ? 'chaque matin' : 'chaque semaine'} coûte ${price} crédit${price > 1 ? 's' : ''} pour 7 jours. Rechargez pour l’activer.`, 402, 'credits');
          }
          throw error;
        }
      }
      const [updated] = await db.query<WatchRow>(
        `update job_watches set active = true, next_run_at = $2, paid_until = case when $3 then paid_until else now() + interval '7 days' end, updated_at = now()
         where user_id = $1 returning *`,
        [user.id, nextRunAt(w.frequency, now), Boolean(paid)],
      );
      return { watch: toState(updated), credits };
    },

    async stop(userId: number): Promise<void> {
      await db.query('update job_watches set active = false, updated_at = now() where user_id = $1', [userId]);
    },

    /** Appelé toutes les 15 minutes : lance les veilles arrivées à échéance (quelques-unes à la fois). */
    async runDue(limit = 3): Promise<{ done: number; paused: number; failed: number }> {
      const due = await db.query<WatchRow & { identifier: string; credits: number }>(
        `update job_watches w set running_since = now()
         from users u
         where u.id = w.user_id and w.user_id in (
           select user_id from job_watches
           where active and next_run_at <= now() and (running_since is null or running_since < now() - interval '10 minutes')
           order by next_run_at limit $1 for update skip locked)
         returning w.*, u.identifier, u.credits`,
        [limit],
      );
      const stats = { done: 0, paused: 0, failed: 0 };
      await Promise.all(
        due.map(async (w) => {
          const user = { id: w.user_id, identifier: w.identifier };
          try {
            if (!w.paid_until || new Date(w.paid_until) <= new Date()) {
              try {
                await accounts.spend(w.user_id, `veille-${w.frequency}`, WATCH_PRICE[w.frequency]);
                await db.query(`update job_watches set paid_until = now() + interval '7 days' where user_id = $1`, [w.user_id]);
              } catch (error) {
                if (!(error instanceof AccountError && error.status === 402)) throw error;
                await db.query('update job_watches set active = false where user_id = $1', [w.user_id]);
                const to = recipient(user, w.criteria);
                if (mailer && to) {
                  await mailer(
                    to,
                    'Votre veille emploi est en pause',
                    `Bonjour,\n\nVotre veille emploi est en pause : il n’y a plus assez de crédits pour la semaine suivante (${WATCH_PRICE[w.frequency]} crédit${WATCH_PRICE[w.frequency] > 1 ? 's' : ''}).\n\nPour la relancer : ${appUrl}\n\nCVCasa`,
                  ).catch((e) => console.error('Veille : e-mail', e));
                }
                stats.paused++;
                return;
              }
            }
            await execute(user, w, true);
            stats.done++;
          } catch (error) {
            console.error('Veille automatique', w.user_id, error);
            stats.failed++;
          } finally {
            // Prochain passage même en cas d'échec : pas de nouvel essai en boucle (et donc pas de coût en boucle).
            await db.query('update job_watches set running_since = null, next_run_at = $2 where user_id = $1', [w.user_id, nextRunAt(w.frequency, new Date())]);
          }
        }),
      );
      return stats;
    },
  };
}

export type Watches = ReturnType<typeof createWatches>;
