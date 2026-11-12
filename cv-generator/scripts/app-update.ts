// Après la construction du site : fiche de mise à jour de l'application (dist/app-update/latest.json).
// L'appli Android la lit au démarrage et ne télécharge que les fichiers dont l'empreinte a changé (voir src/lib/appUpdate.ts).
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BUILD_ID } from '../vite.config.ts';

/**
 * Plus petit numéro d'APK (versionCode = numéro de compilation GitHub) qui sait faire tourner ce code.
 * À relever quand on ajoute ou change un outil natif (plugin Capacitor) : les APK plus anciennes ignorent alors la
 * mise à jour, et il faut leur envoyer une nouvelle APK.
 */
export const MIN_NATIVE_BUILD = 1;

const dist = join(import.meta.dirname, '..', 'dist');
const site = (process.env.VITE_PUBLIC_SITE ?? 'https://cvcasa.com').replace(/\/$/, '');

const files: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (relative(dist, p) !== 'app-update') walk(p);
    } else files.push(relative(dist, p).split('\\').join('/'));
  }
};
walk(dist);

const manifest = files.sort().map((file_name) => {
  const file_hash = createHash('sha256').update(readFileSync(join(dist, file_name))).digest('hex');
  // ?v= : une adresse par contenu, jamais servie depuis un cache périmé.
  return { file_name, file_hash, download_url: `${site}/${file_name.split('/').map(encodeURIComponent).join('/')}?v=${file_hash.slice(0, 12)}` };
});

mkdirSync(join(dist, 'app-update'), { recursive: true });
writeFileSync(join(dist, 'app-update', 'latest.json'), JSON.stringify({ version: BUILD_ID, minNativeBuild: MIN_NATIVE_BUILD, manifest }));
console.log(`Mise à jour de l’appli : version ${BUILD_ID}, ${manifest.length} fichiers.`);
