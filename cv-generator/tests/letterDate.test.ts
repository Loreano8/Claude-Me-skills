import { describe, expect, it, vi } from 'vitest';

describe('date d’une lettre générée', () => {
  it('prend la date du jour, pas celle de la première ouverture de l’appli', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
    const { useStore } = await import('../src/store.ts');
    expect(useStore.getState().letter.date).toContain('27 octobre 2026');
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    const cv = useStore.getState().cvs[0];
    useStore.getState().applyLetter({ language: 'fr', recipientName: '', recipientCompany: 'X', recipientAddress: '', subject: 'S', salutation: 'Madame, Monsieur,', paragraphs: ['a'], closing: 'c' } as never, cv);
    expect(useStore.getState().letter.date).toContain('16 novembre 2026');
    vi.useRealTimers();
  });
});
