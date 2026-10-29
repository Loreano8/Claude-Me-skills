import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { api, saveSupportSecret, type SupportMessage } from '../lib/api.ts';
import { useAccount } from '../lib/account.ts';
import { useSupportBadge } from '../lib/supportBadge.ts';
import { Button, Card, cx, Field, Notice, TextArea } from '../components/ui.tsx';

const time = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** « Nous contacter » : la conversation avec l'équipe CVCasa, réponses comprises. */
export function ContactPage() {
  const user = useAccount((s) => s.user);
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [body, setBody] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [contact, setContact] = useState(user?.identifier ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const load = () =>
    api.support().then(
      (r) => {
        setMessages(r.messages);
        useSupportBadge.getState().setUnread(0);
      },
      (e) => setError((e as Error).message),
    );

  useEffect(() => {
    void load();
    // Les réponses arrivent sans recharger la page.
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [messages?.length]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.supportPost({ body, name, contact });
      if (res.secret) saveSupportSecret(res.secret);
      setMessages(res.messages);
      setBody('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const first = messages !== null && messages.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <MessageCircle className="size-5 text-brand-600" /> Nous contacter
          </span>
        }
        subtitle="Une question, un souci de paiement, une idée ? Écrivez-nous : la réponse s’affiche ici, dans cette conversation."
      >
        {messages === null && !error && <div className="h-24 animate-pulse rounded-xl bg-slate-100" />}
        {messages && messages.length > 0 && (
          <div className="max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div key={m.id} className={cx('flex', m.author === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cx(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                    m.author === 'user' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-900',
                  )}
                >
                  {m.author === 'admin' && <p className="mb-0.5 text-xs font-semibold text-brand-700">CVCasa</p>}
                  {m.body}
                  <p className={cx('mt-1 text-[11px]', m.author === 'user' ? 'text-brand-100' : 'text-slate-500')}>{time(m.createdAt)}</p>
                </div>
              </div>
            ))}
            {messages.at(-1)?.author === 'user' && (
              <p className="text-center text-xs text-slate-500">Message bien reçu. Nous répondons en général dans la journée.</p>
            )}
            <div ref={end} />
          </div>
        )}

        <div className={cx('space-y-3', messages && messages.length > 0 && 'mt-4 border-t border-slate-100 pt-4')}>
          {first && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Votre prénom" value={name} onChange={setName} autoComplete="given-name" />
              <Field
                label="E-mail ou téléphone (facultatif)"
                value={contact}
                onChange={setContact}
                autoComplete="email"
                hint="Pour vous recontacter si besoin."
              />
            </div>
          )}
          <TextArea value={body} onChange={setBody} rows={3} placeholder="Votre message…" />
          {error && <Notice tone="error">{error}</Notice>}
          <Button icon={<Send className="size-4" />} loading={busy} disabled={busy || !body.trim()} onClick={send}>
            Envoyer
          </Button>
        </div>
      </Card>
    </div>
  );
}
