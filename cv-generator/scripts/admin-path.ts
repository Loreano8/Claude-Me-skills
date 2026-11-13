// Après la construction : l'espace administrateur n'est pas laissé à l'adresse évidente /admin/.
// - Sur le site en ligne, il est déplacé vers l'adresse secrète ADMIN_PATH (variable d'environnement de Render,
//   jamais écrite dans le code) ; /admin/ affiche alors simplement l'accueil, comme une adresse inconnue.
// - Sans ADMIN_PATH (appli Android, essais), il est retiré : l'appli n'en a pas besoin.
import { existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const from = join(dist, 'admin');
const secret = (process.env.ADMIN_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');

if (existsSync(from)) {
  if (secret && /^[a-z0-9-]{12,}$/i.test(secret)) {
    rmSync(join(dist, secret), { recursive: true, force: true });
    renameSync(from, join(dist, secret));
    console.log('Espace administrateur : adresse secrète en place.');
  } else {
    rmSync(from, { recursive: true, force: true });
    console.log('Espace administrateur : retiré de cette construction (pas d’ADMIN_PATH).');
  }
}
