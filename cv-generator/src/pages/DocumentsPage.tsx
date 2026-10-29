import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Eye, FileStack, FileText, FileUser, Image as ImageIcon, KeyRound, Lock, Mail, Paperclip, Pencil, Search, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { useStore } from '../store.ts';
import { useAccount } from '../lib/account.ts';
import { api } from '../lib/api.ts';
import { formatSize, processPhoto } from '../lib/dossier.ts';
import {
  addToVault,
  CATEGORIES,
  checkVaultKey,
  createVault,
  deleteFromVault,
  loadVault,
  lockVault,
  readFromVault,
  setVaultPin,
  unlockVault,
  updateVaultDoc,
  useVault,
  type Category,
  type VaultDoc,
} from '../lib/vault.ts';
import { saveFile } from '../export/save.ts';
import { useDossierInbox } from './DossierPage.tsx';
import { Modal } from '../components/AccountDialogs.tsx';
import { Button, Card, cx, Field, Notice } from '../components/ui.tsx';
import type { Tab } from '../App.tsx';

const when = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

// ---- Mes créations : CV et lettres ---------------------------------------------

function Creations({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const cvs = useStore((s) => s.cvs);
  const letters = useStore((s) => s.letters);
  const { setActive, deleteCv, openLetter, deleteLetter } = useStore.getState();
  const [filter, setFilter] = useState<'tout' | 'cv' | 'lettre'>('tout');
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const cvName = (id: string) => cvs.find((c) => c.id === id)?.label ?? '';
    const all = [
      ...cvs.map((c) => ({
        id: c.id,
        kind: 'cv' as const,
        title: c.label,
        type: c.adaptation ? 'CV adapté' : c.translation ? 'CV traduit' : 'CV',
        detail: c.adaptation ? [c.adaptation.job.title, c.adaptation.job.company].filter(Boolean).join(' · ') : '',
        date: c.updatedAt,
      })),
      ...letters.map((l) => ({
        id: l.id,
        kind: 'lettre' as const,
        title: l.letter.subject.replace(/^(objet|subject)\s*:\s*/i, '') || l.letter.recipientCompany || 'Lettre de motivation',
        type: 'Lettre',
        detail: [l.letter.recipientCompany, cvName(l.cvId) && `CV : ${cvName(l.cvId)}`].filter(Boolean).join(' · '),
        date: l.updatedAt,
      })),
    ];
    const q = query.trim().toLowerCase();
    return all
      .filter((it) => filter === 'tout' || it.kind === filter)
      .filter((it) => !q || `${it.title} ${it.detail} ${it.type}`.toLowerCase().includes(q))
      .sort((a, b) => b.date - a.date);
  }, [cvs, letters, filter, query]);

  return (
    <Card tour="creations" title="Créés avec CVCasa" subtitle="Tous vos CV (y compris adaptés et traduits) et vos lettres, du plus récent au plus ancien.">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['tout', 'Tout'],
            ['cv', 'CV'],
            ['lettre', 'Lettres'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cx('rounded-full px-3 py-1.5 text-sm font-medium', filter === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700')}
          >
            {label}
          </button>
        ))}
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-brand-500">
          <Search className="size-4 shrink-0 text-slate-400" />
          <span className="sr-only">Rechercher</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
        </label>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={`${it.kind}-${it.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
              {it.kind === 'cv' ? <FileUser className="size-5 text-brand-600" /> : <Mail className="size-5 text-brand-600" />}
            </div>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                if (it.kind === 'cv') {
                  setActive(it.id);
                  onNavigate('apercu');
                } else {
                  openLetter(it.id);
                  onNavigate('lettre');
                }
              }}
            >
              <p className="truncate text-sm font-semibold text-slate-900">{it.title}</p>
              <p className="truncate text-xs text-slate-500">
                {it.type} · {when(it.date)}
                {it.detail && ` · ${it.detail}`}
              </p>
            </button>
            <button
              type="button"
              aria-label="Supprimer"
              className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              onClick={() => {
                if (!window.confirm(`Supprimer « ${it.title} » ? Cette action est définitive.`)) return;
                if (it.kind === 'cv') deleteCv(it.id);
                else deleteLetter(it.id);
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {items.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Rien à afficher.</p>}
      </ul>
    </Card>
  );
}

// ---- Coffre-fort ---------------------------------------------------------------

function PinFields({ onSubmit, busy, label }: { onSubmit: (pin: string) => void; busy: boolean; label: string }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const ok = /^\d{4,6}$/.test(pin) && pin === again;
  return (
    <div className="space-y-3">
      <Field label="Code (4 à 6 chiffres)" type="password" value={pin} onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} />
      <Field label="Confirmez le code" type="password" value={again} onChange={(v) => setAgain(v.replace(/\D/g, '').slice(0, 6))} />
      {again.length >= 4 && pin !== again && <p className="text-sm text-red-600">Les deux codes ne sont pas identiques.</p>}
      <Button icon={<Lock className="size-4" />} loading={busy} disabled={!ok || busy} onClick={() => onSubmit(pin)}>
        {label}
      </Button>
    </div>
  );
}

/** Garde le double de la clé sur le serveur (réinitialisation d'un code oublié). Sans connexion, réessayé plus tard. */
async function backupKey(raw: string) {
  if (!useAccount.getState().user) return;
  await api.vaultSaveKey(raw).catch(() => {});
}

function VaultSetup() {
  const user = useAccount((s) => s.user);
  const [withPin, setWithPin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(pin: string | null) {
    setBusy(true);
    setError(null);
    try {
      const raw = await createVault(pin);
      if (pin) await backupKey(raw);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">
        Rangez ici votre pièce d’identité, vos diplômes, vos attestations… pour les retrouver, les envoyer ou les ajouter à un dossier en un toucher.
      </p>
      <Notice tone="info">
        Vos documents restent sur ce téléphone : ils ne sont jamais envoyés sur internet. Avec un code, ils sont chiffrés. Code oublié ? Vous pourrez le réinitialiser avec votre compte.
      </Notice>
      {withPin === null && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            icon={<ShieldCheck className="size-4" />}
            onClick={() => {
              if (!user) return useAccount.getState().open('account', 'Créez un compte gratuit : il permet de réinitialiser le code de votre coffre-fort si vous l’oubliez.');
              setWithPin(true);
            }}
          >
            Protéger par un code (recommandé)
          </Button>
          <Button variant="secondary" loading={busy} onClick={() => void create(null)}>
            Sans code
          </Button>
        </div>
      )}
      {withPin && (
        <>
          <PinFields busy={busy} label="Créer mon coffre-fort" onSubmit={(pin) => void create(pin)} />
          <p className="text-xs text-slate-500">Code oublié ? Vous pourrez le réinitialiser avec votre compte ({user?.identifier}).</p>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function VaultReset({ onDone }: { onDone: () => void }) {
  const user = useAccount((s) => s.user);
  const [emailOn, setEmailOn] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.health().then((h) => setEmailOn(!!h.email), () => {});
  }, []);

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-700">Pour réinitialiser le code, connectez-vous au compte avec lequel vous avez créé le coffre-fort.</p>
        <Button onClick={() => useAccount.getState().open('account', 'Connectez-vous pour réinitialiser le code de votre coffre-fort.')}>Me connecter</Button>
      </div>
    );
  }

  async function recover(proof: { password: string } | { code: string }) {
    setBusy(true);
    setError(null);
    try {
      const { key } = await api.vaultRecover(proof);
      if (!(await checkVaultKey(key))) throw new Error('Ce compte ne correspond pas au coffre-fort de ce téléphone.');
      setRaw(key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      setSentTo((await api.vaultSendCode()).to);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (raw) {
    return (
      <div className="space-y-3">
        <Notice tone="success">C’est bien vous. Choisissez un nouveau code.</Notice>
        <PinFields
          busy={busy}
          label="Enregistrer le nouveau code"
          onSubmit={async (pin) => {
            setBusy(true);
            await setVaultPin(raw, pin);
            await backupKey(raw);
            setBusy(false);
            onDone();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">Avec le mot de passe de votre compte ({user.identifier})</p>
        <Field label="Mot de passe du compte" type="password" value={password} onChange={setPassword} />
        <Button size="sm" loading={busy && !!password} disabled={busy || !password} onClick={() => void recover({ password })}>
          Valider
        </Button>
      </div>
      <div className="space-y-2 border-t border-slate-100 pt-3">
        <p className="text-sm font-medium text-slate-800">Ou avec un code reçu par e-mail</p>
        {!emailOn ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">Bientôt disponible</span> Utilisez le mot de passe de votre compte ci-dessus.
          </p>
        ) : !user.identifier.includes('@') ? (
          <p className="text-sm text-slate-500">Votre compte utilise un numéro de téléphone : utilisez le mot de passe de votre compte ci-dessus.</p>
        ) : !sentTo ? (
            <Button size="sm" variant="secondary" icon={<Mail className="size-4" />} loading={busy && !password} disabled={busy} onClick={() => void sendCode()}>
              M’envoyer un code
            </Button>
          ) : (
            <>
              <p className="text-xs text-slate-500">Code envoyé à {sentTo}. Pensez à regarder dans les spams.</p>
              <Field label="Code reçu (6 chiffres)" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} />
              <Button size="sm" disabled={busy || code.length !== 6} onClick={() => void recover({ code })}>
                Valider le code
              </Button>
            </>
          )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function VaultLocked() {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  const fails = useRef(0);

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      await unlockVault(pin);
      fails.current = 0;
      const { raw } = useVault.getState();
      if (raw) void backupKey(raw);
    } catch (e) {
      fails.current++;
      setPin('');
      setError(fails.current >= 3 ? `${(e as Error).message} Code oublié ? Réinitialisez-le ci-dessous.` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (reset) return <VaultReset onDone={() => setReset(false)} />;
  return (
    <div className="space-y-3">
      <Field label="Code du coffre-fort" type="password" value={pin} onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} />
      <div className="flex flex-wrap items-center gap-2">
        <Button icon={<KeyRound className="size-4" />} loading={busy} disabled={busy || pin.length < 4} onClick={() => void unlock()}>
          Ouvrir
        </Button>
        <Button variant="ghost" onClick={() => setReset(true)}>
          Code oublié ?
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function VaultOpen({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const docs = useVault((s) => s.docs);
  const pin = useVault((s) => s.pin);
  const raw = useVault((s) => s.raw);
  const [category, setCategory] = useState<Category>('identite');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ name: string; url: string } | null>(null);
  const [changingPin, setChangingPin] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  async function add(list: FileList | null, fromCamera: boolean) {
    if (!list?.length) return;
    setBusy('add');
    setError(null);
    try {
      for (const f of Array.from(list)) {
        if (f.size > 25 * 1024 * 1024) throw new Error(`« ${f.name} » est trop lourd (25 Mo maximum).`);
        const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
        if (!isPdf && !f.type.startsWith('image/')) throw new Error(`« ${f.name} » : PDF ou image seulement.`);
        // Photos : redressées, allégées et au format JPEG (lisible partout, assemblable en PDF).
        const blob = isPdf ? new Blob([f], { type: 'application/pdf' }) : await processPhoto(f, 'couleur', 0);
        const name = fromCamera ? `${CATEGORIES[category]} ${new Date().toLocaleDateString('fr-FR')}` : f.name.replace(/\.[^.]+$/, '');
        await addToVault(blob, name, category);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function withDoc(doc: VaultDoc, action: 'view' | 'send' | 'dossier') {
    setBusy(doc.id);
    setError(null);
    try {
      const blob = await readFromVault(doc);
      const ext = doc.mime === 'application/pdf' ? 'pdf' : 'jpg';
      if (action === 'view') setViewing({ name: doc.name, url: URL.createObjectURL(blob) });
      else if (action === 'send') await saveFile(blob, `${doc.name}.${ext}`);
      else {
        useDossierInbox.getState().add(new File([blob], `${doc.name}.${ext}`, { type: doc.mime }));
        onNavigate('dossier');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function backup() {
    setBusy('backup');
    setError(null);
    try {
      const { buildDossier } = await import('../lib/dossier.ts');
      const parts = [];
      for (const d of docs) {
        const blob = await readFromVault(d);
        parts.push(d.mime === 'application/pdf' ? { kind: 'pdf' as const, name: d.name, bytes: await blob.arrayBuffer() } : { kind: 'image' as const, name: d.name, blob });
      }
      await saveFile(await buildDossier(parts), `Coffre-fort_copie_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const groups = (Object.keys(CATEGORIES) as Category[]).map((c) => ({ c, list: docs.filter((d) => d.category === c) })).filter((g) => g.list.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">Ranger dans :</span>
        {(Object.keys(CATEGORIES) as Category[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cx('rounded-full px-3 py-1 text-sm font-medium', category === c ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700')}
          >
            {CATEGORIES[c]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Camera className="size-4" />} loading={busy === 'add'} disabled={busy !== null} onClick={() => camera.current?.click()}>
          Prendre en photo
        </Button>
        <Button variant="secondary" icon={<Paperclip className="size-4" />} disabled={busy !== null} onClick={() => files.current?.click()}>
          Ajouter des fichiers
        </Button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void add(e.target.files, true); e.target.value = ''; }} />
      <input ref={files} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => { void add(e.target.files, false); e.target.value = ''; }} />

      {groups.map(({ c, list }) => (
        <div key={c}>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">{CATEGORIES[c]}</p>
          <ul className="space-y-2">
            {list.map((d) => (
              <li key={d.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    {d.mime === 'application/pdf' ? <FileText className="size-5 text-red-600" /> : <ImageIcon className="size-5 text-slate-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{d.name}</p>
                    <p className="text-xs text-slate-500">
                      {when(d.createdAt)} · {formatSize(d.size)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.mime !== 'application/pdf' && (
                    <Button size="sm" variant="secondary" icon={<Eye className="size-4" />} disabled={busy !== null} onClick={() => void withDoc(d, 'view')}>
                      Voir
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" icon={<Send className="size-4" />} loading={busy === d.id} disabled={busy !== null} onClick={() => void withDoc(d, 'send')}>
                    Envoyer / enregistrer
                  </Button>
                  <Button size="sm" variant="secondary" icon={<FileStack className="size-4" />} disabled={busy !== null} onClick={() => void withDoc(d, 'dossier')}>
                    Au dossier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Pencil className="size-4" />}
                    onClick={() => {
                      const name = window.prompt('Nouveau nom', d.name)?.trim();
                      if (name) void updateVaultDoc(d.id, { name });
                    }}
                  >
                    <span className="sr-only">Renommer</span>
                  </Button>
                  <select
                    aria-label="Rubrique"
                    value={d.category}
                    onChange={(e) => void updateVaultDoc(d.id, { category: e.target.value as Category })}
                    className="rounded-lg bg-slate-50 px-2 text-sm ring-1 ring-slate-200"
                  >
                    {(Object.keys(CATEGORIES) as Category[]).map((k) => (
                      <option key={k} value={k}>
                        {CATEGORIES[k]}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="size-4" />}
                    onClick={() => window.confirm(`Supprimer « ${d.name} » du coffre-fort ?`) && void deleteFromVault(d.id)}
                  >
                    <span className="sr-only">Supprimer</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {docs.length === 0 && <p className="py-2 text-sm text-slate-500">Votre coffre-fort est vide. Ajoutez votre pièce d’identité, vos diplômes…</p>}

      {error && <Notice tone="error">{error}</Notice>}

      <div className="space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
        <p>Vos documents restent sur ce téléphone{pin ? ', chiffrés par votre code' : ''}. Si vous désinstallez l’appli ou changez de téléphone, faites d’abord une copie de secours.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={busy === 'backup'} disabled={busy !== null || docs.length === 0} onClick={() => void backup()}>
            Copie de secours (un PDF)
          </Button>
          {pin ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setChangingPin(!changingPin)}>
                Changer le code
              </Button>
              <Button size="sm" variant="ghost" icon={<Lock className="size-4" />} onClick={lockVault}>
                Verrouiller
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              icon={<ShieldCheck className="size-4" />}
              onClick={() => {
                if (!useAccount.getState().user) return useAccount.getState().open('account', 'Créez un compte gratuit : il permet de réinitialiser le code de votre coffre-fort si vous l’oubliez.');
                setChangingPin(!changingPin);
              }}
            >
              Protéger par un code
            </Button>
          )}
        </div>
        {changingPin && raw && (
          <PinFields
            busy={false}
            label="Enregistrer le code"
            onSubmit={async (p) => {
              await setVaultPin(raw, p);
              await backupKey(raw);
              setChangingPin(false);
            }}
          />
        )}
        <p className="text-xs text-slate-400">Sauvegarde en ligne (retrouver ses documents sur un autre téléphone) · bientôt</p>
      </div>

      {viewing && (
        <Modal
          title={viewing.name}
          onClose={() => {
            URL.revokeObjectURL(viewing.url);
            setViewing(null);
          }}
        >
          <img src={viewing.url} alt={viewing.name} className="w-full rounded-lg" />
        </Modal>
      )}
    </div>
  );
}

function Vault({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const status = useVault((s) => s.status);
  useEffect(() => {
    void loadVault().catch(() => useVault.setState({ status: 'absent' }));
    // En quittant la page, le coffre se referme (la clé ne reste pas en mémoire).
    return () => lockVault();
  }, []);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-600" /> Coffre-fort
        </span>
      }
      subtitle="Vos papiers importants, toujours sous la main."
    >
      {status === 'loading' && <div className="h-20 animate-pulse rounded-xl bg-slate-100" />}
      {status === 'absent' && <VaultSetup />}
      {status === 'locked' && <VaultLocked />}
      {status === 'open' && <VaultOpen onNavigate={onNavigate} />}
    </Card>
  );
}

/** « Mes documents » : tout ce qui a été créé, et le coffre-fort des documents personnels. */
export function DocumentsPage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [part, setPart] = useState<'creations' | 'coffre'>('creations');
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div data-tour="doc-tabs" className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 ring-1 ring-slate-200">
        {(
          [
            ['creations', 'Mes créations', FileUser],
            ['coffre', 'Coffre-fort', ShieldCheck],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPart(id)}
            className={cx('flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold', part === id ? 'bg-brand-600 text-white' : 'text-slate-600')}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {part === 'creations' ? <Creations onNavigate={onNavigate} /> : <Vault onNavigate={onNavigate} />}
    </div>
  );
}
