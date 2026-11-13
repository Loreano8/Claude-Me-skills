import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, HandCoins, Check, Coins, Copy, KeyRound, LogOut, MessageCircle, RefreshCw, Send, ShieldCheck, Star, X } from 'lucide-react';
import { PUBLIC_SITE } from '../lib/referral.ts';
import { ADMIN_SESSION_KEY, adminRequest, type SupportMessage } from '../lib/api.ts';
import { Button, Card, cx, Field, Notice, TextArea } from '../components/ui.tsx';

// Espace administrateur (adresse …/#admin) : répondre aux messages « Nous contacter »
// et valider les témoignages. Protégé par le jeton ADMIN_TOKEN du serveur, gardé sur cet appareil.

const TOKEN_KEY = 'cv-studio-admin';

interface Thread {
  id: number;
  name: string;
  contact: string;
  account: string | null;
  unread: number;
  lastMessage: string;
  lastAuthor: 'user' | 'admin';
  lastMessageAt: string;
}

interface AdminTestimonial {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  firstName: string;
  jobTitle: string;
  company: string;
  city: string;
  message: string;
  createdAt: string;
}

const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

/** La session (ouverte par le code e-mail) dure 12 h : passé ce délai, on redemande un code. */
function sessionAlive(): boolean {
  try {
    const exp = Number((localStorage.getItem(ADMIN_SESSION_KEY) ?? '').split('.')[0]);
    return exp > Date.now() + 60_000;
  } catch {
    return false;
  }
}

