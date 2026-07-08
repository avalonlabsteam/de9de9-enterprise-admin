import { z } from 'zod';

// Waitlist row — seeded from logic.ts hcWaitlist() (hc1..hc5).
// Confidential: admin-only, no medical data is collected.
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
