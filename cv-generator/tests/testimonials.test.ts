import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.ts';
import { createTestimonials } from '../server/testimonials.ts';
import { testDb } from './pglite.ts';

async function setup() {
  const testimonials = createTestimonials(await testDb());
  const app = createApp({ ai: null, allowedOrigins: [], rateLimitPerHour: 100, testimonials, adminToken: 'adm' });
  const call = (method: string, path: string, body?: unknown, admin = false) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...(admin ? { authorization: 'Bearer adm' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { call };
}

const awa = { firstName: 'Awa', jobTitle: 'Comptable', company: 'SBEE', city: 'Cotonou', message: 'Merci !', consent: true };

describe('témoignages', () => {
  it('exige l’accord de la personne', async () => {
    const { call } = await setup();
    expect((await call('POST', '/api/testimonials', { ...awa, consent: false })).status).toBe(400);
  });

  it('ne publie qu’après validation, et l’auteur peut le retirer', async () => {
    const { call } = await setup();
    const { id, secret } = await (await call('POST', '/api/testimonials', awa)).json();
    const published = async () => (await (await call('GET', '/api/testimonials')).json()).testimonials;

    expect(await published()).toEqual([]);
    expect((await call('POST', `/api/admin/testimonials/${id}`, { status: 'approved' })).status).toBe(403);
    expect((await call('POST', `/api/admin/testimonials/${id}`, { status: 'approved' }, true)).status).toBe(200);
    expect(await published()).toEqual([{ firstName: 'Awa', jobTitle: 'Comptable', company: 'SBEE', city: 'Cotonou', message: 'Merci !' }]);

    expect((await call('POST', `/api/testimonials/${id}/withdraw`, { secret: 'faux' })).status).toBe(404);
    expect((await call('POST', `/api/testimonials/${id}/withdraw`, { secret })).status).toBe(200);
    expect(await published()).toEqual([]);
  });
});
