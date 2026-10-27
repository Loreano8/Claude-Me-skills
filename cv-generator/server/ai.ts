import { Buffer } from 'node:buffer';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import {
  AdaptAiOutput,
  type AdaptResult,
  ClarifyResult,
  type ClarifyRequest,
  TranscribeResult,
  type TranscribeRequest,
  CoverLetterResult,
  StructureResult,
  TranslateResult,
  InterviewResult,
  ReviseResult,
  TemplateAnalysis,
  type AdaptRequest,
  type AnalyzeTemplateRequest,
  type ReviseRequest,
  type Attachment,
  type CoverLetterRequest,
  type JobInput,
  type StructureRequest,
  type TranslateRequest,
  type InterviewRequest,
  LetterQuestionsResult,
  type LetterQuestionsRequest,
  StyleResult,
  type StyleRequest,
} from '../shared/schema.ts';
import { adaptSystem, analyzeTemplateSystem, clarifySystem, letterQuestionsSystem, styleSystem, transcribeSystem, coverLetterSystem, interviewSystem, reviseSystem, structureSystem, translateSystem } from './prompts.ts';

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
  if (job.answers?.trim()) {
    blocks.push({ type: 'text', text: `<precisions_du_candidat>\n${job.answers.trim()}\n</precisions_du_candidat>` });
  }
  return blocks;
}

/** Style d'écriture du candidat (« Écrire comme moi »), placé avant la consigne finale. */
function styleBlocks(style: string): ContentBlock[] {
  return style.trim() ? [{ type: 'text', text: `<style_d_ecriture_du_candidat>\n${style.trim()}\n</style_d_ecriture_du_candidat>` }] : [];
}

function cvBlock(label: string, cv: unknown): ContentBlock {
  return { type: 'text', text: `<${label}>\n${JSON.stringify(cv, null, 2)}\n</${label}>` };
}

export function createAi(client: Anthropic, model = DEFAULT_MODEL) {
  const withFallback = !/haiku/.test(model);
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
        // Si le modèle décline la requête, l'API la relance sur le modèle de repli recommandé
        // (option disponible sur Opus et Sonnet, pas sur Haiku).
        ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
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
      for (const f of [...(req.file ? [req.file] : []), ...(req.files ?? [])]) content.push(attachmentBlock(f));
      if (req.current) content.push(cvBlock('cv_actuel', req.current));
      content.push(...styleBlocks(req.style));
      content.push({
        type: 'text',
        text: req.text.trim()
          ? `<informations_en_vrac>\n${req.text.trim()}\n</informations_en_vrac>\n\nOrganise ces informations en CV.`
          : 'Organise et améliore ce CV selon les normes actuelles.',
      });
      return run(StructureResult, structureSystem(req.lang), content, 'medium');
    },

    async adapt(req: AdaptRequest): Promise<AdaptResult> {
      const content = [
        cvBlock('cv_candidat', req.cv),
        ...jobBlocks(req.job),
        ...styleBlocks(req.style),
        { type: 'text', text: 'Adapte le CV à cette offre et analyse l’adéquation.' } as ContentBlock,
      ];
      const { cv: { title, ...rest }, ...out } = await run(AdaptAiOutput, adaptSystem(req.lang), content, 'medium');
      return { ...out, cv: { ...rest, personal: { ...req.cv.personal, title } } };
    },

    transcribe(req: TranscribeRequest): Promise<TranscribeResult> {
      const content: ContentBlock[] = [
        ...req.files.map(attachmentBlock),
        { type: 'text', text: `Retranscris ce document (${req.files.length} page${req.files.length > 1 ? 's' : ''}).` },
      ];
      return run(TranscribeResult, transcribeSystem(), content, 'medium');
    },

    clarify(req: ClarifyRequest): Promise<ClarifyResult> {
      const content = [
        cvBlock('cv_candidat', req.cv),
        ...jobBlocks(req.job),
        { type: 'text', text: 'Quelles questions poser au candidat avant d’adapter son CV à cette offre ?' } as ContentBlock,
      ];
      return run(ClarifyResult, clarifySystem(), content, 'low');
    },

    coverLetter(req: CoverLetterRequest): Promise<CoverLetterResult> {
      const content: ContentBlock[] = [cvBlock('cv_candidat', req.cv), ...jobBlocks(req.job)];
      if (req.notes.trim()) {
        content.push({ type: 'text', text: `<notes_du_candidat>\n${req.notes.trim()}\n</notes_du_candidat>` });
      }
      content.push(...styleBlocks(req.style));
      content.push({
        type: 'text',
        text:
          req.job.text.trim() || req.job.file
            ? 'Rédige la lettre de motivation pour cette offre.'
            : 'Il n’y a pas d’offre : rédige une lettre de candidature spontanée à partir du CV et des notes.',
      });
      return run(CoverLetterResult, coverLetterSystem(req), content, 'medium');
    },

    interview(req: InterviewRequest): Promise<InterviewResult> {
      const content: ContentBlock[] = [
        cvBlock('cv_candidat', req.cv),
        ...jobBlocks(req.job),
        ...styleBlocks(req.style),
        { type: 'text', text: 'Prépare la fiche d’entretien pour cette offre.' },
      ];
      return run(InterviewResult, interviewSystem(req.lang), content, 'medium');
    },

    revise(req: ReviseRequest): Promise<ReviseResult> {
      const content: ContentBlock[] = [
        cvBlock('cv_actuel', req.cv),
        ...styleBlocks(req.style),
        { type: 'text', text: `<demandes_du_candidat>\n${req.instructions.trim()}\n</demandes_du_candidat>\n\nApplique ces corrections au CV.` },
      ];
      return run(ReviseResult, reviseSystem(req.lang), content, 'medium');
    },

    analyzeTemplate(req: AnalyzeTemplateRequest): Promise<TemplateAnalysis> {
      const content: ContentBlock[] = [attachmentBlock(req.file), { type: 'text', text: 'Analyse ce modèle de CV.' }];
      return run(TemplateAnalysis, analyzeTemplateSystem(), content, 'medium');
    },

    style(req: StyleRequest): Promise<StyleResult> {
      const content: ContentBlock[] = [...req.files.map(attachmentBlock)];
      if (req.text.trim()) content.push({ type: 'text', text: `<texte_ecrit_par_la_personne>\n${req.text.trim()}\n</texte_ecrit_par_la_personne>` });
      content.push({ type: 'text', text: 'Décris la façon d’écrire de cette personne.' });
      return run(StyleResult, styleSystem(), content, 'low');
    },

    letterQuestions(req: LetterQuestionsRequest): Promise<LetterQuestionsResult> {
      const content: ContentBlock[] = [cvBlock('cv_candidat', req.cv), ...jobBlocks(req.job)];
      if (req.notes.trim()) content.push({ type: 'text', text: `<notes_du_candidat>\n${req.notes.trim()}\n</notes_du_candidat>` });
      content.push({ type: 'text', text: 'Quelles questions poser au candidat avant d’écrire sa lettre ?' });
      return run(LetterQuestionsResult, letterQuestionsSystem(), content, 'low');
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
