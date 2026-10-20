/** Découpe le corps de la lettre en paragraphes (séparés par une ligne vide). */
export function letterParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}
