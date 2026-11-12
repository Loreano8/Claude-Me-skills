import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/app', () => ({ App: {} }));
vi.mock('@capgo/capacitor-updater', () => ({ CapacitorUpdater: {} }));
const { shouldInstall } = await import('../src/lib/appUpdate.ts');

const latest = { version: 'b2', minNativeBuild: 90, manifest: [{ file_name: 'index.html', file_hash: 'x', download_url: 'https://cvcasa.com/index.html' }] };

describe('mises à jour de l’appli sans nouvelle APK', () => {
  it('installe une version différente, compatible avec l’APK', () => {
    expect(shouldInstall(latest, 'b1', 90)).toBe(true);
    expect(shouldInstall(latest, 'b1', 120)).toBe(true);
  });
  it('ne fait rien si c’est déjà la bonne version, si la fiche est vide ou si l’APK est trop ancienne', () => {
    expect(shouldInstall(latest, 'b2', 90)).toBe(false);
    expect(shouldInstall({ ...latest, manifest: [] }, 'b1', 90)).toBe(false);
    expect(shouldInstall(latest, 'b1', 89)).toBe(false);
    expect(shouldInstall(null, 'b1', 90)).toBe(false);
  });
});
