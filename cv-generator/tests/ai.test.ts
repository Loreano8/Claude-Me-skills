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
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: sampleAdapt });
    const ai = createAi(client);
    const res = await ai.adapt({
      cv: toAiContent(sampleCv()),
      job: { text: 'Poste à Dakar', file: { name: 'offre.pdf', mediaType: 'application/pdf', data: 'JVBERi0=' } },
      lang: null,
    });
    expect(res.analysis.matchScore).toBe(72);
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
    await expect(createAi(client).structure({ text: 'x', file: null, current: null, lang: 'fr' })).rejects.toMatchObject({ status: 422, code: 'refusal' });
  });

  it('écrit une candidature spontanée quand il n’y a pas d’offre', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: { paragraphs: [] } });
    await createAi(client).coverLetter({ cv: toAiContent(sampleCv()), job: { text: '', file: null }, notes: 'Entreprise X', tone: 'formel', length: 'courte', lang: 'fr' });
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
