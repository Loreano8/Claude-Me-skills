import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { createPayments, type PaymentProvider } from '../server/payments.ts';
import { createSources, normalizeSource } from '../server/sources.ts';
import { sourceFromUrl } from '../src/lib/source.ts';
import { testDb } from './pglite.ts';

const opts = { freeCredits: 1, freeIpCooldownDays: 30 };

describe('provenance des visiteurs (liens de pub)', () => {
  it('nettoie le nom de la pub', () => {
    expect(normalizeSource('Facebook Vidéo 1')).toBe('facebook-video-1');
    expect(normalizeSource('')).toBe('direct');
    expect(normalizeSource('<script>')).toBe('script');
  });

  it('lit ?src= ou les paramètres utm', () => {
    expect(sourceFromUrl('https://cvcasa.com/?src=tiktok1#offre')).toBe('tiktok1');
    expect(sourceFromUrl('https://cvcasa.com/?utm_source=facebook&utm_campaign=octobre')).toBe('facebook-octobre');
    expect(sourceFromUrl('https://cvcasa.com/')).toBeNull();
  });

  it('compte visites, inscriptions, acheteurs et chiffre d’affaires par pub', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, opts);
    const provider: PaymentProvider = { name: 'fake', createCheckout: async () => ({ ref: 'tx-1', url: 'x' }), fetchStatus: async () => 'approved' };
    const payments = createPayments(db, accounts, provider);
    const sources = createSources(db);
    const app = createApp({ ai: null, accounts, sources, sessionSecret: 's', allowedOrigins: [], rateLimitPerHour: 5, adminToken: 'adm' });
    const visit = (source: string) => app.request('/api/visit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source }) });

    await visit('Facebook Vidéo 1');
    await visit('facebook-video-1');
    await visit('');
    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-device-id': 'device-source-1' },
      body: JSON.stringify({ identifier: 's@b.co', password: 'secret12', source: 'Facebook Vidéo 1' }),
    });
    expect(reg.status).toBe(200);
    const user = (await accounts.findByIdentifier('s@b.co'))!;
    await payments.checkout(user, 'essentiel', 'x');
    await payments.confirm('tx-1');

    expect((await app.request('/api/admin/sources')).status).toBe(403);
    const res = await app.request('/api/admin/sources?days=7', { headers: { authorization: 'Bearer adm' } });
    const { sources: rows } = (await res.json()) as { sources: { source: string; visits: number; signups: number; buyers: number; revenue: number }[] };
    expect(rows[0]).toEqual({ source: 'facebook-video-1', visits: 2, signups: 1, buyers: 1, revenue: 500 });
    expect(rows.find((r) => r.source === 'direct')).toMatchObject({ visits: 1, signups: 0 });
  });
});
