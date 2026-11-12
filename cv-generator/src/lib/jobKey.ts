import type { JobPostingDraft } from '../types.ts';

/** Identifie l'offre en cours : ce qui en dépend (questions, mots-clés) est à refaire quand elle change. */
export function jobKey(job: JobPostingDraft): string {
  return `${job.text.length}:${job.text.slice(0, 200)}:${job.file?.name ?? ''}:${job.file?.data.length ?? 0}`;
}
