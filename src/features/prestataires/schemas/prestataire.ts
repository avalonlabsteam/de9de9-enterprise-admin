import { z } from 'zod';

// ---------- prestataire (seeded from logic.ts prestataires(), p1..p24) ----------
export const presRefSchema = z.object({
  client: z.string(),
  service: z.string(),
});
export type PresRef = z.infer<typeof presRefSchema>;

export const prestataireSchema = z.object({
  id: z.string(),
  name: z.string(),
  init: z.string(),
  cat: z.number().int(), // taxonomy category id (1..16)
  subs: z.array(z.string()),
  wilayas: z.array(z.string()),
  rating: z.number(),
  reviews: z.number(),
  missions: z.number(),
  sat: z.number(), // satisfaction %
  delai: z.string(), // e.g. '2 j'
  effectif: z.number(),
  certs: z.array(z.string()),
  kyc: z.boolean(),
  tarif: z.number(), // 1..3 (€ level)
  anc: z.number(), // ancienneté (years)
  langues: z.array(z.string()),
  phone: z.string(),
  wa: z.string(),
  email: z.string(),
  dispo: z.string(), // 'now' or 'dd/mm/yyyy · hh:mm'
  refs: z.array(presRefSchema),
});
export type Prestataire = z.infer<typeof prestataireSchema>;

// ---------- workers (ouvriers) ----------
export const workerSchema = z.string();
export type Worker = z.infer<typeof workerSchema>;

// ---------- KYC ----------
export const kycStatusSchema = z.enum(['verified', 'pending', 'rejected']);
export type KycStatus = z.infer<typeof kycStatusSchema>;

export const kycDocSchema = z.object({
  id: z.string(),
  label: z.string(),
  name: z.string(),
});
export type KycDoc = z.infer<typeof kycDocSchema>;

export const kycAuditEntrySchema = z.object({
  who: z.string(),
  action: z.string(),
  date: z.string(),
});
export type KycAuditEntry = z.infer<typeof kycAuditEntrySchema>;

export const kycStateSchema = z.object({
  status: kycStatusSchema,
  motif: z.string(),
  docs: z.array(kycDocSchema),
  audit: z.array(kycAuditEntrySchema),
});
export type KycState = z.infer<typeof kycStateSchema>;

// Body of POST /kyc/:key/docs
export const kycDocInputSchema = z.object({
  label: z.string().min(1),
  fileName: z.string().min(1),
});
export type KycDocInput = z.infer<typeof kycDocInputSchema>;
