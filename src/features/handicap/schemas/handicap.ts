import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';

// ============================================================================
// Contract: GET {VITE_API_URL}/handicap
// Real path: /api/v1/handicap
// Source: live response (the swagger example showed a cursor envelope, but the
// API actually returns the standard meta/data page envelope).
// Confidential: admin-only, no medical data is collected.
// ============================================================================

/** One waitlist row. Contact/location fields are nullable in live data. */
export const handicapItemSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  contactName: z.string().nullish(),
  contactPhone: z.string().nullish(),
  contactEmail: z.string().nullish(),
  jobType: z.string().nullish(),
  positionsCount: z.number().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  comment: z.string().nullish(),
  isContacted: z.boolean(),
  contactedAt: z.string().nullish(),
  contactNote: z.string().nullish(),
  registeredAt: z.string(), // ISO 8601
  updatedAt: z.string().nullish(),
});
export type HandicapItem = z.infer<typeof handicapItemSchema>;

export const handicapListSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(handicapItemSchema),
});
export type HandicapList = z.infer<typeof handicapListSchema>;

/** Server-side filters; `page` is managed by the infinite query. */
export interface HandicapParams {
  search?: string;
  wilaya?: string;
  jobType?: string;
  contacted?: boolean;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Legacy mock-db seed shape (logic.ts hcWaitlist(), hc1..hc5) — still the
// storage format of src/api/mock/db.ts; the mock handler maps it to
// handicapItemSchema.
// ---------------------------------------------------------------------------
export const handicapWorkerSchema = z.object({
  id: z.string(),
  entreprise: z.string(),
  contact: z.string(),
  phone: z.string(),
  poste: z.string(),
  nombre: z.number(),
  zone: z.string(), // wilaya
  date: z.string(), // inscription date dd/mm/yyyy
  commentaire: z.string(),
  wa: z.string(),
  contacted: z.boolean(), // seeded from state.hcContacted
});
export type HandicapWorker = z.infer<typeof handicapWorkerSchema>;
