import { z } from 'zod';

// Seeded from logic.ts subDemandes() (ST-101..ST-105).
export const subDemandeSchema = z.object({
  id: z.string(),
  entreprise: z.string(),
  cat: z.string(),
  sub: z.string(),
  date: z.string(), // dd/mm/yyyy
});
export type SubDemande = z.infer<typeof subDemandeSchema>;

// Seeded from logic.ts subPros() (st1..st10).
export const subProSchema = z.object({
  id: z.string(),
  name: z.string(),
  wilaya: z.string(),
  commune: z.string(),
  cat: z.string(),
  services: z.string(),
  realises: z.number(),
  recues: z.number(),
  envoyees: z.number(),
  abandon: z.number(), // %
  dispo: z.string(), // 'now' or 'dd/mm'
  phone: z.string(),
  wa: z.string(),
});
export type SubPro = z.infer<typeof subProSchema>;

// Body of POST /sub/salaries (mirrors confirmSalarie).
export const salarieInputSchema = z.object({
  proId: z.string().optional(),
  proName: z.string().min(1),
  entreprise: z.string().min(1),
});
export type SalarieInput = z.infer<typeof salarieInputSchema>;

// Sub-traitance audit entry appended by confirmSalarie.
export const subAuditEntrySchema = z.object({
  pro: z.string(),
  entreprise: z.string(),
  who: z.string(),
  date: z.string(),
});
export type SubAuditEntry = z.infer<typeof subAuditEntrySchema>;
