import { z } from 'zod';

// ============================================================================
// « Recruter des pros de9de9 » (guide 23) — a prestataire asks de9de9 for N
// pros of the de9de9 app; an admin places real de9de9 pros on the demande.
//   demandes   GET  /admin/contractuels/demandes (+ /compteurs, /{id})
//              POST /admin/contractuels/demandes/{id}/take | /close
//   placements POST /admin/contractuels/demandes/{id}/placements
//              POST /admin/contractuels/placements/{placementId}/release
//   pros       GET  /admin/contractuels/pros (+ /filtres)
// The lists and the pros are read live from the de9de9 app database: they
// answer 503 `legacy_unavailable` when it is not connected. Every nullable
// field is `.nullish()`; statuses stay plain strings.
// ============================================================================

/** The de9de9 app's ids may be numbers or GUIDs: always handled as text. */
const textId = z.union([z.string(), z.number()]).transform(String);

// ---------- the de9de9 app's lists — GET /admin/contractuels/pros/filtres ----------

export const optionServiceSchema = z.object({
  id: z.number(),
  name: z.string(),
  nameAr: z.string().nullish(),
});
export type OptionService = z.infer<typeof optionServiceSchema>;

export const optionCategorieSchema = z.object({
  id: z.number(),
  name: z.string(),
  nameAr: z.string().nullish(),
  /** Travaux, Beauté, Santé… — already ordered by group then name. */
  groupe: z.string().nullish(),
  groupeAr: z.string().nullish(),
  /** de9de9 pros holding this category. */
  pros: z.number().nullish(),
  services: z.array(optionServiceSchema).nullish(),
});
export type OptionCategorie = z.infer<typeof optionCategorieSchema>;

export const optionWilayaSchema = z.object({
  id: z.number(),
  code: z.number().nullish(),
  name: z.string(),
  nameAr: z.string().nullish(),
});
export type OptionWilaya = z.infer<typeof optionWilayaSchema>;

export const prosFiltresSchema = z.object({
  categories: z.array(optionCategorieSchema),
  wilayas: z.array(optionWilayaSchema),
});
export type ProsFiltres = z.infer<typeof prosFiltresSchema>;

// ---------- demandes ----------

export const ctrDemandeSchema = z.object({
  id: z.string(),
  prestataireCompanyId: z.string().nullish(),
  companyName: z.string().nullish(),
  categoryCode: z.string().nullish(),
  categoryLabel: z.string().nullish(),
  subcategoryCode: z.string().nullish(),
  subcategoryLabel: z.string().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  requestedCount: z.number(),
  fulfilledCount: z.number(),
  restant: z.number().nullish(),
  progress: z.string().nullish(),
  note: z.string().nullish(),
  /** submitted · in_progress · fulfilled · closed · cancelled */
  status: z.string(),
  statusLabel: z.string().nullish(),
  handledByUserId: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  closedAt: z.string().nullish(),
  /** The de9de9 app's ids — the pros directory starts its filters from them. */
  categoryId: z.number().nullish(),
  serviceId: z.number().nullish(),
  wilayaId: z.number().nullish(),
});
export type CtrDemande = z.infer<typeof ctrDemandeSchema>;

export const ctrDemandesPageSchema = z.object({
  items: z.array(ctrDemandeSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type CtrDemandesPage = z.infer<typeof ctrDemandesPageSchema>;

export const ctrCompteursSchema = z.object({
  total: z.number(),
  /** submitted + in_progress */
  aTraiter: z.number(),
  submitted: z.number(),
  inProgress: z.number(),
  fulfilled: z.number(),
  closed: z.number(),
  cancelled: z.number(),
});
export type CtrCompteurs = z.infer<typeof ctrCompteursSchema>;

export const ctrPlacementSchema = z.object({
  id: z.string(),
  displayName: z.string().nullish(),
  phone: z.string().nullish(),
  /** active · released */
  status: z.string(),
  placedAt: z.string().nullish(),
  releasedAt: z.string().nullish(),
  releaseReason: z.string().nullish(),
});
export type CtrPlacement = z.infer<typeof ctrPlacementSchema>;

/** GET /admin/contractuels/demandes/{id} */
export const ctrDemandeDetailSchema = z.object({
  demande: ctrDemandeSchema,
  placements: z.array(ctrPlacementSchema),
});
export type CtrDemandeDetail = z.infer<typeof ctrDemandeDetailSchema>;

// ---------- pros of the de9de9 app ----------

export const ctrProSchema = z.object({
  legacyProUserId: textId,
  fullName: z.string().nullish(),
  /** As stored by the de9de9 app: a path or a URL. */
  photoUrl: z.string().nullish(),
  phone: z.string().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  categories: z.array(z.string()).nullish(),
  services: z.array(z.string()).nullish(),
  servicesRealises: z.number().nullish(),
  offresRecues: z.number().nullish(),
  offresEnvoyees: z.number().nullish(),
  /** Percent; null when the pro has no history. */
  tauxAbandon: z.number().nullish(),
  rating: z.number().nullish(),
  evaluations: z.number().nullish(),
  kycApproved: z.boolean().nullish(),
  actif: z.boolean().nullish(),
  /** now · date · place · indisponible */
  dispo: z.string().nullish(),
  dispoDate: z.string().nullish(),
  /** The company name(s) when `dispo` is `place`. */
  placeChez: z.union([z.string(), z.array(z.string())]).nullish(),
  /** Already in the équipe of the demande's company. */
  alreadyPlacedHere: z.boolean().nullish(),
  /** Placed with another company — a pro works for one company at a time. */
  placedElsewhere: z.boolean().nullish(),
});
export type CtrPro = z.infer<typeof ctrProSchema>;

export const ctrProsPageSchema = z.object({
  items: z.array(ctrProSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type CtrProsPage = z.infer<typeof ctrProsPageSchema>;

/** POST /admin/contractuels/demandes/{id}/placements */
export const ctrPlacementResultSchema = z.object({
  placement: ctrPlacementSchema,
  demande: ctrDemandeSchema,
  assignmentsRemoved: z.number().nullish(),
  assignmentsKept: z.number().nullish(),
});
export type CtrPlacementResult = z.infer<typeof ctrPlacementResultSchema>;
