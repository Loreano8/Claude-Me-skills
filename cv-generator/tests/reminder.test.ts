import { describe, expect, it } from 'vitest';
import { reminderDates, shouldShowBanner } from '../src/lib/reminder.ts';

const H = 3_600_000;

describe('rappel « Une nouvelle offre ? »', () => {
  const now = Date.UTC(2026, 9, 27, 12);
  it('ne s’affiche qu’au retour, avec un vrai CV, hors période de pause', () => {
    expect(shouldShowBanner(now, now - 21 * H, 0, true)).toBe(true);
    expect(shouldShowBanner(now, now - 2 * H, 0, true)).toBe(false);
    expect(shouldShowBanner(now, 0, 0, true)).toBe(false);
    expect(shouldShowBanner(now, now - 48 * H, 0, false)).toBe(false);
    expect(shouldShowBanner(now, now - 48 * H, now + H, true)).toBe(false);
  });
  it('programme les notifications 4 puis 11 jours plus tard, à 10 h', () => {
    const [a, b] = reminderDates(now);
    expect(a.getHours()).toBe(10);
    expect(Math.round((a.getTime() - now) / (24 * H))).toBe(4);
    expect(Math.round((b.getTime() - now) / (24 * H))).toBe(11);
  });
});
