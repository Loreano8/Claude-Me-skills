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

/**
 * Télécharge la version (seulement les fichiers modifiés) puis l'applique :
 * tout de suite si la personne l'a demandé (l'appli redémarre), sinon au prochain lancement.
 */
export async function installUpdate(latest: LatestBundle, now = false): Promise<void> {
  // Déjà téléchargée (lancement précédent) : pas besoin de recommencer.
  const { bundles } = await CapacitorUpdater.list();
  const ready = bundles.find((b) => b.version === latest.version && b.status === 'success');
  const bundle = ready ?? (await CapacitorUpdater.download({ url: '', version: latest.version, manifest: latest.manifest }));
  if (now) await CapacitorUpdater.set({ id: bundle.id });
  else await CapacitorUpdater.next({ id: bundle.id });
}

export async function setupAppUpdates(): Promise<void> {
  // Toujours en premier : signale que cette version démarre bien (sinon retour automatique à la précédente).
  await CapacitorUpdater.notifyAppReady();
  const check = async () => {
    try {
      const latest = await findUpdate();
      // Appliquée quand l'appli passe en arrière-plan ou au prochain lancement : jamais en pleine saisie.
      if (latest) await installUpdate(latest);
    } catch (e) {
      console.warn('Mise à jour de l’appli', e);
    }
  };
  void check();
  // Une appli restée ouverte plusieurs jours vérifie aussi au retour.
  await App.addListener('resume', () => void check());
}
