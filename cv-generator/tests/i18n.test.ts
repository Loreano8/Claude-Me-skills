import { describe, expect, it } from 'vitest';
import { hasTranslation, translate } from '../shared/i18n.ts';
import { EN } from '../shared/i18n/en.ts';
import { uiKeys } from '../scripts/i18n-keys.ts';

describe('version anglaise', () => {
  it('chaque texte de l’interface a sa traduction anglaise', () => {
    const missing = [...uiKeys()].filter(([k]) => !hasTranslation(k)).map(([k, f]) => `${f} : ${k}`);
    expect(missing).toEqual([]);
  });

  it('les {0}, {1}… et {n} sont les mêmes dans les deux langues', () => {
    const marks = (s: string) => [...new Set(s.match(/\{(\d+|n)\}/g) ?? [])].sort().join(',');
    // Une traduction peut omettre une marque de pluriel français (ex. « inscrit{2} »), jamais en ajouter.
    const wrong = Object.entries(EN).filter(([fr, en]) => !marks(en).split(',').filter(Boolean).every((m) => marks(fr).includes(m)));
    expect(wrong).toEqual([]);
  });

  it('remplit les valeurs et reconnaît les nombres', () => {
    expect(translate('fr', 'Envoyée il y a {0} jour{1}.', [3, 's'])).toBe('Envoyée il y a 3 jours.');
    expect(translate('en', 'Texte inconnu')).toBe('Texte inconnu');
  });
});
