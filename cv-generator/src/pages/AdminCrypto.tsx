import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { adminRequest } from '../lib/api.ts';
import { Button, Notice } from '../components/ui.tsx';

// Espace administrateur, onglet « Crypto » : paiements en USDT à vérifier, et réglage de la validation automatique.

interface Order {
  id: number;
  identifier: string;
  credits: number;
  amount: number;
  token: string;
  status: 'open' | 'review' | 'paid' | 'refused';
  txHash: string | null;
  reason: string;
  note: string;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  expiresAt: string;
  proof: string | null;
  chain: { amount: number; from: string; time: string; confirmations: number } | null;
  prorata: number | null;
}
interface Data {
  auto: boolean;
  address: string;
  orders: Order[];
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');

export function AdminCrypto({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [off, setOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const call = useCallback(
    async (method: 'GET' | 'POST', path: string, body?: unknown) => {
      setBusy(true);
      setError(null);
      try {
        setData(await adminRequest<Data>(token, method, path, body));
      } catch (e) {
        if (method === 'GET') setOff(true);
        else setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [token],
  );
  useEffect(() => {
    void call('GET', '/api/admin/crypto');
  }, [call]);

  if (off) return <Notice tone="info">Le paiement en crypto n’est pas activé : aucune adresse de réception n’est réglée sur le serveur.</Notice>;
  if (!data) return <p className="text-sm text-slate-500">Chargement…</p>;
  const review = data.orders.filter((o) => o.status === 'review');
  const past = data.orders.filter((o) => o.status !== 'review');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
        <p>
          Adresse de réception (BEP20) : <code className="text-xs break-all">{data.address}</code>
        </p>
        <label className="mt-2 flex items-start gap-2">
          <input type="checkbox" className="mt-1 size-4" checked={data.auto} disabled={busy} onChange={(e) => void call('POST', '/api/admin/crypto/auto', { on: e.target.checked })} />
          <span>
            <strong>Validation automatique</strong> des cas sans aucun doute (vrai jeton, bon montant, bonne adresse, une seule commande possible, identifiant jamais utilisé). Décochée : chaque paiement attend votre validation.
          </span>
        </label>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">À vérifier ({review.length})</h3>
        <Button size="sm" variant="ghost" icon={<RefreshCw className="size-4" />} loading={busy} onClick={() => void call('GET', '/api/admin/crypto')}>
          Actualiser
        </Button>
      </div>
      {review.length === 0 && <p className="text-sm text-slate-500">Aucun paiement en attente.</p>}
      {review.map((o) => (
        <div key={o.id} className="space-y-2 rounded-2xl border-2 border-amber-300 bg-amber-50/50 p-3 text-sm">
          <p className="font-semibold text-slate-900">
            {o.identifier} · {o.credits} crédits · attendu : {o.amount} {o.token}
          </p>
          <Notice tone="warn">Pourquoi ce paiement attend : {o.reason || 'vérification demandée'}.</Notice>
          {o.prorata !== null && (
            <p className="text-slate-700">
              {o.prorata > 0
                ? `Montant trop faible pour le pack. Règle annoncée au client : le créditer selon le montant reçu, soit ${o.prorata} crédit${o.prorata > 1 ? 's' : ''} (tarif du petit pack, arrondi au crédit inférieur).`
                : 'Montant trop faible : il ne vaut même pas un crédit. Règle annoncée au client : ni crédité ni remboursé. Refusez avec ce motif.'}
            </p>
          )}
          {o.chain && (
            <ul className="space-y-0.5 text-slate-700">
              <li>
                Reçu sur la blockchain : <strong>{o.chain.amount} {o.token}</strong> (jeton officiel, à votre adresse)
              </li>
              <li>Payé le {when(o.chain.time)} · commande ouverte le {when(o.createdAt)}, valable jusqu’au {when(o.expiresAt)}</li>
              <li className="break-all">Envoyé depuis : {o.chain.from}</li>
            </ul>
          )}
          {o.txHash && (
            <p className="break-all">
              Transaction :{' '}
              <a className="font-semibold text-brand-700 underline" href={`https://bscscan.com/tx/${o.txHash}`} target="_blank" rel="noreferrer">
                {o.txHash}
              </a>
            </p>
          )}
          {o.proof && (
            <button type="button" onClick={() => setZoom(o.proof)} className="block">
              <img src={o.proof} alt="Capture envoyée par le client" className="h-40 rounded-lg object-contain ring-1 ring-slate-300" />
              <span className="text-xs font-semibold text-brand-700">Agrandir la capture</span>
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            {o.prorata !== null && o.prorata > 0 && (
              <Button size="sm" icon={<Check className="size-4" />} disabled={busy} onClick={() => void call('POST', `/api/admin/crypto/${o.id}`, { action: 'prorata' })}>
                Créditer au prorata : {o.prorata} crédit{o.prorata > 1 ? 's' : ''}
              </Button>
            )}
            <Button size="sm" variant={o.prorata !== null ? 'secondary' : 'primary'} icon={<Check className="size-4" />} disabled={busy} onClick={() => void call('POST', `/api/admin/crypto/${o.id}`, { action: 'approve' })}>
              Valider et donner {o.credits} crédits
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<X className="size-4" />}
              disabled={busy}
              onClick={() => {
                const note = window.prompt('Motif du refus (affiché au client) :', 'Paiement non retrouvé à votre nom.');
                if (note === null) return;
                void call('POST', `/api/admin/crypto/${o.id}`, { action: 'refuse', note });
              }}
            >
              Refuser
            </Button>
          </div>
        </div>
      ))}
      {past.length > 0 && (
        <>
          <h3 className="font-semibold text-slate-900">Derniers paiements</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {past.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                <span className={o.status === 'paid' ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{o.status === 'paid' ? 'Payé' : 'Refusé'}</span>
                <span>{o.identifier}</span>
                <span>
                  {o.amount} {o.token} · {o.credits} crédits
                  {o.chain && o.chain.amount > o.amount + 0.0001 ? ` · reçu ${o.chain.amount} (surplus à convertir en crédits si le client le demande)` : ''}
                </span>
                <span className="text-slate-500">{when(o.decidedAt)}</span>
                {o.txHash && (
                  <a className="text-brand-700 underline" href={`https://bscscan.com/tx/${o.txHash}`} target="_blank" rel="noreferrer">
                    voir
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {zoom && (
        <button type="button" onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" aria-label="Fermer la capture">
          <img src={zoom} alt="Capture envoyée par le client" className="max-h-full max-w-full rounded-lg" />
        </button>
      )}
    </div>
  );
}
