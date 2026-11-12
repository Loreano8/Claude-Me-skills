import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { createShares } from '../server/shares.ts';
import { signToken } from '../server/auth.ts';
import { testDb } from './pglite.ts';

const PDF = Buffer.from('%PDF-1.4\n% CV de test\n').toString('base64');

async function setup() {
  const db = await testDb();
  const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 30 });
  const app = createApp({ ai: null, accounts, shares: createShares(db), sessionSecret: 's', publicUrl: 'https://cvcasa.com', allowedOrigins: [], rateLimitPerHour: 5 });
  const user = await accounts.register({ identifier: 'share@x.co', password: 'secret1234', ip: '7.7.7.7', device: 'device-share-0001' });
  const token = signToken(user.id, 's');
  const post = (path: string, body: unknown, auth = true) =>
    app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { app, post };
}

describe('partage du CV par lien', () => {
  it('publie un PDF, le sert par le lien, le met à jour et l’arrête', async () => {
    const { app, post } = await setup();
    expect((await post('/api/share', { cvKey: 'cv1', name: 'Mon CV', pdf: PDF }, false)).status).toBe(401);
    expect((await post('/api/share', { cvKey: 'cv1', name: 'Mon CV', pdf: Buffer.from('pas un pdf').toString('base64') })).status).toBe(400);

    const first = await (await post('/api/share', { cvKey: 'cv1', name: 'Mon CV', pdf: PDF })).json();
    expect(first.url).toBe(`https://cvcasa.com/v/#${first.token}`);
    const file = await app.request(`/api/cv/${first.token}`);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('application/pdf');
    expect((await (await app.request(`/api/cv/${first.token}/info`)).json()).name).toBe('Mon CV');

    // Republier le même CV garde le même lien.
    const again = await (await post('/api/share', { cvKey: 'cv1', name: 'Mon CV à jour', pdf: PDF })).json();
    expect(again.token).toBe(first.token);
    expect((await (await post('/api/share/status', { cvKey: 'cv1' })).json()).share.name).toBe('Mon CV à jour');

    await post('/api/share/stop', { cvKey: 'cv1' });
    expect((await app.request(`/api/cv/${first.token}`)).status).toBe(404);
    expect((await (await post('/api/share/status', { cvKey: 'cv1' })).json()).share).toBeNull();
  });

  it('refuse un lien inventé', async () => {
    const { app } = await setup();
    expect((await app.request('/api/cv/nimportequoi')).status).toBe(404);
    expect((await app.request('/api/cv/AAAAAAAAAAAAAAAAAAAAAAAA')).status).toBe(404);
  });
});
