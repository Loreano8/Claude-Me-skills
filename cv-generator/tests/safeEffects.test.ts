import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { safeEffect } from '../src/lib/safeEffects.ts';

describe('effets React protégés', () => {
  it('garde un nettoyage valide et ignore le reste au lieu de faire planter l’écran', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const clean = () => {};
    expect(safeEffect(() => clean)()).toBe(clean);
    expect(safeEffect(() => undefined)()).toBeUndefined();
    expect(safeEffect((() => Promise.resolve()) as never)()).toBeUndefined();
    expect(safeEffect((() => 42) as never)()).toBeUndefined();
    expect(safeEffect((() => null) as never)()).toBeUndefined();
    expect(err).toHaveBeenCalledTimes(3);
    err.mockRestore();
  });

  it('tout le code de l’appli passe par la version protégée', () => {
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : /\.tsx?$/.test(n) && files.push(join(d, n))));
    walk('src');
    const direct = files.filter((f) => !f.endsWith('safeEffects.ts') && /import \{[^}]*\buse(Layout)?Effect\b[^}]*\} from 'react'/.test(readFileSync(f, 'utf8')));
    expect(direct).toEqual([]);
  });
});
