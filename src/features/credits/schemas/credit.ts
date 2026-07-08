import { z } from 'zod';

export const creditTypeSchema = z.enum(['rech', 'deb', 'vers']);
export type CreditType = z.infer<typeof creditTypeSchema>;

export const pieceFileSchema = z.object({ name: z.string() });
export type PieceFile = z.infer<typeof pieceFileSchema>;

// One ledger row — ported from logic.ts creditRawStatic()
// [date, type, client, benef, ref, credits, solde, email, phone, cmdRef]
// plus the recharge payment pieces from state.rechargeDocs.
export const creditEntrySchema = z.object({
  date: z.string(), // dd/mm/yyyy
  type: creditTypeSchema,
  client: z.string(),
  benef: z.string(), // '—' when none
  ref: z.string(), // REC-xxxx / F-xxxx / V-xxxx
  credits: z.number(), // signed amount
  solde: z.string(), // formatted balance, '—' when n/a
  email: z.string(),
  phone: z.string(),
  cmdRef: z.string(), // linked commande id or ''
  justif: pieceFileSchema.nullable().optional(), // recharge: client payment proof
  facture: pieceFileSchema.nullable().optional(), // recharge: de9de9 issued invoice
});
export type CreditEntry = z.infer<typeof creditEntrySchema>;

export const rechargeMethodeSchema = z.enum(['Virement', 'Versement', 'Chèque', 'Carte']);
export type RechargeMethode = z.infer<typeof rechargeMethodeSchema>;

// Body of POST /recharges (mirrors confirmRecharge create mode).
export const rechargeInputSchema = z.object({
  client: z.string(),
  montant: z.number(),
  methode: rechargeMethodeSchema,
  reference: z.string().optional(),
  justif: pieceFileSchema.nullable().optional(),
  facture: pieceFileSchema.nullable().optional(),
  visibleClient: z.boolean().optional(),
});
export type RechargeInput = z.infer<typeof rechargeInputSchema>;
