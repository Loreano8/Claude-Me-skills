import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStore } from '../store.ts';
import { useAccount } from './account.ts';
import { api } from './api.ts';
import { isCvEmpty } from './cv.ts';
import type { Application, CvDocument, SavedLetter } from '../types.ts';

// Synchronisation entre appareils : le travail (CV, lettres, offre en cours, suivi) suit le compte.
// Activée par défaut pour un compte connecté, annoncée à la personne, et désactivable dans Réglages
// (la copie du serveur est alors effacée). Les papiers du coffre-fort ne sont jamais synchronisés.

interface SyncState {
  enabled: boolean;
  /** Compte dont ce téléphone a déjà reçu les données (évite de mélanger deux comptes sur un même appareil). */
  owner: string | null;
  /** Éléments supprimés ici (id → date), envoyés pour qu'ils disparaissent aussi ailleurs. */
  deleted: Record<string, number>;
  lastSync: number | null;
  /** Message « Votre travail est maintenant sur tous vos appareils » déjà vu. */
  announced: boolean;
  status: 'idle' | 'syncing' | 'error';
  set: (p: Partial<Omit<SyncState, 'set'>>) => void;
}

export const useSync = create<SyncState>()(
  persist(
    (set) => ({ enabled: true, owner: null, deleted: {}, lastSync: null, announced: false, status: 'idle', set: (p) => set(p) }),
    { name: 'cvcasa-sync', partialize: ({ status: _s, set: _f, ...rest }) => rest },
  ),
);

interface Snapshot {
  cvs: CvDocument[];
  letters: SavedLetter[];
  applications: Application[];
  job: { text: string };
  deleted: Record<string, number>;
}

/** Garde la version la plus récente de chaque élément, sans ceux qui ont été supprimés. */
export function mergeById<T extends { id: string; updatedAt: number }>(a: T[], b: T[], deleted: Record<string, number>): T[] {
  const byId = new Map<string, T>();
  for (const item of [...a, ...b]) {
    if (!item || typeof item.id !== 'string') continue;
    const del = deleted[item.id];
    if (del && del >= (item.updatedAt ?? 0)) continue;
    const prev = byId.get(item.id);
    if (!prev || (item.updatedAt ?? 0) > (prev.updatedAt ?? 0)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

export function mergeSnapshots(local: Snapshot, remote: Snapshot | null): Snapshot {
  if (!remote) return local;
  const deleted = { ...remote.deleted, ...local.deleted };
  for (const [id, at] of Object.entries(remote.deleted ?? {})) deleted[id] = Math.max(at, local.deleted[id] ?? 0);
  // Un CV vide créé d'office sur un appareil ne doit pas s'ajouter aux vrais CV du compte.
  const all = mergeById(local.cvs, remote.cvs, deleted);
  const filled = all.filter((c) => !isCvEmpty(c));
  return {
    cvs: filled.length ? filled : all.slice(0, 1),
    letters: mergeById(local.letters, remote.letters, deleted),
    applications: mergeById(local.applications, remote.applications, deleted),
    job: { text: local.job.text || remote.job.text },
    deleted,
  };
}

function localSnapshot(): Snapshot {
  const s = useStore.getState();
  return { cvs: s.cvs, letters: s.letters, applications: s.applications, job: { text: s.job.text }, deleted: useSync.getState().deleted };
}

const fingerprint = (s: Snapshot) =>
  JSON.stringify([s.cvs.map((c) => [c.id, c.updatedAt]), s.letters.map((l) => [l.id, l.updatedAt]), s.applications.map((a) => [a.id, a.updatedAt]), s.job.text.length, Object.keys(s.deleted).length]);

let running: Promise<void> | null = null;
let applying = false;

/** Récupère la copie du compte, la fusionne avec ce qui est sur cet appareil, puis renvoie le résultat. */
export function syncNow(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const { token, user } = useAccount.getState();
    const sync = useSync.getState();
    if (!token || !user || !sync.enabled) return;
    sync.set({ status: 'syncing' });
    try {
      const remote = await api.syncGet();
      if (!remote.available) return sync.set({ status: 'idle' });
      // Autre compte que celui déjà synchronisé ici : on repart de la copie de ce compte (l'autre est sur son compte).
      const switched = sync.owner && sync.owner !== user.identifier;
      const local: Snapshot = switched ? { cvs: [], letters: [], applications: [], job: { text: '' }, deleted: {} } : localSnapshot();
      const merged = mergeSnapshots(local, (remote.data as Snapshot | null) ?? null);
      const store = useStore.getState();
      if (switched || fingerprint(merged) !== fingerprint(localSnapshot())) {
        applying = true;
        const cvs = merged.cvs.length ? merged.cvs : store.cvs;
        useStore.setState({
          cvs,
          activeId: cvs.some((c) => c.id === store.activeId) ? store.activeId : cvs[0].id,
          letters: merged.letters,
          activeLetterId: merged.letters.some((l) => l.id === store.activeLetterId) ? store.activeLetterId : null,
          letter: merged.letters.find((l) => l.id === store.activeLetterId)?.letter ?? store.letter,
          applications: merged.applications,
          job: { ...store.job, text: merged.job.text },
        });
        applying = false;
      }
      // Les suppressions de plus de 60 jours sont oubliées : tous les appareils les ont reçues.
      const cutoff = Date.now() - 60 * 24 * 3600 * 1000;
      const deleted = Object.fromEntries(Object.entries(merged.deleted).filter(([, at]) => at > cutoff));
      const toSend = { ...localSnapshot(), deleted };
      if (!remote.data || fingerprint(toSend) !== fingerprint(remote.data as Snapshot)) await api.syncSave(toSend);
      useSync.getState().set({ owner: user.identifier, deleted, lastSync: Date.now(), status: 'idle' });
    } catch {
      useSync.getState().set({ status: 'error' });
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Arrête la synchronisation et efface la copie du serveur. Le travail reste sur cet appareil. */
export async function stopSync(): Promise<void> {
  useSync.getState().set({ enabled: false, owner: null });
  if (useAccount.getState().token) await api.syncErase().catch(() => {});
}

export function startSync(): void {
  useSync.getState().set({ enabled: true });
  void syncNow();
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** À appeler une fois au démarrage : synchronise à l'ouverture, au retour sur l'appli, et après chaque modification. */
export function initSync(): () => void {
  void syncNow();
  const ids = (s: ReturnType<typeof useStore.getState>) => new Set([...s.cvs.map((c) => c.id), ...s.letters.map((l) => l.id), ...s.applications.map((a) => a.id)]);
  const unsubStore = useStore.subscribe((now, before) => {
    if (applying) return;
    // Un élément qui disparaît a été supprimé ici : on le note pour les autres appareils.
    const gone = [...ids(before)].filter((id) => !ids(now).has(id));
    if (gone.length) {
      const at = Date.now();
      useSync.getState().set({ deleted: { ...useSync.getState().deleted, ...Object.fromEntries(gone.map((id) => [id, at])) } });
    }
    if (now.cvs === before.cvs && now.letters === before.letters && now.applications === before.applications && now.job.text === before.job.text) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 4000);
  });
  const unsubAccount = useAccount.subscribe((now, before) => {
    if (now.token && now.token !== before.token) void syncNow();
  });
  const onVisible = () => document.visibilityState === 'visible' && void syncNow();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    unsubStore();
    unsubAccount();
    document.removeEventListener('visibilitychange', onVisible);
  };
}
