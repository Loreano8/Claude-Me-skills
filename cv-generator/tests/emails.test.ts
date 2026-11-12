import { describe, expect, it } from 'vitest';
import { applicationEmail, findEmail, followUpEmail, mailto, needsFollowUp } from '../src/lib/emails.ts';
import { sampleCv } from './fixtures.ts';

describe('e-mails de candidature et de relance', () => {
  it('prépare le message qui accompagne le CV et la lettre', () => {
    const cv = sampleCv();
    const d = applicationEmail(cv, { position: 'Comptable', company: 'Groupe Ouest', withLetter: true, to: 'rh@groupe.bj' });
    expect(d.subject).toContain('Candidature au poste de Comptable');
    expect(d.body).toContain('au poste de Comptable chez Groupe Ouest');
    expect(d.body).toContain('mon CV et ma lettre de motivation');
    expect(d.body).toContain(cv.personal.phone);
    expect(d.body).not.toMatch(/—/);
    expect(applicationEmail(cv, { position: '', company: '', withLetter: false }).body).toContain('Vous trouverez en pièce jointe mon CV.');
  });

  it('prépare la relance et sait quand la proposer', () => {
    const sentAt = new Date('2026-11-02T10:00:00').getTime();
    const d = followUpEmail(sampleCv(), { position: 'Comptable', company: 'Groupe Ouest', sentAt });
    expect(d.subject).toBe('Relance : candidature au poste de Comptable');
    expect(d.body).toContain('Le 2 novembre');
    const now = sentAt + 8 * 86_400_000;
    expect(needsFollowUp({ status: 'envoyee', sentAt }, now)).toBe(true);
    expect(needsFollowUp({ status: 'envoyee', sentAt }, sentAt + 3 * 86_400_000)).toBe(false);
    expect(needsFollowUp({ status: 'entretien', sentAt }, now)).toBe(false);
    expect(needsFollowUp({ status: 'envoyee', sentAt, followedUpAt: now }, now)).toBe(false);
  });

  it('trouve l’adresse du recruteur dans l’offre et prépare le lien de messagerie', () => {
    expect(findEmail('Dossier : CV + lettre à recrutement@glo.bj avant le 30.')).toBe('recrutement@glo.bj');
    expect(findEmail('Pas d’adresse')).toBe('');
    expect(mailto({ to: 'a@b.co', subject: 'Objet', body: 'Ligne 1\nLigne 2' })).toBe('mailto:a%40b.co?subject=Objet&body=Ligne%201%0ALigne%202');
  });
});

describe('notification de relance', () => {
  it('tombe une semaine après l’envoi, à 10 h', async () => {
    const { followUpDate } = await import('../src/lib/followUpNotify.ts');
    const d = followUpDate(new Date('2026-11-02T16:30:00').getTime());
    expect([d.getDate(), d.getMonth(), d.getHours(), d.getMinutes()]).toEqual([9, 10, 10, 0]);
  });
});
