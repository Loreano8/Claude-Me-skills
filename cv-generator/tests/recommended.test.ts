import { describe, expect, it } from 'vitest';
import { isRecommended, recommendedDisplay } from '../src/lib/recommended.ts';
import { sampleCv } from './fixtures.ts';

describe('réglages d’affichage recommandés', () => {
  it('CV en français : photo si elle existe, sans date de naissance, nationalité ni signature', () => {
    const cv = sampleCv();
    cv.photo = 'data:image/png;base64,AAAA';
    cv.settings = { ...cv.settings, headingLang: 'fr', template: 'moderne', showPhoto: false, showBirthDate: true, showNationality: true, showSignature: true };
    expect(recommendedDisplay(cv).settings).toEqual({ showPhoto: true, showBirthDate: false, showNationality: false, showSignature: false });
    expect(isRecommended(cv)).toBe(false);
    cv.settings = { ...cv.settings, ...recommendedDisplay(cv).settings };
    expect(isRecommended(cv)).toBe(true);
  });

  it('CV en anglais ou modèle Canada : rien de personnel', () => {
    const cv = sampleCv();
    cv.photo = 'data:image/png;base64,AAAA';
    cv.settings = { ...cv.settings, headingLang: 'en' };
    expect(recommendedDisplay(cv).settings.showPhoto).toBe(false);
    cv.settings = { ...cv.settings, headingLang: 'fr', template: 'canada' };
    expect(recommendedDisplay(cv).settings.showPhoto).toBe(false);
  });

  it('modèle Concours : date de naissance et nationalité', () => {
    const cv = sampleCv();
    cv.settings = { ...cv.settings, headingLang: 'fr', template: 'concours' };
    expect(recommendedDisplay(cv).settings).toMatchObject({ showBirthDate: true, showNationality: true });
  });
});
