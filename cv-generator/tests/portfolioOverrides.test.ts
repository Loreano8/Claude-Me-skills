import { describe, expect, it } from 'vitest';
import { applyOverrides, hasOverrides } from '../src/lib/portfolio.ts';
import { SAMPLE_NURSE } from '../src/portfolio/samples.ts';

describe('retouches du portfolio', () => {
  it('remplace seulement ce qui a été retouché et masque les parties choisies', () => {
    const d = applyOverrides(SAMPLE_NURSE, { title: 'Infirmière en réanimation', stats: [{ value: '8 ans', label: 'au chevet des patients' }, { value: '', label: '' }], hidden: ['languages', 'education'] });
    expect(d.title).toBe('Infirmière en réanimation');
    expect(d.pitch).toBe(SAMPLE_NURSE.pitch);
    expect(d.stats).toEqual([{ value: '8 ans', label: 'au chevet des patients' }]);
    expect(d.languages).toEqual([]);
    expect(d.education).toEqual([]);
    expect(d.experiences.length).toBe(SAMPLE_NURSE.experiences.length);
  });

  it('un nom vide garde celui du CV', () => {
    expect(applyOverrides(SAMPLE_NURSE, { name: '  ' }).name).toBe(SAMPLE_NURSE.name);
    expect(hasOverrides({})).toBe(false);
    expect(hasOverrides({ hidden: [] })).toBe(false);
    expect(hasOverrides({ pitch: '' })).toBe(true);
  });
});
