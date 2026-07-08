import { z } from 'zod';

// Facture lifecycle — subset of the occurrence status codes
// (V5 doneInvoiced · V5·C doneDisputed · V6 doneApproved · V7 paid).
export const factureStatusSchema = z.enum([
  'doneInvoiced',
  'doneDisputed',
  'doneApproved',
  'paid',
]);
export type FactureStatus = z.infer<typeof factureStatusSchema>;

// Derived from commandes occurrences with a deposited facture
// (logic.ts facturesForCmds / buildFactures).
export const factureSchema = z.object({
  cmdId: z.string(),
  occId: z.string(),
  ref: z.string(), // 'F-' + digits of the commande id
  montant: z.number(), // credits; prestataire gets 85%, de9de9 keeps 15%
  date: z.string(), // visit date dd/mm/yyyy
  status: factureStatusSchema,
  transfere: z.boolean(),
  client: z.string(),
  contact: z.string(),
  email: z.string(),
  pres: z.string(), // prestataire name or '—'
  service: z.string(),
});
export type Facture = z.infer<typeof factureSchema>;
