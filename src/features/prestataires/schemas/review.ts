import { z } from 'zod';

export const reviewSourceSchema = z.enum(['client', 'de9de9']);
export type ReviewSource = z.infer<typeof reviewSourceSchema>;

// Seeded from logic.ts seedReviews() (r1..r20).
export const reviewSchema = z.object({
  id: z.string(),
  presId: z.string(),
  source: reviewSourceSchema,
  auteur: z.string(),
  cmd: z.string(),
  occ: z.string(),
  service: z.string(),
  note: z.number().int().min(1).max(5),
  comment: z.string(),
  date: z.string(),
});
export type Review = z.infer<typeof reviewSchema>;

// Body of POST /reviews (mirrors submitReview: source forced to 'de9de9',
// auteur 'de9de9 · Karim', prepended to the list).
export const reviewInputSchema = z.object({
  presId: z.string().min(1),
  presName: z.string().optional(), // used for the audit-trail message on the commande
  cmd: z.string().optional(),
  occ: z.string().optional(),
  service: z.string().optional(),
  note: z.number().int().min(1).max(5),
  comment: z.string().min(1),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;
