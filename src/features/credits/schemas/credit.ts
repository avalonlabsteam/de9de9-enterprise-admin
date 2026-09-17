import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';

export const creditTypeSchema = z.enum(['rech', 'deb', 'vers']);
export type CreditType = z.infer<typeof creditTypeSchema>;

/**
 * A stored document on a recharge row. The live payload carries `url` next to
 * the name — a `/documents/{id}/download` link — and z.object strips keys it
 * does not declare, so it must be listed here or it never reaches the viewer.
 * The mock twin emits `name` only, hence nullish.
 */
export const pieceFileSchema = z.object({
  name: z.string(),
  url: z.string().nullish(),
});
export type PieceFile = z.infer<typeof pieceFileSchema>;

// ============================================================================
// Contract: GET {VITE_API_URL}/credits
// Real path: /api/v1/credits (meta/data page envelope, verified live)
// ============================================================================

/**
 * One ledger row. `benef`, `solde` and `cmdRef` carry a '—' sentinel in live
 * data (widened to `nullish` anyway). `date` arrives pre-formatted with a
 * FRENCH day name — the UI re-derives the label from `occurredAt` so the
 * Arabic locale stays correct.
 */
export const creditLedgerItemSchema = z.object({
  id: z.string(),
  date: z.string(),
  type: creditTypeSchema,
  client: z.string(),
  benef: z.string().nullish(),
  ref: z.string(),
  credits: z.number(), // signed amount
  solde: z.string().nullish(), // formatted balance, '—' when n/a
  email: z.string().nullish(),
  phone: z.string().nullish(),
  cmdRef: z.string().nullish(),
  justif: pieceFileSchema.nullish(), // recharge: client payment proof
  facture: pieceFileSchema.nullish(), // recharge: de9de9 issued invoice
  invoiceId: z.string().nullish(),
  occurredAt: z.string(), // ISO 8601
});
export type CreditLedgerItem = z.infer<typeof creditLedgerItemSchema>;

export const creditsLedgerResponseSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(creditLedgerItemSchema),
});
export type CreditsLedgerResponse = z.infer<typeof creditsLedgerResponseSchema>;

/** Query params (sent PascalCase: Q, Type, Page, …). */
export interface CreditsLedgerParams {
  q?: string;
  type?: CreditType;
  clientId?: string;
  du?: string;
  au?: string;
  tri?: string;
  page?: number;
  pageSize?: number;
}

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
