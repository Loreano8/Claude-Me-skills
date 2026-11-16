import { describe, expect, it } from 'vitest';
import { resolveTheme } from '../src/lib/theme.ts';

describe('apparence', () => {
  it('« automatique » suit le téléphone, « clair » et « sombre » le forcent', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
