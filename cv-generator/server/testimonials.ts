import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Db } from './db.ts';

/** Témoignage envoyé depuis « Mes candidatures » quand une candidature est acceptée. */
export const TestimonialInput = z.object({
  firstName: z.string().trim().min(1).max(40),
  jobTitle: z.string().trim().min(1).max(80),
  company: z.string().trim().min(1).max(80),
  city: z.string().trim().max(60).default(''),
  message: z.string().trim().max(400).default(''),
  // Accord explicite de la personne pour apparaître sur le site.
  consent: z.literal(true),
});
export type TestimonialInput = z.output<typeof TestimonialInput>;

export type TestimonialStatus = 'pending' | 'approved' | 'rejected';

export interface PublicTestimonial {
  firstName: string;
  jobTitle: string;
  company: string;
  city: string;
  message: string;
}

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');

export function createTestimonials(db: Db) {
  return {
    /** Enregistre un témoignage (en attente de validation). Le secret renvoyé permet à son auteur de le retirer. */
    async submit(input: TestimonialInput, device: string): Promise<{ id: number; secret: string }> {
      const secret = randomBytes(24).toString('hex');
      const [row] = await db.query<{ id: number }>(
        `insert into testimonials (first_name, job_title, company, city, message, secret_hash, device)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [input.firstName, input.jobTitle, input.company, input.city, input.message, hash(secret), device.slice(0, 120)],
      );
      return { id: row.id, secret };
    },

    /** Retrait par son auteur : le témoignage est supprimé définitivement. */
    async withdraw(id: number, secret: string): Promise<boolean> {
      const rows = await db.query('delete from testimonials where id = $1 and secret_hash = $2 returning id', [id, hash(secret)]);
      return rows.length > 0;
    },

    /** Témoignages validés, affichés sur la page d'accueil. */
    async listApproved(limit = 30): Promise<PublicTestimonial[]> {
      return db.query<PublicTestimonial>(
        `select first_name as "firstName", job_title as "jobTitle", company, city, message
         from testimonials where status = 'approved' order by created_at desc limit $1`,
        [limit],
      );
    },

    async listAll() {
      return db.query(
        `select id, status, first_name as "firstName", job_title as "jobTitle", company, city, message, created_at as "createdAt"
         from testimonials order by created_at desc limit 200`,
      );
    },

    async setStatus(id: number, status: TestimonialStatus): Promise<boolean> {
      const rows = await db.query('update testimonials set status = $2 where id = $1 returning id', [id, status]);
      return rows.length > 0;
    },
  };
}

export type Testimonials = ReturnType<typeof createTestimonials>;
