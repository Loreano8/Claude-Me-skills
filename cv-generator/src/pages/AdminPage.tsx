import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Coins, LogOut, MessageCircle, RefreshCw, Send, ShieldCheck, Star, X } from 'lucide-react';
import { adminRequest, type SupportMessage } from '../lib/api.ts';
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

/** Offrir des crédits à un compte (testeur, geste commercial, remboursement…), sans achat. */
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

export function AdminPage() {
  const [token, setToken] = useState(readToken);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<'messages' | 'temoignages' | 'credits'>('messages');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function login() {
    setChecking(true);
    setError(null);
    try {
      await adminRequest(draft.trim(), 'GET', '/api/admin/support');
      localStorage.setItem(TOKEN_KEY, draft.trim());
      setToken(draft.trim());
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
          subtitle="Collez le jeton administrateur (ADMIN_TOKEN). Il reste enregistré sur cet appareil."
        >
          <Field label="Jeton administrateur" type="password" value={draft} onChange={setDraft} />
          {error && (
            <div className="mt-3">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <Button className="mt-3" loading={checking} disabled={!draft.trim()} onClick={() => void login()}>
            Entrer
          </Button>
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
              ['temoignages', 'Témoignages', Star],
              ['credits', 'Crédits', Coins],
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
        {tab === 'messages' ? <Messages token={token} /> : tab === 'temoignages' ? <Testimonials token={token} /> : <Credits token={token} />}
      </Card>
    </div>
  );
}
