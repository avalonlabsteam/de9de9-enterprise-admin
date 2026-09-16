import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';

// ============================================================================
// Contract: GET {VITE_API_URL}/prestataires/recherche
// Real path: /api/v1/prestataires/recherche
// Source: https://api.entreprise.de9de9.dz/swagger
// ============================================================================

/**
 * One coverage zone. A zone can be wilaya-wide, in which case the commune pair
 * is null in live data — only the wilaya is guaranteed.
 */
export const zoneSchema = z.object({
  wilayaCode: z.number(),
  wilaya: z.string(),
  communeCode: z.number().nullish(),
  commune: z.string().nullish(),
});
export type Zone = z.infer<typeof zoneSchema>;

export const codeLabelSchema = z.object({
  code: z.string(),
  label: z.string(),
});
export type CodeLabel = z.infer<typeof codeLabelSchema>;

export const familleSchema = z.object({
  code: z.string(),
  label: z.string(),
  hex: z.string().nullish(),
});
export type Famille = z.infer<typeof familleSchema>;

/**
 * Pricing bracket the API derives from `tarifMinDzd` / `tarifMaxDzd`. The
 * bounds are widened: an open-ended top bracket has no `maxDzd`.
 */
export const tarifPalierSchema = z.object({
  code: z.string(),
  label: z.string(),
  minDzd: z.number().nullish(),
  maxDzd: z.number().nullish(),
});
export type TarifPalier = z.infer<typeof tarifPalierSchema>;

/**
 * One search result card. Scalars that are semantically optional (no logo, no
 * tariff published, no contact channel, …) are widened with `nullish` — same
 * convention as the worklist schema.
 *
 * `anneeCreation`, `ancienneteAnnees`, `langues`, `tarifPalier` and `liste`
 * joined the contract after the fields above; they are `nullish` so a row from
 * a deployment that predates them still parses (the last live capture, 140
 * rows, carried none of the five).
 */
export const prestataireSearchItemSchema = z.object({
  id: z.string(),
  companyId: z.string().nullish(),
  nom: z.string(),
  pitch: z.string().nullish(),
  logoUrl: z.string().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  zones: z.array(zoneSchema),
  categories: z.array(codeLabelSchema),
  sousCategories: z.array(codeLabelSchema),
  familles: z.array(familleSchema),
  effectif: z.number().nullish(),
  anneeCreation: z.number().nullish(),
  ancienneteAnnees: z.number().nullish(),
  langues: z.array(z.string()).nullish(),
  tarifMinDzd: z.number().nullish(),
  tarifMaxDzd: z.number().nullish(),
  tarifPalier: tarifPalierSchema.nullish(),
  delaiReponseHeures: z.number().nullish(),
  dispoNow: z.boolean(),
  kycVerifie: z.boolean(),
  certifie: z.boolean(),
  liste: z.boolean().nullish(),
  certifications: z.array(z.string()),
  /** Null until the prestataire has at least one review (verified live). */
  note: z.number().nullish(),
  nombreAvis: z.number(),
  missions: z.number(),
  satisfactionPercent: z.number().nullish(),
  referencesDe9de9: z.number(),
  referencesClient: z.number(),
  contactEmail: z.string().nullish(),
  contactPhone: z.string().nullish(),
  whatsAppPhone: z.string().nullish(),
  whatsAppUrl: z.string().nullish(),
  createdAt: z.string(),
});
export type PrestataireSearchItem = z.infer<typeof prestataireSearchItemSchema>;

export const rechercheResponseSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(prestataireSearchItemSchema),
});
export type RechercheResponse = z.infer<typeof rechercheResponseSchema>;

// ---------- query params (sent PascalCase, arrays as repeated keys) ----------
export interface RechercheParams {
  q?: string;
  categories?: string[];
  sousCategories?: string[];
  familles?: string[];
  wilaya?: string;
  commune?: string;
  noteMin?: number;
  effectifMin?: number;
  effectifMax?: number;
  tarifMinDzd?: number;
  tarifMaxDzd?: number;
  delaiMaxHeures?: number;
  dispoNow?: boolean;
  kycOnly?: boolean;
  certifieOnly?: boolean;
  liste?: boolean;
  tri?: string;
  page?: number;
  pageSize?: number;
}
