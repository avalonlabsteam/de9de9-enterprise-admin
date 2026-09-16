import { z } from 'zod';

// ============================================================================
// Contract: POST {VITE_API_URL}/appels-offres/{rfqId}/demander-devis
// Real path: /api/v1/appels-offres/{rfqId}/demander-devis
// multipart/form-data — `payload`: the JSON below as a string · `files`: every
// photo and document, one part each (a single `file` part is accepted too).
//
// The appel d'offres in the path owns the client, so the payload carries no
// `clientCompanyId`. Budgets appear twice: DZD inside the brief and credits at
// the top level — the form fills the credits, which is what it asks for.
// ============================================================================

/**
 * Enum codes, inferred from the documented sample (cadence 2 + frequence 1 for
 * a daily cleaning): cadence 1 ponctuel / 2 récurrent, frequence 1 quotidienne.
 * Hebdomadaire = 2 and mensuelle = 3 follow the usual order but are unverified.
 */
export const CADENCE = { ponctuel: 1, recurrent: 2 } as const;
export const FREQUENCE = { quotidienne: 1, hebdomadaire: 2, mensuelle: 3 } as const;

/**
 * Optional values are omitted rather than sent as null. Dates are ISO 8601 at
 * UTC midnight ('2026-09-22T00:00:00Z'); codes are taxonomy slugs
 * ('nettoyage-et-hygiene').
 */
export const demandeDevisBriefSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  categoryCode: z.string().min(1),
  subCategoryCodes: z.array(z.string()),
  wilaya: z.string(),
  commune: z.string(),
  adresseExacte: z.string(),
  superficieM2: z.number().optional(),
  cadence: z.number().int(),
  frequence: z.number().int().optional(),
  dateSouhaitee: z.string().optional(),
  deadline: z.string().optional(),
  contraintes: z.string(),
  budgetMinDzd: z.number().optional(),
  budgetMaxDzd: z.number().optional(),
});
export type DemandeDevisBrief = z.infer<typeof demandeDevisBriefSchema>;

export const demandeDevisPayloadSchema = z.object({
  prestataireCompanyIds: z.array(z.string()).min(1),
  message: z.string(),
  budgetMinCredits: z.number().optional(),
  budgetMaxCredits: z.number().optional(),
  brief: demandeDevisBriefSchema,
});
export type DemandeDevisPayload = z.infer<typeof demandeDevisPayloadSchema>;
