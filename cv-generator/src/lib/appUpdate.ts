import { App } from '@capacitor/app';
import { CapacitorHttp } from '@capacitor/core';
import { CapacitorUpdater, type ManifestEntry } from '@capgo/capacitor-updater';
import { PUBLIC_SITE } from './referral.ts';

// Mises à jour de l'application sans nouvelle APK.
// À chaque mise en ligne, le site publie app-update/latest.json : la version du code et la liste des fichiers de
// l'application avec leur empreinte (SHA-256). L'appli compare avec sa propre version ; si une version plus récente
// existe, elle télécharge en arrière-plan uniquement les fichiers qui ont changé, puis l'applique au prochain lancement.
// Si la nouvelle version ne démarre pas (notifyAppReady jamais appelé), l'outil revient tout seul à la précédente.

export interface LatestBundle {
  version: string;
  /** Plus petit numéro d'APK capable de faire tourner cette version (à relever quand on ajoute un outil natif). */
  minNativeBuild: number;
  manifest: ManifestEntry[];
}

/** Ne garde une version que si elle est différente de celle qui tourne et compatible avec l'APK installée. */
export function shouldInstall(latest: LatestBundle | null, current: string, nativeBuild: number): boolean {
  return Boolean(latest && latest.version && latest.version !== current && latest.manifest?.length && nativeBuild >= latest.minNativeBuild);
}

/** La version plus récente publiée sur le site, si elle peut être installée sur cette APK ; sinon null. */
export async function findUpdate(): Promise<LatestBundle | null> {
  // Requête native : l'appli (https://localhost) lit la fiche de cvcasa.com sans règle de partage entre sites.
  const res = await CapacitorHttp.get({ url: `${PUBLIC_SITE}/app-update/latest.json?t=${Date.now()}`, responseType: 'json' });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const latest = (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as LatestBundle;
  const nativeBuild = Number((await App.getInfo()).build) || 0;
  return shouldInstall(latest, __BUILD_ID__, nativeBuild) ? latest : null;
}

const PENDING = 'cvcasa-update-pret';

/**
 * Télécharge la version (seulement les fichiers modifiés). Elle est appliquée :
 * tout de suite si la personne l'a demandé (l'appli redémarre), sinon au prochain vrai lancement de l'appli.
 * Jamais au passage en arrière-plan : une personne qui sort de l'appli un instant (touche Accueil, autre appli)
 * doit retrouver son travail en cours exactement comme elle l'a laissé.
 */
export async function installUpdate(latest: LatestBundle, now = false): Promise<void> {
  // Déjà téléchargée (lancement précédent) : pas besoin de recommencer.
  const { bundles } = await CapacitorUpdater.list();
  const ready = bundles.find((b) => b.version === latest.version && b.status === 'success');
  const bundle = ready ?? (await CapacitorUpdater.download({ url: '', version: latest.version, manifest: latest.manifest }));
  if (now) await CapacitorUpdater.set({ id: bundle.id });
  else {
    try {
      localStorage.setItem(PENDING, JSON.stringify({ id: bundle.id, version: latest.version }));
    } catch {
      /* stockage indisponible : la mise à jour sera retéléchargée au prochain lancement */
    }
  }
}

/** Au lancement seulement (rien n'est encore en cours de saisie) : applique la version téléchargée la fois d'avant. */
async function applyPendingAtLaunch(): Promise<boolean> {
  let pending: { id: string; version: string } | null = null;
  try {
    pending = JSON.parse(localStorage.getItem(PENDING) ?? 'null');
    localStorage.removeItem(PENDING);
  } catch {
    return false;
  }
  if (!pending || pending.version === __BUILD_ID__) return false;
  const { bundles } = await CapacitorUpdater.list();
  if (!bundles.some((b) => b.id === pending!.id && b.status === 'success')) return false;
  await CapacitorUpdater.set({ id: pending.id });
  return true;
}

export async function setupAppUpdates(): Promise<void> {
  // Toujours en premier : signale que cette version démarre bien (sinon retour automatique à la précédente).
  await CapacitorUpdater.notifyAppReady();
  if (await applyPendingAtLaunch().catch(() => false)) return;
  const check = async () => {
    try {
      const latest = await findUpdate();
      // Téléchargée maintenant, appliquée au prochain lancement : jamais en pleine saisie, jamais en arrière-plan.
      if (latest) await installUpdate(latest);
    } catch (e) {
      console.warn('Mise à jour de l’appli', e);
    }
  };
  void check();
  // Une appli restée ouverte plusieurs jours vérifie aussi au retour.
  await App.addListener('resume', () => void check());
}
