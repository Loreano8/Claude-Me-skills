import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { createSync } from '../server/sync.ts';
import { signToken } from '../server/auth.ts';
import { testDb } from './pglite.ts';
import { mergeSnapshots } from '../src/lib/sync.ts';
import { emptyCv } from '../src/lib/cv.ts';
import { sampleCv } from './fixtures.ts';

const snap = (over: Partial<Parameters<typeof mergeSnapshots>[0]> = {}) => ({ cvs: [], letters: [], applications: [], job: { text: '' }, deleted: {}, ...over });

describe('synchronisation : fusion', () => {
  it('garde la version la plus récente et retire le CV vide créé d’office', () => {
    const cv = { ...sampleCv(), id: 'a', updatedAt: 100 };
    const newer = { ...cv, label: 'Modifié', updatedAt: 200 };
    const blank = { ...emptyCv(), id: 'vide', updatedAt: 300 };
    const out = mergeSnapshots(snap({ cvs: [cv, blank] }), snap({ cvs: [newer] }));
    expect(out.cvs.map((c) => [c.id, c.label])).toEqual([['a', 'Modifié']]);
  });

  it('un élément supprimé sur un appareil ne revient pas', () => {
    const app = { id: 'x', title: 'Poste', updatedAt: 100 } as never;
    const out = mergeSnapshots(snap({ deleted: { x: 150 } }), snap({ applications: [app] }));
    expect(out.applications).toEqual([]);
    expect(out.deleted.x).toBe(150);
  });
});

describe('synchronisation : serveur', () => {
  it('garde, rend et efface la copie du compte', async () => {
    const db = await testDb();
    const accounts = createAccounts(db, { freeCredits: 1, freeIpCooldownDays: 30 });
    const app = createApp({ ai: null, accounts, sync: createSync(db), sessionSecret: 's', allowedOrigins: [], rateLimitPerHour: 5 });
    const user = await accounts.register({ identifier: 'sync@x.co', password: 'secret1234', ip: '6.6.6.6', device: 'device-sync-0001' });
    const h = { 'content-type': 'application/json', authorization: `Bearer ${signToken(user.id, 's')}` };
    expect((await app.request('/api/sync')).status).toBe(401);
    expect((await (await app.request('/api/sync', { headers: h })).json()).data).toBeNull();
    const data = snap({ cvs: [{ ...sampleCv(), id: 'a', updatedAt: 1 }] });
    expect((await app.request('/api/sync', { method: 'POST', headers: h, body: JSON.stringify({ data }) })).status).toBe(200);
    expect((await (await app.request('/api/sync', { headers: h })).json()).data.cvs[0].id).toBe('a');
    expect((await app.request('/api/sync', { method: 'POST', headers: h, body: JSON.stringify({ data: { cvs: 'non' } }) })).status).toBe(400);
    await app.request('/api/sync/erase', { method: 'POST', headers: h });
    expect((await (await app.request('/api/sync', { headers: h })).json()).data).toBeNull();
  });
});
