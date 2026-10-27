import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { createAi } from '../server/ai.ts';
import { toAiContent } from '../src/lib/cv.ts';
import { sampleAdapt, sampleCv } from './fixtures.ts';

// Faux client : on vérifie la requête envoyée à Claude, sans appel réseau.
function fakeClient(response: Record<string, unknown>) {
  const parse = vi.fn(async () => response);
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

describe('appels à Claude', () => {
  it('envoie l’offre en PDF comme document et demande une sortie structurée', async () => {
    // L'IA ne renvoie que l'intitulé du poste : les informations personnelles sont reprises du CV d'origine.
    const { personal: _p, ...adaptedCv } = sampleAdapt.cv;
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: { ...sampleAdapt, cv: { ...adaptedCv, title: 'Responsable comptable' } } });
    const ai = createAi(client);
    const original = toAiContent(sampleCv());
    const res = await ai.adapt({
      cv: original,
      job: { text: 'Poste à Dakar', file: { name: 'offre.pdf', mediaType: 'application/pdf', data: 'JVBERi0=' }, answers: '' },
      lang: null,
    });
    expect(res.analysis.matchScore).toBe(72);
    expect(res.cv.personal).toEqual({ ...original.personal, title: 'Responsable comptable' });
    expect(res.cv.experiences).toEqual(sampleAdapt.cv.experiences);
    const req = (parse.mock.calls[0] as unknown[])[0] as Record<string, any>;
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.fallbacks).toBe('default');
    expect(req.betas).toContain('server-side-fallback-2026-07-01');
    expect(req.output_config.format.type).toBe('json_schema');
    const content = req.messages[0].content;
    expect(content.some((b: any) => b.type === 'document' && b.source.media_type === 'application/pdf')).toBe(true);
    expect(content.some((b: any) => b.type === 'text' && b.text.includes('<offre_emploi>'))).toBe(true);
    expect(req.system).toContain('N’invente jamais');
  });

  it('signale un refus du modèle', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', parsed_output: null });
    await expect(createAi(client).structure({ text: 'x', file: null, files: [], current: null, lang: 'fr' })).rejects.toMatchObject({ status: 422, code: 'refusal' });
  });

  it('lit plusieurs photos d’un coup et choisit la langue des informations pour un nouveau CV', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: { cv: {}, suggestions: [], language: 'en' } });
    const photo = { name: 'page.jpg', mediaType: 'image/jpeg' as const, data: 'AAAA' };
    await createAi(client).structure({ text: '', file: null, files: [photo, { ...photo, name: 'page2.jpg' }], current: null, lang: null });
    const req = (parse.mock.calls[0] as unknown[])[0] as Record<string, any>;
    expect(req.messages[0].content.filter((b: any) => b.type === 'image')).toHaveLength(2);
    expect(req.system).toContain('langue principale des informations fournies');
  });

  it('écrit une candidature spontanée quand il n’y a pas d’offre', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: { paragraphs: [] } });
    await createAi(client).coverLetter({ cv: toAiContent(sampleCv()), job: { text: '', file: null, answers: '' }, notes: 'Entreprise X', tone: 'formel', length: 'courte', lang: 'fr' });
    const req = (parse.mock.calls[0] as unknown[])[0] as Record<string, any>;
    const text = req.messages[0].content.map((b: any) => b.text ?? '').join('\n');
    expect(text).toContain('candidature spontanée');
    expect(text).toContain('<notes_du_candidat>');
    expect(req.system).toContain('180 à 250');
  });

  it('traduit le CV en anglais avec les usages du marché visé', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: { cv: {}, notes: [] } });
    await createAi(client).translate({ cv: toAiContent(sampleCv()), targetLang: 'en', market: 'us' });
    const req = (parse.mock.calls[0] as unknown[])[0] as Record<string, any>;
    expect(req.system).toContain('États-Unis');
    expect(req.system).toContain('en anglais');
    expect(req.system).toContain('Ne traduis pas les noms propres');
  });
});
