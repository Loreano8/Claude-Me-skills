// Texte retranscrit (scanner → texte tapé) : découpage commun au PDF et au Word.

/** Découpe le texte en blocs : paragraphes (séparés par une ligne vide) et lignes de liste « • ». */
export function transcriptBlocks(text: string): { kind: 'p' | 'li'; text: string }[] {
  const blocks: { kind: 'p' | 'li'; text: string }[] = [];
  for (const para of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = para.split('\n').filter((l) => l.trim());
    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length) blocks.push({ kind: 'p', text: buffer.join('\n') });
      buffer = [];
    };
    for (const line of lines) {
      const m = line.match(/^\s*[•\-*]\s+(.*)$/);
      if (m) {
        flush();
        blocks.push({ kind: 'li', text: m[1] });
      } else buffer.push(line.trim());
    }
    flush();
  }
  return blocks;
}
