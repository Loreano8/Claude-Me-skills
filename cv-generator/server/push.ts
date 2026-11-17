import type { Db } from './db.ts';

// Notifications sur le téléphone (appli Android), envoyées par le serveur via Firebase Cloud Messaging (API v1).
// Sert à prévenir quand la veille emploi trouve de nouvelles offres, même si l'appli est fermée.
// La clé du compte de service Firebase vit dans les réglages du serveur (FCM_SERVICE_ACCOUNT), jamais dans le code.

export const PUSH_SCHEMA = `
create table if not exists push_tokens (
  token text primary key,
  user_id bigint not null references users(id) on delete cascade,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on push_tokens (user_id)
`;

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Page de l'appli à ouvrir quand on touche la notification (ex. « veille »). */
  tab?: string;
}

function parseAccount(raw: string): ServiceAccount | null {
  try {
    const a = JSON.parse(raw) as Partial<ServiceAccount>;
    return a.project_id && a.client_email && a.private_key ? (a as ServiceAccount) : null;
  } catch {
    return null;
  }
}

const b64url = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Jeton d'accès Google (valable 1 h) obtenu en signant un JWT avec la clé du compte de service. */
async function accessToken(account: ServiceAccount, fetchImpl: typeof fetch, now = Date.now()): Promise<string> {
  const pem = account.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }),
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claims}`));
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64url(signature)}` }),
  });
  if (!res.ok) throw new Error(`Jeton Google refusé (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export function createPush(db: Db, serviceAccountJson = '', fetchImpl: typeof fetch = fetch) {
  const account = serviceAccountJson ? parseAccount(serviceAccountJson) : null;
  if (serviceAccountJson && !account) console.error('FCM_SERVICE_ACCOUNT illisible : notifications désactivées');
  let cached: { token: string; until: number } | null = null;
  const token = async () => {
    if (cached && cached.until > Date.now()) return cached.token;
    const t = await accessToken(account!, fetchImpl);
    cached = { token: t, until: Date.now() + 50 * 60_000 };
    return t;
  };

  return {
    /** Envoi possible (clé présente et lisible). Sans clé, l'appli s'inscrit quand même : rien n'est perdu. */
    enabled: account !== null,

    async register(userId: number, pushToken: string, platform = 'android'): Promise<void> {
      const tk = pushToken.trim();
      if (tk.length < 20 || tk.length > 4096) return;
      await db.query(
        `insert into push_tokens (token, user_id, platform) values ($1, $2, $3)
         on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now()`,
        [tk, userId, platform.slice(0, 20)],
      );
    },

    /** Envoie à tous les téléphones de la personne ; oublie ceux que Firebase ne connaît plus. Renvoie le nombre d'envois réussis. */
    async send(userId: number, msg: PushMessage): Promise<number> {
      if (!account) return 0;
      const rows = await db.query<{ token: string }>('select token from push_tokens where user_id = $1 order by updated_at desc limit 5', [userId]);
      if (!rows.length) return 0;
      const bearer = await token();
      let ok = 0;
      for (const { token: device } of rows) {
        const res = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
          body: JSON.stringify({
            message: {
              token: device,
              notification: { title: msg.title.slice(0, 120), body: msg.body.slice(0, 400) },
              data: msg.tab ? { tab: msg.tab } : {},
              android: { priority: 'high', notification: { icon: 'ic_stat_cvstudio', color: '#2549eb', channel_id: 'offres' } },
            },
          }),
        });
        if (res.ok) ok++;
        else if (res.status === 404 || res.status === 400) {
          // Téléphone désinstallé ou jeton périmé : on l'oublie.
          await db.query('delete from push_tokens where token = $1', [device]);
        } else console.error('Notification : envoi refusé', res.status);
      }
      return ok;
    },
  };
}

export type Push = ReturnType<typeof createPush>;
