import { describe, expect, it } from 'vitest';
import { languageLevel } from '../src/pdf/templates/Premium.tsx';

describe('niveau de langue en points', () => {
  it('lit les niveaux courants, en français et en anglais', () => {
    expect(languageLevel('Langue maternelle')).toBe(5);
    expect(languageLevel('Courant (C1)')).toBe(4);
    expect(languageLevel('Professionnel (B2)')).toBe(3.5);
    expect(languageLevel('Intermediate (B1)')).toBe(3);
    expect(languageLevel('Bonnes notions')).toBe(2);
    expect(languageLevel('Débutant')).toBe(1);
  });
  it('n’invente pas de niveau quand le texte ne le dit pas', () => {
    expect(languageLevel('')).toBe(0);
    expect(languageLevel('Lu, écrit, parlé')).toBe(0);
  });
});
