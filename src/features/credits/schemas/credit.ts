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
  /** The document id — preferred over parsing it out of `url`. */
  id: z.string().nullish(),
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
  // ---- added by the API after our last capture — nullish until they arrive ----
  /** For POST /credits/recharges/{rechargeId}/pieces (« Manquant »). */
  rechargeId: z.string().nullish(),
  /** Link « Client » by id — null on a versement. Names 404 as route keys. */
  clientId: z.string().nullish(),
  /** Link « Bénéficiaire » (the prestataire on deb/vers). */
  beneficiaireId: z.string().nullish(),
  /** Recharges only. */
  methode: z.string().nullish(),
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

// ============================================================================
// Contract: GET {VITE_API_URL}/credits/kpis?period=mois|annee|perso&du=&au=
// ============================================================================
export const CREDITS_PERIODS = ['mois', 'annee', 'perso'] as const;
export type CreditsPeriod = (typeof CREDITS_PERIODS)[number];

export interface CreditsKpisParams {
  period: CreditsPeriod;
  /** Only with period=perso, where both bounds are required. */
  du?: string;
  au?: string;
}

const creditsKpiBucketSchema = z.object({
  credits: z.number(),
  formatted: z.string(),
  mouvements: z.number(),
});
export const creditsKpisSchema = z.object({
  vendus: creditsKpiBucketSchema,
  depenses: creditsKpiBucketSchema,
  versementsPro: creditsKpiBucketSchema,
  /** Margin actually collected (15 %) — no longer an estimate. */
  marge: creditsKpiBucketSchema,
  /** Total client wallet balance today, independent of the period. */
  enCirculation: creditsKpiBucketSchema.nullish(),
  periodeDebut: z.string(),
  periodeFin: z.string(),
});
export type CreditsKpis = z.infer<typeof creditsKpisSchema>;

// ============================================================================
// Contract: GET {VITE_API_URL}/credits/filtres — tab counts, sorts, the Client
// filter list (companies that already have movements), recharge methods.
// ============================================================================
export const creditsFiltresSchema = z.object({
  types: z.array(z.object({ code: z.string(), label: z.string(), count: z.number() })),
  tris: z.array(z.object({ code: z.string(), label: z.string() })),
  clients: z.object({
    items: z.array(z.object({ id: z.string(), nom: z.string() })),
    truncated: z.boolean().nullish(),
    limit: z.number().nullish(),
  }),
  methodes: z.array(z.string()),
});
export type CreditsFiltres = z.infer<typeof creditsFiltresSchema>;

// ============================================================================
// Contract: GET {VITE_API_URL}/credits/{movementId} — one movement.
// Also the body POST /credits/recharges (201) and …/pieces (200) answer with.
// ============================================================================
export const creditMovementSchema = z.object({
  id: z.string(),
  type: creditTypeSchema,
  typeLabel: z.string().nullish(),
  date: z.string().nullish(),
  occurredAt: z.string().nullish(),
  credits: z.number(),
  dzd: z.number().nullish(),
  soldeAvantCredits: z.number().nullish(),
  soldeApresCredits: z.number().nullish(),
  soldeAvant: z.string().nullish(),
  soldeApres: z.string().nullish(),
  reference: z.string().nullish(),
  client: z.string().nullish(),
  clientCompanyId: z.string().nullish(),
  note: z.string().nullish(),
  /** Filled on deb / vers; null on a recharge. */
  debit: z
    .looseObject({
      prestataire: z.string().nullish(),
      prestataireCompanyId: z.string().nullish(),
      service: z.string().nullish(),
      visiteLe: z.string().nullish(),
      factureId: z.string().nullish(),
      factureRef: z.string().nullish(),
      montantFactureCredits: z.number().nullish(),
      ventilationPrestataireCredits: z.number().nullish(),
      ventilationMargeCredits: z.number().nullish(),
    })
    .nullish(),
  /** Filled on a recharge; null on deb / vers. */
  recharge: z
    .looseObject({
      methode: z.string().nullish(),
      reference: z.string().nullish(),
      justificatifDocumentId: z.string().nullish(),
      justificatifFileName: z.string().nullish(),
      justificatifUrl: z.string().nullish(),
      factureDocumentId: z.string().nullish(),
      factureFileName: z.string().nullish(),
      factureUrl: z.string().nullish(),
      effectueParUserId: z.string().nullish(),
      rechargeId: z.string().nullish(),
    })
    .nullish(),
});
export type CreditMovement = z.infer<typeof creditMovementSchema>;

// ============================================================================
// Contract: GET {VITE_API_URL}/credits/clients?q=&limit=&inclureInactifs= —
// the recharge dialog's client autocomplete; GET …/clients/{id} for one.
// ============================================================================
export const creditClientSchema = z.object({
  id: z.string(),
  nom: z.string(),
  legalName: z.string().nullish(),
  tradeName: z.string().nullish(),
  email: z.string().nullish(),
  telephone: z.string().nullish(),
  wilaya: z.string().nullish(),
  nif: z.string().nullish(),
  isActive: z.boolean().nullish(),
  /** false is not blocking: the first recharge creates the wallet. */
  hasWallet: z.boolean().nullish(),
  soldeCredits: z.number().nullish(),
  geleCredits: z.number().nullish(),
  disponibleCredits: z.number().nullish(),
  solde: z.string().nullish(),
});
export type CreditClient = z.infer<typeof creditClientSchema>;

export const creditClientsResponseSchema = z.object({
  items: z.array(creditClientSchema),
  truncated: z.boolean().nullish(),
  limit: z.number().nullish(),
});
export type CreditClientsResponse = z.infer<typeof creditClientsResponseSchema>;

/**
 * POST /credits/recharges — multipart. Replaces POST /recharges, which took the
 * client by NAME (ambiguous) and the pieces by file NAME only (so they later
 * downloaded as 404). At least one of justif / facture is required.
 */
export interface RechargeSubmitInput {
  clientId: string;
  montant: number;
  methode: string;
  reference?: string;
  visibleClient: boolean;
  justif?: File | null;
  facture?: File | null;
}