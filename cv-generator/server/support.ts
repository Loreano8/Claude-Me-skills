import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Db } from './db.ts';

// « Nous contacter » : une conversation par client, gardée sur le serveur. Le client la retrouve avec
// son compte, ou avec un secret gardé sur son appareil s'il n'a pas de compte. Le propriétaire répond
// depuis l'espace administrateur et peut être prévenu par e-mail ou WhatsApp (voir notifier()).

export const SupportMessageInput = z.object({
  body: z.string().trim().min(1).max(2000),
  name: z.string().trim().max(80).default(''),
  /** E-mail ou téléphone pour être recontacté (facultatif). */
  contact: z.string().trim().max(120).default(''),
});
export type SupportMessageInput = z.output<typeof SupportMessageInput>;

export interface SupportMessage {
  id: number;
  author: 'user' | 'admin';
  body: string;
  createdAt: string;
}

export interface SupportThreadSummary {
  id: number;
  name: string;
  contact: string;
  account: string | null;
  unread: number;
  lastMessage: string;
  lastAuthor: 'user' | 'admin';
  lastMessageAt: string;
}

/** Qui parle : un client connecté, et/ou le secret de conversation gardé sur son appareil. */
export interface SupportIdentity {
  userId?: number | null;
  secret?: string | null;
}

export type Notify = (text: string) => Promise<void>;

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');

export class SupportError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function createSupport(db: Db, notify: Notify = async () => {}) {
  async function findThread(who: SupportIdentity): Promise<{ id: number } | null> {
    if (who.secret) {
      const [t] = await db.query<{ id: number }>('select id from support_threads where secret_hash = $1', [hash(who.secret)]);
      if (t) return t;
    }
    if (who.userId) {
      const [t] = await db.query<{ id: number }>('select id from support_threads where user_id = $1 order by last_message_at desc limit 1', [who.userId]);
      if (t) return t;
    }
    return null;
  }

  const messagesOf = (threadId: number) =>
    db.query<SupportMessage>(
      'select id, author, body, created_at as "createdAt" from support_messages where thread_id = $1 order by id',
      [threadId],
    );

  return {
    /** Message du client. Crée la conversation au premier message ; renvoie alors le secret à garder. */
    async post(who: SupportIdentity, input: SupportMessageInput): Promise<{ secret?: string; threadId: number }> {
      let thread = await findThread(who);
      let secret: string | undefined;
      if (!thread) {
        secret = randomBytes(24).toString('hex');
        [thread] = await db.query<{ id: number }>(
          'insert into support_threads (user_id, secret_hash, name, contact) values ($1, $2, $3, $4) returning id',
          [who.userId ?? null, hash(secret), input.name, input.contact],
        );
      } else if (input.name || input.contact) {
        await db.query(
          `update support_threads set name = coalesce(nullif($2, ''), name), contact = coalesce(nullif($3, ''), contact) where id = $1`,
          [thread.id, input.name, input.contact],
        );
      }
      await db.transaction(async (tx) => {
        await tx.query('insert into support_messages (thread_id, author, body) values ($1, $2, $3)', [thread.id, 'user', input.body]);
        await tx.query(
          'update support_threads set unread_admin = unread_admin + 1, last_message_at = now(), user_id = coalesce(user_id, $2) where id = $1',
          [thread.id, who.userId ?? null],
        );
      });
      const from = input.name || input.contact || `conversation n°${thread.id}`;
      // La notification ne doit jamais faire échouer l'envoi du message.
      await notify(`Nouveau message CVCasa de ${from} :\n\n${input.body.slice(0, 500)}`).catch((e) => console.error('Notification support', e));
      return secret ? { secret, threadId: thread.id } : { threadId: thread.id };
    },

    /** Conversation vue par le client ; marque les réponses comme lues. */
    async thread(who: SupportIdentity): Promise<SupportMessage[]> {
      const thread = await findThread(who);
      if (!thread) return [];
      await db.query('update support_threads set unread_user = 0 where id = $1', [thread.id]);
      return messagesOf(thread.id);
    },

    /** Nombre de réponses non lues par le client (pastille dans l'appli). */
    async unread(who: SupportIdentity): Promise<number> {
      const thread = await findThread(who);
      if (!thread) return 0;
      const [row] = await db.query<{ unread_user: number }>('select unread_user from support_threads where id = $1', [thread.id]);
      return row?.unread_user ?? 0;
    },

    async adminList(): Promise<SupportThreadSummary[]> {
      return db.query<SupportThreadSummary>(
        `select t.id, t.name, t.contact, u.identifier as account, t.unread_admin as unread,
                m.body as "lastMessage", m.author as "lastAuthor", t.last_message_at as "lastMessageAt"
         from support_threads t
         left join users u on u.id = t.user_id
         join lateral (select body, author from support_messages where thread_id = t.id order by id desc limit 1) m on true
         order by (t.unread_admin > 0) desc, t.last_message_at desc
         limit 200`,
      );
    },

    async adminThread(id: number): Promise<SupportMessage[]> {
      const rows = await db.query('update support_threads set unread_admin = 0 where id = $1 returning id', [id]);
      if (!rows.length) throw new SupportError('Conversation introuvable.', 404);
      return messagesOf(id);
    },

    async adminReply(id: number, body: string): Promise<void> {
      const text = body.trim().slice(0, 4000);
      if (!text) throw new SupportError('Message vide.', 400);
      await db.transaction(async (tx) => {
        const rows = await tx.query('update support_threads set unread_user = unread_user + 1, last_message_at = now() where id = $1 returning id', [id]);
        if (!rows.length) throw new SupportError('Conversation introuvable.', 404);
        await tx.query('insert into support_messages (thread_id, author, body) values ($1, $2, $3)', [id, 'admin', text]);
      });
    },
  };
}

export type Support = ReturnType<typeof createSupport>;

/**
 * Prévient le propriétaire d'un nouveau message, selon les réglages présents :
 * - e-mail via Resend : RESEND_API_KEY + SUPPORT_NOTIFY_EMAIL ;
 * - WhatsApp via CallMeBot : CALLMEBOT_PHONE + CALLMEBOT_APIKEY.
 * Sans réglage, les messages attendent simplement dans l'espace administrateur.
 */
export function notifier(env: Record<string, string | undefined>, adminUrl: string, fetchImpl: typeof fetch = fetch): Notify {
  return async (text) => {
    const full = `${text}\n\nRépondre : ${adminUrl}`;
    const jobs: Promise<unknown>[] = [];
    if (env.RESEND_API_KEY && env.SUPPORT_NOTIFY_EMAIL) {
      jobs.push(
        fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: env.SUPPORT_FROM_EMAIL || env.EMAIL_FROM || 'CVCasa <onboarding@resend.dev>',
            to: env.SUPPORT_NOTIFY_EMAIL,
            subject: 'Nouveau message sur CVCasa',
            text: full,
          }),
        }),
      );
    }
    if (env.CALLMEBOT_PHONE && env.CALLMEBOT_APIKEY) {
      const q = new URLSearchParams({ phone: env.CALLMEBOT_PHONE, text: full, apikey: env.CALLMEBOT_APIKEY });
      jobs.push(fetchImpl(`https://api.callmebot.com/whatsapp.php?${q}`));
    }
    const results = await Promise.allSettled(jobs);
    for (const r of results) if (r.status === 'rejected') console.error('Notification support', r.reason);
  };
}
