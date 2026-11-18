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

describe('domaine détecté pour les motifs du portfolio', () => {
  it('reconnaît la comptabilité, la santé et le développement', async () => {
    const { detectField } = await import('../src/lib/portfolio.ts');
    const { sampleCv } = await import('./fixtures.ts');
    const cv = sampleCv();
    expect(detectField(cv)).toBe('finance');
    expect(detectField({ ...cv, personal: { ...cv.personal, title: 'Infirmière diplômée d’État' }, skills: ['Soins intensifs'], experiences: [] })).toBe('sante');
    expect(detectField({ ...cv, personal: { ...cv.personal, title: 'Développeur web full stack' }, skills: ['React', 'Node.js'], experiences: [] })).toBe('tech');
    expect(detectField({ ...cv, personal: { ...cv.personal, title: '' }, skills: [], experiences: [], education: [] })).toBe('general');
  });
});
