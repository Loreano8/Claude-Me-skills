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
    const next = applyAiContent(cv, ai, { mode: 'keepPersonal' });
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

describe('version traduite', () => {
  it('traduit tout sauf les moyens de contact', () => {
    const cv = sampleCv();
    const ai = toAiContent(cv);
    ai.personal = { ...ai.personal, title: 'Senior Accountant', country: 'Senegal', email: 'changed@x.com', phone: '' };
    const next = applyAiContent(cv, ai, { mode: 'keepContact' });
    expect(next.personal.title).toBe('Senior Accountant');
    expect(next.personal.country).toBe('Senegal');
    expect(next.personal.email).toBe(cv.personal.email);
    expect(next.personal.phone).toBe(cv.personal.phone);
  });
});

describe('conseils de rédaction des réalisations', () => {
  const withLines = (achievements: string) => {
    const cv = sampleCv();
    cv.experiences = [{ ...cv.experiences[0], achievements }];
    return checkCv(cv).map((c) => c.text).join('\n');
  };
  it('repère les formules qui décrivent une fonction', () => {
    expect(withLines('Responsable de la paie de 120 salariés')).toMatch(/verbe d’action plutôt que « Responsable de »/);
    expect(withLines('Chargée des relations clients')).toMatch(/plutôt que « Chargée des »/);
    expect(withLines('Géré la paie de 120 salariés')).not.toMatch(/verbe d’action plutôt/);
  });
  it('repère les pronoms, les lignes trop longues et les listes trop longues', () => {
    expect(withLines('J’ai géré la paie de 120 salariés')).toMatch(/Retirez « je »/);
    expect(withLines('Géré la paie de 120 salariés')).not.toMatch(/Retirez « je »/);
    expect(withLines('Géré ' + 'la paie et les déclarations sociales '.repeat(6))).toMatch(/dépasse deux lignes/);
    expect(withLines(Array.from({ length: 7 }, (_, i) => `Réalisé la tâche ${i + 1}`).join('\n'))).toMatch(/7 lignes pour/);
  });
  it('signale « Références disponibles sur demande »', () => {
    const cv = sampleCv();
    cv.interests = [...cv.interests, 'Références disponibles sur demande'];
    expect(checkCv(cv).some((c) => /Références disponibles/.test(c.text))).toBe(true);
  });
});

describe('ordre formation / expériences', () => {
  it('met la formation d’abord seulement pour un jeune diplômé', async () => {
    const { educationFirst } = await import('../src/lib/cv.ts');
    const cv = sampleCv();
    expect(educationFirst(cv)).toBe(false);
    expect(educationFirst({ ...cv, experiences: [] })).toBe(true);
    expect(educationFirst({ ...cv, experiences: [{ ...cv.experiences[0], position: 'Stagiaire comptable' }] })).toBe(true);
    expect(educationFirst({ ...cv, education: [], experiences: [] })).toBe(false);
  });
});

describe('revue des modifications de l’adaptation', () => {
  it('liste les parties modifiées et permet de revenir à l’original partie par partie', async () => {
    const { listChanges, choose } = await import('../src/lib/review.ts');
    const base = sampleCv();
    const adapted = structuredClone(base);
    adapted.id = 'adapte';
    adapted.personal.title = 'Responsable comptable';
    adapted.experiences = adapted.experiences.map((e, i) => ({ ...e, id: `n${i}`, achievements: i === 0 ? 'Tenir la comptabilité SYSCOHADA\n' + e.achievements : e.achievements }));
    adapted.skills = [...base.skills, 'SYSCOHADA'];

    const changes = listChanges(base, adapted);
    expect(changes.map((c) => c.key)).toEqual(['title', 'exp:n0', 'skills']);

    let cv = choose(adapted, base, adapted, 'title', false);
    expect(cv.personal.title).toBe(base.personal.title);
    cv = choose(cv, base, adapted, 'exp:n0', false);
    expect(cv.experiences[0].achievements).toBe(base.experiences[0].achievements);
    expect(cv.skills).toEqual(adapted.skills);
    cv = choose(cv, base, adapted, 'exp:n0', true);
    expect(cv.experiences[0].achievements).toBe(adapted.experiences[0].achievements);
  });
});
