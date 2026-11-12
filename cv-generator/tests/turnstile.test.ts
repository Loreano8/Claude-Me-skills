import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { createAccounts } from '../server/accounts.ts';
import { createTurnstile } from '../server/turnstile.ts';
import { testDb } from './pglite.ts';

// Faux Cloudflare : seul le jeton « bon » est accepté.
const fakeFetch = (async (_url: string, init?: { body?: URLSearchParams }) =>
  new Response(JSON.stringify({ success: init?.body?.get('response') === 'bon' && init.body.get('secret') === 'secret' }))) as unknown as typeof fetch;

describe('vérification anti-robot (Turnstile)', () => {
  it('inactive tant que les deux clés ne sont pas réglées', () => {
    expect(createTurnstile({})).toBeNull();
    expect(createTurnstile({ TURNSTILE_SITE_KEY: 'site' })).toBeNull();
    expect(createTurnstile({ TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET: 'secret' })?.siteKey).toBe('site');
  });

  it('bloque l’inscription sans jeton valide, et l’accepte avec', async () => {
    const accounts = createAccounts(await testDb(), { freeCredits: 1, freeIpCooldownDays: 30 });
    const turnstile = createTurnstile({ TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET: 'secret' }, fakeFetch);
    const app = createApp({ ai: null, accounts, turnstile, sessionSecret: 's', allowedOrigins: [], rateLimitPerHour: 50 });
    const register = (captcha: string, lang = 'fr') =>
      app.request('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-device-id': `device-ts-${captcha}-${lang}`, 'x-lang': lang }, body: JSON.stringify({ identifier: `ts-${captcha}-${lang}@x.co`, password: 'secret1234', captcha }) });
    expect((await (await app.request('/api/health')).json()).captcha).toBe('site');
    const refused = await register('mauvais');
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toBe('La vérification anti-robot n’a pas abouti. Réessayez.');
    expect((await (await register('', 'en')).json()).error).toBe('The anti-robot check didn’t go through. Try again.');
    expect((await register('bon')).status).toBe(200);
  });

  it('ne bloque pas les inscriptions si Cloudflare est injoignable', async () => {
    const down = (async () => {
      throw new Error('réseau');
    }) as unknown as typeof fetch;
    expect(await createTurnstile({ TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET: 'secret' }, down)!.verify('jeton', '1.1.1.1')).toBe(true);
    expect(await createTurnstile({ TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET: 'secret' }, down)!.verify('', '1.1.1.1')).toBe(false);
  });
});
