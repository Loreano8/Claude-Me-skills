import { useCallback, useState, type SetStateAction } from 'react';

// Texte en cours de saisie gardé sur l'appareil à chaque frappe : si le téléphone ferme l'appli pendant qu'on est
// parti chercher une information (touche Accueil, appel, autre appli), on retrouve tout en revenant.

const PREFIX = 'cvcasa-saisie:';

function read<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    return initial;
  }
}

export function useSavedState<T>(key: string, initial: T): [T, (v: SetStateAction<T>) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial));
  const set = useCallback(
    (v: SetStateAction<T>) => {
      setValue((cur) => {
        const next = typeof v === 'function' ? (v as (c: T) => T)(cur) : v;
        try {
          if (next === initial || next === null || (typeof next === 'string' && next === '')) localStorage.removeItem(PREFIX + key);
          else localStorage.setItem(PREFIX + key, JSON.stringify(next));
        } catch {
          /* stockage plein ou indisponible : le texte reste au moins à l'écran */
        }
        return next;
      });
    },
    [key, initial],
  );
  return [value, set];
}
