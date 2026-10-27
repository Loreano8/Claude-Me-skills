import { create } from 'zustand';

// Coffre-fort : documents personnels (pièce d'identité, diplômes…) gardés sur l'appareil, dans IndexedDB.
// Chaque fichier est chiffré (AES-GCM) avec une clé propre au coffre. Avec un code, cette clé est elle-même
// chiffrée par le code (PBKDF2) : sans le code, les fichiers sont illisibles, même en fouillant le téléphone.
// Un double de la clé est gardé sur le serveur, rattaché au compte, pour réinitialiser un code oublié.

export type Category = 'identite' | 'diplome' | 'attestation' | 'autre';
export const CATEGORIES: Record<Category, string> = {
  identite: 'Identité',
  diplome: 'Diplôme',
  attestation: 'Attestation',
  autre: 'Autre',
};

export interface VaultDoc {
  id: string;
  name: string;
  mime: string;
  size: number;
  category: Category;
  createdAt: number;
}

interface Meta {
  /** Avec code : clé chiffrée par le code. Sans code : clé en clair (coffre simplement rangé dans l'appli). */
  pin: boolean;
  salt?: string;
  wrapped?: string;
  raw?: string;
  createdAt: number;
}

const DB_NAME = 'cv-studio-coffre';
const PBKDF2_ROUNDS = 310_000;

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('meta');
      db.createObjectStore('docs', { keyPath: 'id' });
      db.createObjectStore('files');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(stores: string[], mode: IDBTransactionMode, run: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const req = run(t);
    t.oncomplete = () => resolve(req ? req.result : (undefined as T));
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Stockage indisponible.'));
  });
}

const getMeta = () => tx<Meta | undefined>(['meta'], 'readonly', (t) => t.objectStore('meta').get('config'));
const putMeta = (meta: Meta) => tx(['meta'], 'readwrite', (t) => void t.objectStore('meta').put(meta, 'config'));

async function pinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ROUNDS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function seal(key: CryptoKey, data: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as BufferSource));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

async function open(key: CryptoKey, data: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12));
}

const importRaw = (raw: string) => crypto.subtle.importKey('raw', unb64(raw) as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);

async function wrapMeta(raw: string, pin: string | null, createdAt: number): Promise<Meta> {
  if (!pin) return { pin: false, raw, createdAt };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapped = await seal(await pinKey(pin, salt), unb64(raw));
  return { pin: true, salt: b64(salt), wrapped: b64(wrapped), createdAt };
}

/** État du coffre pour l'écran : absent, verrouillé ou ouvert (clé en mémoire le temps de la visite). */
interface VaultState {
  status: 'loading' | 'absent' | 'locked' | 'open';
  pin: boolean;
  /** Clé brute (base64) : gardée en mémoire seulement tant que le coffre est ouvert. */
  raw: string | null;
  key: CryptoKey | null;
  docs: VaultDoc[];
}

export const useVault = create<VaultState>(() => ({ status: 'loading', pin: false, raw: null, key: null, docs: [] }));

const listDocs = () => tx<VaultDoc[]>(['docs'], 'readonly', (t) => t.objectStore('docs').getAll());

async function opened(raw: string, pin: boolean) {
  const docs = (await listDocs()).sort((a, b) => b.createdAt - a.createdAt);
  useVault.setState({ status: 'open', pin, raw, key: await importRaw(raw), docs });
}

/** Au chargement de l'écran : coffre absent, ouvert (sans code) ou verrouillé. */
export async function loadVault(): Promise<void> {
  const meta = await getMeta();
  if (!meta) return useVault.setState({ status: 'absent', pin: false, raw: null, key: null, docs: [] });
  if (!meta.pin && meta.raw) return opened(meta.raw, false);
  useVault.setState({ status: 'locked', pin: true, raw: null, key: null, docs: [] });
}

/** Crée le coffre (avec ou sans code). Renvoie la clé brute, dont le double part sur le serveur. */
export async function createVault(pin: string | null): Promise<string> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = b64(await crypto.subtle.exportKey('raw', key));
  await putMeta(await wrapMeta(raw, pin, Date.now()));
  // Demande au navigateur de ne pas effacer ces données pour faire de la place.
  void navigator.storage?.persist?.().catch(() => false);
  await opened(raw, !!pin);
  return raw;
}

export async function unlockVault(pin: string): Promise<void> {
  const meta = await getMeta();
  if (!meta?.pin || !meta.salt || !meta.wrapped) return loadVault();
  let raw: string;
  try {
    raw = b64(await open(await pinKey(pin, unb64(meta.salt)), unb64(meta.wrapped)));
  } catch {
    throw new Error('Code incorrect.');
  }
  await opened(raw, true);
}

/** Nouveau code (ou retrait du code) : la clé ne change pas, les documents restent lisibles. */
export async function setVaultPin(raw: string, pin: string | null): Promise<void> {
  const meta = await getMeta();
  await putMeta(await wrapMeta(raw, pin, meta?.createdAt ?? Date.now()));
  await opened(raw, !!pin);
}

export function lockVault(): void {
  const { pin } = useVault.getState();
  if (pin) useVault.setState({ status: 'locked', raw: null, key: null, docs: [] });
}

export async function addToVault(blob: Blob, name: string, category: Category): Promise<void> {
  const { key } = useVault.getState();
  if (!key) throw new Error('Ouvrez d’abord le coffre-fort.');
  const doc: VaultDoc = { id: crypto.randomUUID(), name, mime: blob.type || 'application/octet-stream', size: blob.size, category, createdAt: Date.now() };
  const data = await seal(key, await blob.arrayBuffer());
  await tx(['docs', 'files'], 'readwrite', (t) => {
    t.objectStore('docs').put(doc);
    t.objectStore('files').put(data, doc.id);
  });
  useVault.setState((s) => ({ docs: [doc, ...s.docs] }));
}

export async function readFromVault(doc: VaultDoc): Promise<Blob> {
  const { key } = useVault.getState();
  if (!key) throw new Error('Ouvrez d’abord le coffre-fort.');
  const data = await tx<Uint8Array | undefined>(['files'], 'readonly', (t) => t.objectStore('files').get(doc.id));
  if (!data) throw new Error('Document introuvable.');
  return new Blob([await open(key, data)], { type: doc.mime });
}

export async function updateVaultDoc(id: string, patch: Partial<Pick<VaultDoc, 'name' | 'category'>>): Promise<void> {
  const doc = useVault.getState().docs.find((d) => d.id === id);
  if (!doc) return;
  const next = { ...doc, ...patch };
  await tx(['docs'], 'readwrite', (t) => void t.objectStore('docs').put(next));
  useVault.setState((s) => ({ docs: s.docs.map((d) => (d.id === id ? next : d)) }));
}

export async function deleteFromVault(id: string): Promise<void> {
  await tx(['docs', 'files'], 'readwrite', (t) => {
    t.objectStore('docs').delete(id);
    t.objectStore('files').delete(id);
  });
  useVault.setState((s) => ({ docs: s.docs.filter((d) => d.id !== id) }));
}

/** Vérifie qu'une clé (rendue par le serveur) ouvre bien les documents de ce téléphone. */
export async function checkVaultKey(raw: string): Promise<boolean> {
  const [doc] = await listDocs();
  if (!doc) return true;
  const data = await tx<Uint8Array | undefined>(['files'], 'readonly', (t) => t.objectStore('files').get(doc.id));
  if (!data) return true;
  try {
    await open(await importRaw(raw), data);
    return true;
  } catch {
    return false;
  }
}
