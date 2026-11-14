import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Coins, Copy, ImagePlus, ShieldCheck } from 'lucide-react';
import type { Pack } from '../lib/account.ts';
import { api, refreshAccount, type CryptoInfo, type CryptoOrder } from '../lib/api.ts';
import { LOCALE, t } from '../i18n.ts';
import { Button, cx, Field, Notice } from './ui.tsx';

/** Réduit la capture (1 400 px au plus, JPEG) pour qu'elle parte vite, même avec une petite connexion. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error(t('Image illisible. Choisissez une capture d’écran.')));
      i.src = url;
    });
    const k = Math.min(1, 1400 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * k);
    canvas.height = Math.round(img.height * k);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const hour = (iso: string) => new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

/**
 * Paiement en crypto, dans « Mes crédits » : choisir un pack, envoyer le montant à l'adresse affichée,
 * puis donner l'identifiant de la transaction et la capture de l'envoi. Rien ne s'affiche si le paiement crypto est désactivé.
 */
export function CryptoPay({ packs }: { packs: Pack[] }) {
  const [info, setInfo] = useState<CryptoInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<CryptoOrder | null>(null);
  const [hash, setHash] = useState('');
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [help, setHelp] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [choice, setChoice] = useState('');
  const address = order?.status === 'open' ? order.address : null;

  // QR code de l'adresse : la plupart des portefeuilles savent le scanner.
  useEffect(() => {
    setQr(null);
    if (address) void import('qrcode').then((QR) => QR.toDataURL(address, { margin: 1, width: 360 }).then(setQr));
  }, [address]);

  useEffect(() => {
    api.crypto().then(
      (r) => {
        setInfo(r);
        if (r.enabled && r.order && (r.order.status === 'open' || r.order.status === 'review')) {
          setOrder(r.order);
          setOpen(true);
        }
      },
      () => setInfo({ enabled: false }),
    );
  }, []);

  if (!info?.enabled) return null;
  const token = info.tokens.includes(choice) ? choice : info.tokens[0];
  const payable = packs.filter((p) => info.prices[p.id]);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const start = (pack: Pack) =>
    run(pack.id, async () => {
      setOrder((await api.cryptoOrder(pack.id, token)).order);
      setHash('');
      setProof('');
      setDone(null);
    });

  const submit = () =>
    run('submit', async () => {
      const r = await api.cryptoSubmit(order!.id, hash.trim(), proof);
      if (r.status === 'paid') {
        setDone(order!.credits);
        setOrder(null);
        await refreshAccount();
      } else setOrder(r.order);
    });

  return (
    <section className="mt-3 rounded-2xl border border-slate-200">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-2 px-3 text-left text-sm font-semibold text-slate-800">
        <Coins className="size-4 text-brand-600" aria-hidden="true" />
        <span className="flex-1">{t('Payer en crypto ({0}, réseau {1})', [info.tokens.join(' / '), info.network])}</span>
        <ChevronDown className={cx('size-4 text-slate-500 transition', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          {done !== null && <Notice tone="success">{t('Paiement vérifié : {0} crédits ajoutés à votre compte. Merci !', [done])}</Notice>}

          {order?.status === 'review' && (
            <Notice tone="info">{t('Paiement reçu : notre équipe le vérifie. Vos crédits seront ajoutés dès la validation, en général sous quelques heures.')}</Notice>
          )}

          {(!order || order.status !== 'open') && order?.status !== 'review' && (
            <>
              <p className="text-sm text-slate-600">{t('Choisissez un pack. Vous aurez {0} minutes pour envoyer le montant.', [info.minutes])}</p>
              {info.tokens.length > 1 && (
                <div className="flex gap-2" role="group" aria-label={t('Monnaie')}>
                  {info.tokens.map((tk) => (
                    <button
                      key={tk}
                      type="button"
                      aria-pressed={tk === token}
                      onClick={() => setChoice(tk)}
                      className={cx('min-h-11 flex-1 rounded-xl border-2 px-3 text-sm font-semibold', tk === token ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-700')}
                    >
                      {tk}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {payable.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                    <p className="flex-1 text-sm font-semibold text-slate-900">{t('{0} crédits', [p.credits])}</p>
                    <Button size="sm" variant="secondary" loading={busy === p.id} disabled={busy !== null} onClick={() => start(p)}>
                      {info.prices[p.id]} {token}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          {order?.status === 'open' && (
            <>
              <ol className="space-y-3 text-sm text-slate-700">
                <li>
                  <p className="font-semibold text-slate-900">{t('1. Envoyez exactement')}</p>
                  <p className="mt-1 font-display text-2xl font-bold text-brand-700">
                    {order.amount} {order.token}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{t('Le montant exact, ni plus ni moins.')}</p>
                  <p className="text-xs text-slate-500">{t('pour {0} crédits. Si votre plateforme prélève des frais, vérifiez que le montant reçu est bien de {1} {2}.', [order.credits, order.amount, order.token])}</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-600">
                    <li>{t('Si vous envoyez moins : aucun crédit n’est ajouté automatiquement. Notre équipe vérifie, puis vous crédite selon le montant réellement reçu.')}</li>
                    <li>{t('En dessous de la valeur d’un crédit, le montant n’est ni crédité ni remboursé.')}</li>
                    <li>{t('Si vous envoyez plus : votre pack est validé, mais le surplus n’est pas remboursé. Écrivez-nous depuis « Nous contacter » pour le recevoir en crédits.')}</li>
                  </ul>
                </li>
                <li>
                  <p className="font-semibold text-slate-900">{t('2. Sur le réseau {0} (BNB Smart Chain), à cette adresse', [order.network])}</p>
                  <div className="mt-1 flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200">
                    <code className="min-w-0 flex-1 text-xs break-all text-slate-800">{order.address}</code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(order.address).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        });
                      }}
                      className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-700"
                    >
                      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />} {copied ? t('Copié') : t('Copier')}
                    </button>
                  </div>
                  {qr && <img src={qr} alt={t('QR code de l’adresse')} width={150} height={150} className="mt-2 rounded-lg ring-1 ring-slate-200" />}
                  <p className="mt-1 text-xs text-amber-800">{t('Attention : seulement en {0} et seulement sur le réseau {1}. Un envoi sur un autre réseau ou dans une autre monnaie est perdu.', [order.token, order.network])}</p>
                  <p className="text-xs text-slate-500">{t('Commande valable jusqu’à {0}.', [hour(order.expiresAt)])}</p>
                </li>
                <li>
                  <p className="font-semibold text-slate-900">{t('3. Une fois l’envoi fait, confirmez ici')}</p>
                </li>
              </ol>
              <Field label={t('Identifiant de la transaction (TxID / hash)')} value={hash} onChange={(v) => setHash(v.replace(/\s/g, '').slice(0, 80))} placeholder="0x…" />
              <button type="button" onClick={() => setHelp(!help)} aria-expanded={help} className="-mt-1 flex min-h-11 items-center text-sm font-semibold text-brand-700">
                {t('Où trouver cet identifiant ?')}
              </button>
              {help && (
                <ul className="-mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                  <li>{t('Portefeuille (Trust Wallet, MetaMask…) : ouvrez la transaction dans l’historique, puis copiez « Identifiant de transaction ».')}</li>
                  <li>{t('Plateforme d’échange : dans l’historique des retraits, copiez le « TxID » de l’envoi.')}</li>
                  <li>{t('Il commence par 0x et compte 66 caractères.')}</li>
                </ul>
              )}
              <input
                ref={file}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void run('proof', async () => setProof(await shrink(f)));
                }}
              />
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" icon={<ImagePlus className="size-4" />} loading={busy === 'proof'} onClick={() => file.current?.click()}>
                  {proof ? t('Changer la capture') : t('Ajouter la capture de l’envoi')}
                </Button>
                {proof && <img src={proof} alt={t('Capture de l’envoi')} className="h-14 w-10 rounded-md object-cover ring-1 ring-slate-200" />}
              </div>
              <p className="text-xs text-slate-500">{t('La capture de la confirmation d’envoi, où l’on voit le montant et l’adresse. Elle sert de preuve en cas de doute.')}</p>
              <Button icon={<ShieldCheck className="size-4" />} loading={busy === 'submit'} disabled={busy !== null || hash.length < 66 || !proof} onClick={submit}>
                {t('Vérifier mon paiement')}
              </Button>
              <p className="text-xs text-slate-500">{t('Le paiement est vérifié directement sur la blockchain. Il faut parfois attendre une minute après l’envoi.')}</p>
            </>
          )}

          {order?.status === 'refused' && order.note && <Notice tone="warn">{t('Votre dernier paiement n’a pas été validé : {0}', [order.note])}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
    </section>
  );
}