function Conversation({ token, thread, onBack }: { token: string; thread: Thread; onBack: () => void }) {
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminRequest<{ messages: SupportMessage[] }>(token, 'GET', `/api/admin/support/${thread.id}`).then(
      (r) => setMessages(r.messages),
      (e) => setError((e as Error).message),
    );
  }, [token, thread.id]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const r = await adminRequest<{ messages: SupportMessage[] }>(token, 'POST', `/api/admin/support/${thread.id}`, { body: reply });
      setMessages(r.messages);
      setReply('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft className="size-4" /> Toutes les conversations
      </button>
      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">{thread.name || 'Sans nom'}</p>
        {thread.contact && <p>Contact : {thread.contact}</p>}
        {thread.account && <p>Compte : {thread.account}</p>}
      </div>
      <div className="space-y-3">
        {messages?.map((m) => (
          <div key={m.id} className={cx('flex', m.author === 'admin' ? 'justify-end' : 'justify-start')}>
            <div
              className={cx(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                m.author === 'admin' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-900',
              )}
            >
              {m.body}
              <p className={cx('mt-1 text-[11px]', m.author === 'admin' ? 'text-brand-100' : 'text-slate-500')}>{when(m.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      <TextArea value={reply} onChange={setReply} rows={3} placeholder="Votre réponse (le client la verra dans « Nous contacter »)…" />
      {error && <Notice tone="error">{error}</Notice>}
      <Button icon={<Send className="size-4" />} loading={busy} disabled={busy || !reply.trim()} onClick={send}>
        Répondre
      </Button>
    </div>
  );
}

function Messages({ token }: { token: string }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [open, setOpen] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      adminRequest<{ threads: Thread[] }>(token, 'GET', '/api/admin/support').then(
        (r) => setThreads(r.threads),
        (e) => setError((e as Error).message),
      ),
    [token],
  );

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (open) {
    return (
      <Conversation
        token={token}
        thread={open}
        onBack={() => {
          setOpen(null);
          void load();
        }}
      />
    );
  }
  return (
    <div className="space-y-2">
      {error && <Notice tone="error">{error}</Notice>}
      {threads?.length === 0 && <p className="text-sm text-slate-500">Aucun message pour l’instant.</p>}
      {threads?.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setOpen(t)}
          className={cx('w-full rounded-xl border p-3 text-left transition hover:bg-slate-50', t.unread > 0 ? 'border-brand-300 bg-brand-50/50' : 'border-slate-200')}
        >
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-semibold text-slate-900">{t.name || t.contact || t.account || `Conversation n°${t.id}`}</p>
            {t.unread > 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">{t.unread}</span>}
            <span className="shrink-0 text-xs text-slate-500">{when(t.lastMessageAt)}</span>
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-600">
            {t.lastAuthor === 'admin' && 'Vous : '}
            {t.lastMessage}
          </p>
        </button>
      ))}
    </div>
  );
}

function Testimonials({ token }: { token: string }) {
  const [items, setItems] = useState<AdminTestimonial[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      adminRequest<{ testimonials: AdminTestimonial[] }>(token, 'GET', '/api/admin/testimonials').then(
        (r) => setItems(r.testimonials),
        (e) => setError((e as Error).message),
      ),
    [token],
  );
  useEffect(() => void load(), [load]);

  const decide = async (id: number, status: AdminTestimonial['status']) => {
    try {
      await adminRequest(token, 'POST', `/api/admin/testimonials/${id}`, { status });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const label = { pending: 'En attente', approved: 'Publié', rejected: 'Refusé' } as const;
  return (
    <div className="space-y-2">
      {error && <Notice tone="error">{error}</Notice>}
      {items?.length === 0 && <p className="text-sm text-slate-500">Aucun témoignage pour l’instant.</p>}
      {items?.map((t) => (
        <div key={t.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 font-semibold text-slate-900">
              {t.firstName} · {t.jobTitle} chez {t.company}
              {t.city && `, ${t.city}`}
            </p>
            <span
              className={cx(
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                t.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : t.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800',
              )}
            >
              {label[t.status]}
            </span>
          </div>
          {t.message && <p className="mt-1 text-sm text-slate-700">« {t.message} »</p>}
          <div className="mt-2 flex gap-2">
            {t.status !== 'approved' && (
              <Button size="sm" icon={<Check className="size-4" />} onClick={() => void decide(t.id, 'approved')}>
                Publier
              </Button>
            )}
            {t.status !== 'rejected' && (
              <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => void decide(t.id, 'rejected')}>
                Refuser
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

type CheckValue = 'ok' | 'wrong' | 'unknown' | 'not_set';
interface RecoveryRequest {
  id: number;
  identifier: string;
  status: 'pending' | 'approved' | 'refused';
  given: { name: string; lastPurchase: string; credits: number | null; note: string };
  actual: { name: string; lastPurchase: number | null; credits: number } | null;
  checks: { account: boolean; name: CheckValue; phrase: CheckValue; purchase: CheckValue; credits: CheckValue };
  createdAt: string;
}

const purchaseLabel = (v: string | number | null) =>
  v === null || v === 'none' ? 'aucun achat' : v === 'unknown' ? 'ne sait plus' : `${Number(v).toLocaleString('fr-FR')} FCFA`;

function CheckRow({ label, value, given, actual }: { label: string; value: CheckValue; given?: string; actual?: string }) {
  const style = {
    ok: ['bg-emerald-100 text-emerald-800', 'Conforme'],
    wrong: ['bg-rose-100 text-rose-800', 'Différent'],
    unknown: ['bg-slate-100 text-slate-600', 'Non répondu'],
    not_set: ['bg-slate-100 text-slate-600', 'Non défini sur le compte'],
  }[value];
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', style[0])}>{style[1]}</span>
      <span className="min-w-0 text-slate-700">
        <strong>{label}</strong>
        {given !== undefined && ` : « ${given || '—'} »`}
        {actual !== undefined && <span className="text-slate-500"> (compte : {actual || '—'})</span>}
      </span>
    </div>
  );
}

/** Demandes de récupération de compte : réponses déjà comparées au compte, il reste à valider ou refuser. */
function Recoveries({ token }: { token: string }) {
  const [items, setItems] = useState<RecoveryRequest[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      adminRequest<{ requests: RecoveryRequest[] }>(token, 'GET', '/api/admin/recovery').then(
        (r) => setItems(r.requests),
        (e) => setError((e as Error).message),
      ),
    [token],
  );
  useEffect(() => void load(), [load]);

  async function decide(r: RecoveryRequest, approve: boolean) {
    if (approve && !window.confirm(`Valider et envoyer un mot de passe provisoire à ${r.identifier} ?`)) return;
    setBusy(r.id);
    setError(null);
    try {
      await adminRequest(token, 'POST', `/api/admin/recovery/${r.id}`, { approve });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Les réponses sont comparées automatiquement au compte (la phrase secrète n’est jamais affichée). « Valider » envoie un mot de passe provisoire dans la conversation « Nous contacter » de la personne.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      {items?.length === 0 && <p className="text-sm text-slate-500">Aucune demande pour l’instant.</p>}
      {items?.map((r) => {
        const okCount = (['name', 'phrase', 'purchase', 'credits'] as const).filter((k) => r.checks[k] === 'ok').length;
        const wrong = (['name', 'phrase', 'purchase', 'credits'] as const).some((k) => r.checks[k] === 'wrong');
        return (
          <div key={r.id} className={cx('rounded-xl border p-3', r.status === 'pending' ? 'border-brand-300' : 'border-slate-200 opacity-70')}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-semibold text-slate-900">{r.identifier}</p>
              <span
                className={cx(
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  r.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : r.status === 'refused' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800',
                )}
              >
                {{ pending: 'À traiter', approved: 'Validée', refused: 'Refusée' }[r.status]}
              </span>
            </div>
            <p className="mb-2 text-xs text-slate-500">{when(r.createdAt)}</p>
            {!r.checks.account ? (
              <Notice tone="warn">Aucun compte ne correspond à cet identifiant.</Notice>
            ) : (
              <div className="space-y-1.5">
                <CheckRow label="Phrase secrète" value={r.checks.phrase} />
                <CheckRow label="Prénom" value={r.checks.name} given={r.given.name} actual={r.actual?.name} />
                <CheckRow label="Dernier achat" value={r.checks.purchase} given={purchaseLabel(r.given.lastPurchase)} actual={purchaseLabel(r.actual?.lastPurchase ?? null)} />
                <CheckRow label="Crédits restants" value={r.checks.credits} given={r.given.credits === null ? '' : String(r.given.credits)} actual={String(r.actual?.credits ?? '')} />
                {r.given.note && <p className="text-sm text-slate-700">Précision : « {r.given.note} »</p>}
                <p className={cx('pt-1 text-sm font-medium', wrong ? 'text-rose-700' : okCount >= 2 ? 'text-emerald-700' : 'text-amber-700')}>
                  {wrong ? 'Au moins une réponse ne correspond pas : prudence.' : okCount >= 2 ? `${okCount} réponses conformes.` : 'Peu d’éléments vérifiables : demandez des précisions dans « Messages ».'}
                </p>
              </div>
            )}
            {r.status === 'pending' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.checks.account && (
                  <Button size="sm" icon={<Check className="size-4" />} loading={busy === r.id} disabled={busy !== null} onClick={() => void decide(r, true)}>
                    Valider et envoyer le mot de passe
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={<X className="size-4" />} disabled={busy !== null} onClick={() => void decide(r, false)}>
                  Refuser
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Offrir des crédits à un compte (testeur, geste commercial, remboursement…), sans achat. */
interface SourceRow {
  source: string;
  visits: number;
  signups: number;
  buyers: number;
  revenue: number;
}

/** Même règle que le serveur : « Facebook Vidéo 1 » → « facebook-video1 ». */
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–');

/** Ce que rapporte chaque pub : visites, inscriptions, acheteurs, chiffre d'affaires. */
function Sources({ token }: { token: string }) {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<SourceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRows(null);
    adminRequest<{ sources: SourceRow[] }>(token, 'GET', `/api/admin/sources?days=${days}`)
      .then((r) => setRows(r.sources))
      .catch((e) => setError((e as Error).message));
  }, [token, days]);

  const link = slug(name) ? `${PUBLIC_SITE}/?src=${slug(name)}` : '';
  const fcfa = (n: number) => `${n.toLocaleString('fr-FR')} F`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-800">Créer le lien d’une pub</p>
        <p className="mb-2 text-xs text-slate-500">Un lien différent par pub : chaque visite, inscription et achat sera compté pour elle.</p>
        <Field label="Nom de la pub" value={name} onChange={setName} placeholder="Ex. Facebook vidéo 1" />
        {link && (
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-xs ring-1 ring-slate-200">{link}</code>
            <Button
              size="sm"
              variant="secondary"
              icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              onClick={() => {
                void navigator.clipboard?.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Copié' : 'Copier'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={cx('rounded-full px-3 py-1 text-sm', days === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700')}
          >
            {d} jours
          </button>
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!rows && !error && <div className="h-24 animate-pulse rounded-xl bg-slate-100" />}
      {rows?.length === 0 && <p className="text-sm text-slate-500">Aucune visite sur cette période.</p>}
      <ul className="space-y-2">
        {rows?.map((r) => (
          <li key={r.source} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-slate-900">{r.source === 'direct' ? 'Direct (sans lien de pub)' : r.source}</p>
              <p className="font-bold text-emerald-700">{fcfa(r.revenue)}</p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
              <div>
                <p className="text-lg font-bold text-slate-900">{r.visits}</p>visites
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{r.signups}</p>inscrits · {pct(r.signups, r.visits)}
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{r.buyers}</p>acheteurs · {pct(r.buyers, r.signups)}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">Une visite est comptée une fois par session. Les inscrits et acheteurs sont ceux inscrits pendant la période, d’après la première pub qui les a amenés (30 jours).</p>
    </div>
  );
}

function Credits({ token }: { token: string }) {
  const [identifier, setIdentifier] = useState('');
  const [amount, setAmount] = useState('10');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function grant() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await adminRequest<{ identifier: string; credits: number }>(token, 'POST', '/api/admin/credits', {
        identifier: identifier.trim(),
        credits: Number(amount),
      });
      setResult(`${r.identifier} a maintenant ${r.credits} crédit${r.credits > 1 ? 's' : ''}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const n = Number(amount);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Ajoute des crédits à un compte sans achat. Rien ne change pour la personne : ses documents restent normaux, sans aucune mention. Un nombre négatif retire des crédits.
      </p>
      <Field label="E-mail ou téléphone du compte" value={identifier} onChange={setIdentifier} />
      <Field label="Nombre de crédits" type="number" value={amount} onChange={setAmount} />
      {result && <Notice tone="success">{result}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Button icon={<Coins className="size-4" />} loading={busy} disabled={busy || !identifier.trim() || !Number.isInteger(n) || n === 0} onClick={() => void grant()}>
        {n < 0 ? 'Retirer' : 'Ajouter'} {Number.isInteger(n) && n !== 0 ? Math.abs(n) : ''} crédit{Math.abs(n) > 1 ? 's' : ''}
      </Button>
    </div>
  );
}

/** Mot de passe provisoire pour un compte bloqué (à transmettre dans « Nous contacter »). */
function TempPassword({ token }: { token: string }) {
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-6 space-y-3 border-t border-slate-100 pt-4">
      <p className="text-sm font-semibold text-slate-900">Mot de passe oublié</p>
      <p className="text-sm text-slate-600">Donne un mot de passe provisoire à un compte bloqué, puis transmets-le à la personne dans sa conversation « Nous contacter ».</p>
      <Field label="E-mail ou téléphone du compte" value={identifier} onChange={setIdentifier} />
      {result && <Notice tone="success">{result}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Button
        variant="secondary"
        loading={busy}
        disabled={busy || !identifier.trim()}
        onClick={async () => {
          if (!window.confirm(`Remplacer le mot de passe de ${identifier.trim()} ?`)) return;
          setBusy(true);
          setError(null);
          setResult(null);
          try {
            const r = await adminRequest<{ identifier: string; password: string }>(token, 'POST', '/api/admin/password', { identifier: identifier.trim() });
            setResult(`Nouveau mot de passe de ${r.identifier} : ${r.password}`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Créer un mot de passe provisoire
      </Button>
    </div>
  );
}

type AdminAmbassador = { userId: number; identifier: string; name: string; status: string; momoNumber: string; momoName: string; contractVersion: string; contractSignedAt: string | null; motivation: string; createdAt: string; invited: number; buyers: number; earned: number; paid: number };
type AdminNumberChange = { id: number; userId: number; identifier: string; legalName: string; oldNumber: string; newNumber: string; status: string; requestedAt: string; documents: number };
type AdminPayout = { id: number; userId: number; identifier: string; amount: number; fee: number; net: number; momoNumber: string; momoName: string; status: string; ambassadorStatus: string; requestedAt: string };

const AMB_STATUS: Record<string, string> = { pending: 'À valider', active: 'Actif', refused: 'Refusé', suspended: 'Suspendu' };
const fcfaAdmin = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;

/** Programme Ambassadeur : valider les demandes, puis payer les retraits (Mobile Money envoyé à la main, puis « Payé »). */
function Ambassadors({ token }: { token: string }) {
  const [data, setData] = useState<{ ambassadors: AdminAmbassador[]; payouts: AdminPayout[]; numberChanges: AdminNumberChange[] } | null>(null);
  const [docs, setDocs] = useState<{ id: number; list: { name: string; mediaType: string; data: string }[] } | null>(null);
  const showDocs = async (id: number) => {
    try {
      const r = await adminRequest<{ documents: { name: string; mediaType: string; data: string }[] }>(token, 'GET', `/api/admin/number-changes/${id}`);
      setDocs({ id, list: r.documents });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await adminRequest(token, 'GET', '/api/admin/ambassadors'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (key: string, path: string, body: unknown) => {
    setBusy(key);
    setError(null);
    try {
      setData(await adminRequest(token, 'POST', path, body));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  if (!data) return error ? <Notice tone="error">{error}</Notice> : <p className="text-sm text-slate-500">Chargement…</p>;
  const toPay = data.payouts.filter((p) => p.status === 'requested');
  return (
    <div className="space-y-5">
      {error && <Notice tone="error">{error}</Notice>}
      <section>
        <h3 className="mb-2 font-semibold text-slate-900">Retraits à payer ({toPay.length})</h3>
        {!data.payouts.length && <p className="text-sm text-slate-500">Aucune demande de retrait.</p>}
        <ul className="space-y-2">
          {data.payouts.map((p) => (
            <li key={p.id} className={cx('rounded-xl border p-3 text-sm', p.status === 'requested' ? 'border-amber-300 bg-amber-50' : 'border-slate-200')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Envoyer {fcfaAdmin(p.net)} · {p.identifier}</span>
                <span className="text-xs text-slate-500">{when(p.requestedAt)} · {p.status === 'requested' ? 'à payer' : p.status === 'paid' ? 'payé' : 'refusé'}</span>
              </div>
              <p className="mt-1 text-slate-700">Mobile Money : <strong>{p.momoNumber}</strong></p>
              <p className="mt-1 rounded-lg bg-white px-2 py-1 text-slate-800 ring-1 ring-amber-200">
                Avant de valider l’envoi, Mobile Money doit afficher le nom : <strong>{p.momoName}</strong>. Sinon, n’envoyez pas et refusez.
              </p>
              <p className="text-xs text-slate-500">Gains {fcfaAdmin(p.amount)} − frais d’envoi {fcfaAdmin(p.fee)} = {fcfaAdmin(p.net)} à envoyer.</p>
              {p.status === 'requested' && p.ambassadorStatus !== 'active' && (
                <p className="mt-1 font-semibold text-red-700">Ambassadeur {AMB_STATUS[p.ambassadorStatus]?.toLowerCase() ?? p.ambassadorStatus} : ne payez pas ce retrait.</p>
              )}
              {p.status === 'requested' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" disabled={p.ambassadorStatus !== 'active'} loading={busy === `p${p.id}`} onClick={() => window.confirm(`Avez-vous bien envoyé ${fcfaAdmin(p.net)} au ${p.momoNumber}, au nom de ${p.momoName} ?`) && void act(`p${p.id}`, `/api/admin/payouts/${p.id}`, { decision: 'paid' })}>
                    Payé
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { const note = window.prompt('Raison du refus (affichée à l’ambassadeur) :'); if (note === null) return; void act(`p${p.id}`, `/api/admin/payouts/${p.id}`, { decision: 'refused', note }); }}>
                    Refuser
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      {data.numberChanges.some((c) => c.status === 'requested') && (
        <section>
          <h3 className="mb-2 font-semibold text-slate-900">Changements de numéro à vérifier</h3>
          <ul className="space-y-2">
            {data.numberChanges.filter((c) => c.status === 'requested').map((c) => (
              <li key={c.id} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="font-semibold">{c.legalName} · {c.identifier}</p>
                <p className="text-slate-700">{c.oldNumber} → <strong>{c.newNumber}</strong> · {when(c.requestedAt)}</p>
                <p className="mt-1 text-xs text-slate-600">Vérifiez que la pièce d’identité et le compte Mobile Money portent bien le nom « {c.legalName} ». Les justificatifs sont effacés après votre décision.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void showDocs(c.id)}>Voir les justificatifs ({c.documents})</Button>
                  <Button size="sm" loading={busy === `c${c.id}`} onClick={() => window.confirm(`Accepter le nouveau numéro ${c.newNumber} pour ${c.legalName} ?`) && void act(`c${c.id}`, `/api/admin/number-changes/${c.id}`, { approve: true })}>
                    Accepter
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { const note = window.prompt('Raison du refus (affichée à l’ambassadeur). Les justificatifs seront effacés :'); if (note === null) return; void act(`c${c.id}`, `/api/admin/number-changes/${c.id}`, { approve: false, note }); }}>
                    Refuser
                  </Button>
                </div>
                {docs?.id === c.id && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {docs.list.map((d, i) =>
                      d.mediaType.startsWith('image/') ? (
                        <img key={i} src={`data:${d.mediaType};base64,${d.data}`} alt={d.name} className="w-full rounded-lg ring-1 ring-slate-200" />
                      ) : (
                        <a key={i} href={`data:${d.mediaType};base64,${d.data}`} download={d.name} className="rounded-lg bg-white p-3 text-brand-700 underline ring-1 ring-slate-200">
                          {d.name}
                        </a>
                      ),
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="mb-2 font-semibold text-slate-900">Ambassadeurs ({data.ambassadors.length})</h3>
        {!data.ambassadors.length && <p className="text-sm text-slate-500">Aucune demande pour le moment.</p>}
        <ul className="space-y-2">
          {data.ambassadors.map((a) => (
            <li key={a.userId} className={cx('rounded-xl border p-3 text-sm', a.status === 'pending' ? 'border-brand-300 bg-brand-50' : 'border-slate-200')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{a.name || a.identifier} <span className="font-normal text-slate-500">· {a.identifier}</span></span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">{AMB_STATUS[a.status] ?? a.status}</span>
              </div>
              <p className="mt-1 text-slate-600">
                {a.invited} inscrit(s) · {a.buyers} acheteur(s) · gagné {fcfaAdmin(a.earned)} · payé {fcfaAdmin(a.paid)}
              </p>
              <p className="text-slate-600">Nom légal : <strong>{a.momoName}</strong> · Mobile Money : {a.momoNumber}</p>
              <p className="text-xs text-slate-500">{a.contractSignedAt ? `Contrat ${a.contractVersion} signé le ${when(a.contractSignedAt)}` : 'Contrat non signé'}</p>
              {a.motivation && <p className="mt-1 text-slate-700 italic">« {a.motivation} »</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {a.status !== 'active' && (
                  <Button size="sm" loading={busy === `a${a.userId}`} onClick={() => (a.status === 'pending' || window.confirm(`Réactiver ${a.momoName} (actuellement ${AMB_STATUS[a.status]?.toLowerCase()}) ?`)) && void act(`a${a.userId}`, `/api/admin/ambassadors/${a.userId}`, { status: 'active' })}>
                    {a.status === 'pending' ? 'Valider' : 'Réactiver'}
                  </Button>
                )}
                {a.status === 'pending' && (
                  <Button size="sm" variant="ghost" onClick={() => void act(`a${a.userId}`, `/api/admin/ambassadors/${a.userId}`, { status: 'refused' })}>
                    Refuser
                  </Button>
                )}
                {a.status === 'active' && (
                  <Button size="sm" variant="ghost" onClick={() => window.confirm('Suspendre cet ambassadeur ? Il ne gagnera plus rien, son retrait en attente est refusé, et il ne pourra plus demander de retrait tant qu’il est suspendu.') && void act(`a${a.userId}`, `/api/admin/ambassadors/${a.userId}`, { status: 'suspended' })}>
                    Suspendre
                  </Button>
                )}
                {a.status === 'suspended' && (
                  <Button size="sm" variant="ghost" onClick={() => window.confirm('Annuler tous ses gains pas encore versés (en cas de triche) ? C’est définitif.') && void act(`a${a.userId}`, `/api/admin/ambassadors/${a.userId}/cancel`, {})}>
                    Annuler ses gains non versés
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AdminPage() {
  // Connecté seulement avec le jeton ET une session encore valide (code e-mail de moins de 12 h).
  const [token, setToken] = useState(() => (sessionAlive() || !readToken() ? readToken() : ''));
  const [draft, setDraft] = useState(readToken);
  const [tab, setTab] = useState<'messages' | 'recuperations' | 'temoignages' | 'credits' | 'pubs' | 'ambassadeurs'>('messages');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Étape 2 : code envoyé par e-mail.
  const [challenge, setChallenge] = useState<{ value: string; to: string } | null>(null);
  const [code, setCode] = useState('');

  const finish = async (tok: string, session: string) => {
    if (session) localStorage.setItem(ADMIN_SESSION_KEY, session);
    await adminRequest(tok, 'GET', '/api/admin/support');
    localStorage.setItem(TOKEN_KEY, tok);
    setToken(tok);
    setChallenge(null);
    setCode('');
  };

  async function login() {
    setChecking(true);
    setError(null);
    try {
      const tok = draft.trim();
      localStorage.removeItem(ADMIN_SESSION_KEY);
      const r = await adminRequest<{ twoStep: boolean; challenge?: string; to?: string }>(tok, 'POST', '/api/admin/code');
      if (r.twoStep && r.challenge) setChallenge({ value: r.challenge, to: r.to ?? '' });
      else await finish(tok, '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function verify() {
    if (!challenge) return;
    setChecking(true);
    setError(null);
    try {
      const tok = draft.trim();
      const r = await adminRequest<{ session: string }>(tok, 'POST', '/api/admin/verify', { challenge: challenge.value, code });
      await finish(tok, r.session);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md">
        <Card
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-brand-600" /> Espace administrateur
            </span>
          }
          subtitle={
            challenge
              ? `Un code à 6 chiffres vient d'être envoyé à ${challenge.to}. Il est valable 10 minutes.`
              : 'Collez le jeton administrateur (ADMIN_TOKEN). Un code vous sera ensuite envoyé par e-mail.'
          }
        >
          {challenge ? (
            <Field label="Code reçu par e-mail" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" />
          ) : (
            <Field label="Jeton administrateur" type="password" value={draft} onChange={setDraft} />
          )}
          {error && (
            <div className="mt-3">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {challenge ? (
              <>
                <Button loading={checking} disabled={code.length !== 6} onClick={() => void verify()}>
                  Valider
                </Button>
                <button type="button" className="min-h-11 text-sm font-semibold text-brand-700" onClick={() => void login()}>
                  Renvoyer un code
                </button>
              </>
            ) : (
              <Button loading={checking} disabled={!draft.trim()} onClick={() => void login()}>
                Recevoir le code
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-brand-600" /> Espace administrateur
          </span>
        }
        actions={
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" icon={<RefreshCw className="size-4" />} onClick={() => window.location.reload()}>
              <span className="sr-only">Actualiser</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<LogOut className="size-4" />}
              onClick={() => {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(ADMIN_SESSION_KEY);
                setToken('');
              }}
            >
              <span className="sr-only">Se déconnecter</span>
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ['messages', 'Messages', MessageCircle],
              ['recuperations', 'Récupérations', KeyRound],
              ['temoignages', 'Témoignages', Star],
              ['credits', 'Comptes', Coins],
              ['pubs', 'Pubs', BarChart3],
              ['ambassadeurs', 'Ambassadeurs', HandCoins],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cx('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium', tab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700')}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        {tab === 'messages' ? (
          <Messages token={token} />
        ) : tab === 'recuperations' ? (
          <Recoveries token={token} />
        ) : tab === 'temoignages' ? (
          <Testimonials token={token} />
        ) : tab === 'pubs' ? (
          <Sources token={token} />
        ) : tab === 'ambassadeurs' ? (
          <Ambassadors token={token} />
        ) : (
          <>
            <Credits token={token} />
            <TempPassword token={token} />
          </>
        )}
      </Card>
    </div>
  );
}
