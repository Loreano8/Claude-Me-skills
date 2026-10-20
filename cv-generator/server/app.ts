import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import type { z } from 'zod';
import { AdaptRequest, CoverLetterRequest, StructureRequest, TranslateRequest } from '../shared/schema.ts';
import { AiError, type Ai } from './ai.ts';

export interface AppOptions {
  ai: Ai | null;
  allowedOrigins: string[];
  rateLimitPerHour: number;
}

// Limite simple en mémoire : suffisante pour une seule instance du serveur.
function createRateLimiter(limit: number) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}

function clientKey(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'local';
}

export function createApp({ ai, allowedOrigins, rateLimitPerHour }: AppOptions) {
  const app = new Hono();
  const allow = createRateLimiter(rateLimitPerHour);

  app.use('/api/*', cors({ origin: allowedOrigins, allowMethods: ['GET', 'POST'] }));
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 15 * 1024 * 1024,
      onError: (c) => c.json({ error: 'Fichier trop volumineux (15 Mo maximum).' }, 413),
    }),
  );

  app.get('/api/health', (c) => c.json({ ok: true, ai: ai !== null }));

  function aiRoute<S extends z.ZodType, R>(schema: S, handler: (ai: Ai, body: z.output<S>) => Promise<R>) {
    return async (c: Context) => {
      if (!ai) {
        return c.json({ error: 'Les fonctions IA ne sont pas configurées sur ce serveur (ANTHROPIC_API_KEY manquante).' }, 503);
      }
      if (!allow(clientKey(c))) {
        return c.json({ error: 'Trop de demandes en peu de temps. Réessayez dans une heure.' }, 429);
      }
      const parsed = schema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) {
        return c.json({ error: 'Requête invalide.', details: parsed.error.issues.slice(0, 5) }, 400);
      }
      try {
        return c.json(await handler(ai, parsed.data));
      } catch (error) {
        if (error instanceof AiError) {
          return c.json({ error: error.message, code: error.code }, error.status as 400);
        }
        console.error(error);
        return c.json({ error: 'Erreur interne du serveur.' }, 500);
      }
    };
  }

  app.post(
    '/api/ai/structure',
    aiRoute(StructureRequest, (ai, body) => {
      if (!body.text.trim() && !body.file && !body.current) {
        throw new AiError('Écrivez quelques informations ou joignez un ancien CV.', 400, 'empty');
      }
      return ai.structure(body);
    }),
  );

  app.post(
    '/api/ai/adapt',
    aiRoute(AdaptRequest, (ai, body) => {
      if (!body.job.text.trim() && !body.job.file) {
        throw new AiError('Collez le texte de l’offre ou joignez le fichier de l’annonce.', 400, 'empty');
      }
      return ai.adapt(body);
    }),
  );

  app.post(
    '/api/ai/cover-letter',
    aiRoute(CoverLetterRequest, (ai, body) => ai.coverLetter(body)),
  );

  app.post(
    '/api/ai/translate',
    aiRoute(TranslateRequest, (ai, body) => ai.translate(body)),
  );

  return app;
}
