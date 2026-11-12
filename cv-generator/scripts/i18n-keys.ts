import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Tous les textes passés à t('…') dans le site et l'application (et à tr(…, '…') dans le serveur).
export function uiKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
    });
  for (const file of [...walk(join(root, 'src')), ...walk(join(root, 'server'))]) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 't' || n.expression.text === 'tr')) {
        const arg = n.expression.text === 't' ? n.arguments[0] : n.arguments[1];
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) keys.set(arg.text, relative(root, file));
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return keys;
}


// npx tsx scripts/i18n-keys.ts : liste des textes sans traduction anglaise.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { hasTranslation } = await import('../shared/i18n.ts');
  const missing = [...uiKeys()].filter(([k]) => !hasTranslation(k));
  console.log(JSON.stringify(Object.fromEntries(missing.map(([k, f]) => [k, f])), null, 1));
  console.error(`${missing.length} texte(s) sans traduction`);
}
