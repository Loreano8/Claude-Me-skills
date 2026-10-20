import { describe, expect, it } from 'vitest';
import { achievementsList, applyAiContent, cvFileName, isCvEmpty, emptyCv, toAiContent } from '../src/lib/cv.ts';
import { checkCv } from '../src/lib/checks.ts';
import { sampleAdapt, sampleCv } from './fixtures.ts';

describe('conversion CV <-> IA', () => {
  it('envoie à l’IA le contenu sans identifiants, photo ni réglages', () => {
    const cv = { ...sampleCv(), photo: 'data:image/jpeg;base64,xxx', signature: 'data:image/png;base64,yyy' };
    const ai = toAiContent(cv);
    expect(ai.experiences[0]).not.toHaveProperty('id');
    expect(ai.experiences[0].achievements).toHaveLength(3);
    expect(JSON.stringify(ai)).not.toContain('base64');
    expect(ai).not.toHaveProperty('settings');
  });

  it('applique la réponse de l’IA en gardant photo, signature et réglages', () => {
    const cv = { ...sampleCv(), photo: 'P', signature: 'S' };
    cv.settings.template = 'elegant';
    const next = applyAiContent(cv, sampleAdapt.cv);
    expect(next.photo).toBe('P');
    expect(next.signature).toBe('S');
    expect(next.settings.template).toBe('elegant');
    expect(next.experiences[0].achievements.split('\n')[0]).toContain('déclarations fiscales');
    expect(new Set(next.experiences.map((e) => e.id)).size).toBe(next.experiences.length);
  });

  it('ne remplace pas les infos personnelles par des champs vides', () => {
    const cv = sampleCv();
    const ai = toAiContent(cv);
    ai.personal.email = '';
    ai.personal.title = 'Nouveau titre';
    const next = applyAiContent(cv, ai);
    expect(next.personal.email).toBe('awa.diallo@email.com');
    expect(next.personal.title).toBe('Nouveau titre');
  });

  it('pour un CV adapté, ne change que le titre dans les infos personnelles', () => {
    const cv = sampleCv();
    const ai = toAiContent(cv);
    ai.personal = { ...ai.personal, title: 'Responsable comptable', email: 'autre@x.com', phone: '0' };
    const next = applyAiContent(cv, ai, { keepPersonal: true });
    expect(next.personal.title).toBe('Responsable comptable');
    expect(next.personal.email).toBe(cv.personal.email);
    expect(next.personal.phone).toBe(cv.personal.phone);
  });

  it('dédoublonne les compétences', () => {
    const ai = toAiContent(sampleCv());
    ai.skills = ['Excel', 'excel ', 'Sage', ''];
    expect(applyAiContent(sampleCv(), ai).skills).toEqual(['Excel', 'Sage']);
  });
});

describe('utilitaires', () => {
  it('découpe les réalisations et retire les puces saisies à la main', () => {
    expect(achievementsList('- Un\n• Deux\n\n  * Trois  ')).toEqual(['Un', 'Deux', 'Trois']);
  });

  it('nomme les fichiers sans accents ni espaces', () => {
    const cv = sampleCv();
    cv.personal.firstName = 'Aïssatou Élodie';
    expect(cvFileName(cv, 'pdf')).toBe('CV_Aissatou_Elodie_Diallo.pdf');
    expect(cvFileName(emptyCv(), 'docx', 'Lettre')).toBe('Lettre.docx');
  });

  it('détecte un CV vide', () => {
    expect(isCvEmpty(emptyCv())).toBe(true);
    expect(isCvEmpty(sampleCv())).toBe(false);
  });

  it('donne des conseils sur un CV incomplet et valide un CV complet', () => {
    expect(checkCv(emptyCv()).some((c) => c.level === 'warn')).toBe(true);
    expect(checkCv(sampleCv())).toEqual([expect.objectContaining({ level: 'ok' })]);
  });
});
