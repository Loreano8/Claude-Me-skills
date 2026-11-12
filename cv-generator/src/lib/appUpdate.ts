import { App } from '@capacitor/app';
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

export async function setupAppUpdates(): Promise<void> {
  // Toujours en premier : signale que cette version démarre bien (sinon retour automatique à la précédente).
  await CapacitorUpdater.notifyAppReady();
  const check = async () => {
    try {
      const res = await fetch(`${PUBLIC_SITE}/app-update/latest.json`, { cache: 'no-store' });
      if (!res.ok) return;
      const latest = (await res.json()) as LatestBundle;
      const nativeBuild = Number((await App.getInfo()).build) || 0;
      if (!shouldInstall(latest, __BUILD_ID__, nativeBuild)) return;
      // Déjà téléchargée (lancement précédent) : il suffit de la programmer.
      const { bundles } = await CapacitorUpdater.list();
      const ready = bundles.find((b) => b.version === latest.version && b.status === 'success');
      const bundle = ready ?? (await CapacitorUpdater.download({ url: '', version: latest.version, manifest: latest.manifest }));
      // Appliquée quand l'appli passe en arrière-plan ou au prochain lancement : jamais en pleine saisie.
      await CapacitorUpdater.next({ id: bundle.id });
    } catch (e) {
      console.warn('Mise à jour de l’appli', e);
    }
  };
  void check();
  // Une appli restée ouverte plusieurs jours vérifie aussi au retour.
  await App.addListener('resume', () => void check());
}
