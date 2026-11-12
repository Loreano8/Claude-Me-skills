// Vérification anti-robot Cloudflare Turnstile (gratuite) : à l'inscription et dans « Nous contacter » sans compte.
// Invisible pour une vraie personne (au pire une case à cocher). Active seulement si les deux clés sont réglées
// (TURNSTILE_SITE_KEY, publique, et TURNSTILE_SECRET, secrète, dans cvstudio.settings).

export interface Turnstile {
  siteKey: string;
  verify(token: string, ip: string): Promise<boolean>;
}

export function createTurnstile(env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): Turnstile | null {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim();
  const secret = env.TURNSTILE_SECRET?.trim();
  if (!siteKey || !secret) return null;
  return {
    siteKey,
    async verify(token, ip) {
      if (!token || token.length > 2048) return false;
      try {
        const body = new URLSearchParams({ secret, response: token });
        if (ip && ip !== 'unknown') body.set('remoteip', ip);
        const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
        const data = (await res.json()) as { success?: boolean };
        return data.success === true;
      } catch (e) {
        // Cloudflare injoignable : on ne bloque pas les inscriptions pour autant (les autres limites restent actives).
        console.error('Turnstile', e);
        return true;
      }
    },
  };
}
