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
 * One of the company's eligible annonces — B2B, « Publiée », KYC verified — as
 * the search card and the profile draw it. The labels are ready to print; a
 * B2C annonce never comes here.
 */
export const annonceCarteSchema = z.object({
  /** GET /admin/annonces/{id} */
  id: z.string(),
  titre: z.string(),
  /** Null when the category left the catalogue. */
  categorie: codeLabelSchema.nullish(),
  sousCategories: z.array(codeLabelSchema).default([]),
  /** « 4 000 – 9 000 DA / jour », « Sur devis », « À partir de 4 000 DA / jour » */
  tarifLabel: z.string().nullish(),
  /** « Alger, Blida +3 »; null when the annonce names no zone. */
  zonesLabel: z.string().nullish(),
  /** Absolute and public: a plain <img src>. */
  couvertureUrl: z.string().nullish(),
  delaiDemarrageJours: z.number().nullish(),
  /** « Démarrage sous 3 jours » */
  delaiLabel: z.string().nullish(),
  publieeLe: z.string().nullish(),
});
export type AnnonceCarte = z.infer<typeof annonceCarteSchema>;

/**
 * One category of the company — of its directory card, or of a published B2B
 * annonce — with its own services and the colour of its catalogue family.
 */
export const categorieDetailSchema = z.object({
  code: z.string(),
  label: z.string(),
  /** The category's family, hence its colour; never null in practice. */
  famille: familleSchema.nullish(),
  /** The services of THIS category; on the fiche, the card's first, then the annonces' extra ones. */
  sousCategories: z.array(codeLabelSchema).default([]),
  /** On the directory card; false = only an annonce carries it. */
  surFiche: z.boolean().default(true),
  /** Published B2B annonces of the company in this category — all of them, whatever the search filters. */
  annonces: z.number().default(0),
  /** The search asked for it (catégorie, parent of a sous-catégorie, or famille filter). Always false on the fiche. */
  demandee: z.boolean().default(false),
});
export type CategorieDetail = z.infer<typeof categorieDetailSchema>;

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
  /** manuelle · annonces — `annonces`: the coverage is the sum of the published B2B annonces. */
  couvertureSource: z.string().nullish(),
  /** The sentence to print over a card driven by annonces; null when filled by hand. */
  couvertureNote: z.string().nullish(),
  /**
   * Newest first. Search: the annonces that pass every coverage filter that is
   * set (all of them without one) — `[]` for a company found through its card
   * alone. Fiche: all of them. Absent on an older deployment and on the
   * answers of the write routes.
   */
  annonces: z.array(annonceCarteSchema).nullish(),
  /**
   * Every category of the company, grouped and ready to draw. Search: one
   * entry per item of `categories`, same order (the asked ones first). Fiche:
   * the card's own first, then those only its annonces carry. Null on the
   * answers of the write routes, absent on an older API: the card then keeps
   * `categories[0]` and the joined `sousCategories`.
   */
  categoriesDetaillees: z.array(categorieDetailSchema).nullish(),
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
