import { Buffer } from 'node:buffer';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import {
  AdaptResult,
  CoverLetterResult,
  StructureResult,
  TranslateResult,
  type AdaptRequest,
  type Attachment,
  type CoverLetterRequest,
  type JobInput,
  type StructureRequest,
  type TranslateRequest,
} from '../shared/schema.ts';
import { adaptSystem, coverLetterSystem, structureSystem, translateSystem } from './prompts.ts';

type ContentBlock = Anthropic.Beta.BetaContentBlockParam;
type Effort = 'low' | 'medium' | 'high';

export const DEFAULT_MODEL = 'claude-opus-5-5';

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function attachmentBlock(file: Attachment): ContentBlock {
  switch (file.mediaType) {
    case 'application/pdf':
      return {
        type: 'document',
        title: file.name,
        source: { type: 'base64', media_type: 'application/pdf', data: file.data },
      };
    case 'text/plain':
      return {
        type: 'document',
        title: file.name,
        source: { type: 'text', media_type: 'text/plain', data: Buffer.from(file.data, 'base64').toString('utf8') },
      };
    default:
      return { type: 'image', source: { type: 'base64', media_type: file.mediaType, data: file.data } };
  }
}

function jobBlocks(job: JobInput): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  if (job.file) blocks.push(attachmentBlock(job.file));
  if (job.text.trim()) blocks.push({ type: 'text', text: `<offre_emploi>\n${job.text.trim()}\n</offre_emploi>` });
  return blocks;
}

function cvBlock(label: string, cv: unknown): ContentBlock {
  return { type: 'text', text: `<${label}>\n${JSON.stringify(cv, null, 2)}\n</${label}>` };
}

export function createAi(client: Anthropic, model = DEFAULT_MODEL) {
  async function run<S extends z.ZodType>(
    schema: S,
    system: string,
    content: ContentBlock[],
    effort: Effort,
  ): Promise<z.infer<S>> {
    let response;
    try {
      response = await client.beta.messages.parse({
        model,
        max_tokens: 16000,
        // Si le modèle décline la requête, l'API la relance sur le modèle de repli recommandé.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort, format: betaZodOutputFormat(schema) },
        system,
        messages: [{ role: 'user', content }],
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        throw new AiError('Clé API Anthropic invalide ou absente sur le serveur.', 503, 'auth');
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new AiError('Le service IA est très sollicité. Réessayez dans un instant.', 429, 'rate_limited');
      }
      if (error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message)) {
        console.error('Compte Anthropic sans crédit : rechargez sur console.anthropic.com');
        throw new AiError('Le service IA est momentanément indisponible. Réessayez plus tard.', 503, 'billing');
      }
      if (error instanceof Anthropic.BadRequestError) {
        throw new AiError('Le document envoyé n’a pas pu être lu (fichier trop lourd ou illisible ?).', 400, 'bad_request');
      }
      if (error instanceof Anthropic.APIError) {
        throw new AiError('Le service IA est momentanément indisponible.', 502, 'upstream');
      }
      throw error;
    }

    if (response.stop_reason === 'refusal') {
      throw new AiError('L’IA n’a pas pu traiter cette demande.', 422, 'refusal');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new AiError('Le contenu est trop long pour être traité en une fois.', 422, 'too_long');
    }
    if (!response.parsed_output) {
      throw new AiError('Réponse de l’IA inattendue. Réessayez.', 502, 'parse');
    }
    return response.parsed_output as z.infer<S>;
  }

  return {
    structure(req: StructureRequest): Promise<StructureResult> {
      const content: ContentBlock[] = [];
      if (req.file) content.push(attachmentBlock(req.file));
      if (req.current) content.push(cvBlock('cv_actuel', req.current));
      content.push({
        type: 'text',
        text: req.text.trim()
          ? `<informations_en_vrac>\n${req.text.trim()}\n</informations_en_vrac>\n\nOrganise ces informations en CV.`
          : 'Organise et améliore ce CV selon les normes actuelles.',
      });
      return run(StructureResult, structureSystem(req.lang), content, 'medium');
    },

    adapt(req: AdaptRequest): Promise<AdaptResult> {
      const content = [
        cvBlock('cv_candidat', req.cv),
        ...jobBlocks(req.job),
        { type: 'text', text: 'Adapte le CV à cette offre et analyse l’adéquation.' } as ContentBlock,
      ];
      return run(AdaptResult, adaptSystem(req.lang), content, 'medium');
    },

    coverLetter(req: CoverLetterRequest): Promise<CoverLetterResult> {
      const content: ContentBlock[] = [cvBlock('cv_candidat', req.cv), ...jobBlocks(req.job)];
      if (req.notes.trim()) {
        content.push({ type: 'text', text: `<notes_du_candidat>\n${req.notes.trim()}\n</notes_du_candidat>` });
      }
      content.push({
        type: 'text',
        text:
          req.job.text.trim() || req.job.file
            ? 'Rédige la lettre de motivation pour cette offre.'
            : 'Il n’y a pas d’offre : rédige une lettre de candidature spontanée à partir du CV et des notes.',
      });
      return run(CoverLetterResult, coverLetterSystem(req), content, 'medium');
    },

    translate(req: TranslateRequest): Promise<TranslateResult> {
      const content: ContentBlock[] = [
        cvBlock('cv', req.cv),
        { type: 'text', text: 'Produis la version de ce CV dans la langue et pour le pays demandés.' },
      ];
      return run(TranslateResult, translateSystem(req.targetLang, req.market), content, 'medium');
    },
  };
}

export type Ai = ReturnType<typeof createAi>;
