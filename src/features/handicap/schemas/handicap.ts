import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';

// ============================================================================
// Contract: « Handicap : demandes, candidats, placements » guide, parts 1–3.
// Real paths under /api/v1, all AdminOnly:
//   demandes     GET  /handicap?search=&wilaya=&jobType=&contacted=&page=&pageSize=
//                POST /handicap · PUT /handicap/{id} · DELETE /handicap/{id}
//                POST /handicap/{id}/contacter · POST /handicap/{id}/reouvrir
//   candidats    GET  /handicap/candidats?search=&wilaya=&jobType=&disponible=&page=&pageSize=
//                GET  /handicap/candidats/compteurs · GET /handicap/candidats/{id}
//                POST /handicap/candidats · PUT /handicap/candidats/{id}
//                DELETE /handicap/candidats/{id}
//   placements   GET  /handicap/{id}/placements · POST /handicap/{id}/placements
//                POST /handicap/placements/{placementId}/terminer
//                DELETE /handicap/placements/{placementId}
// Confidential: admin-only. No field describes a disability or a health
// condition — on a demande or on a person — and none may be added.
// ============================================================================

// ---------------------------------------------------------------------------
// Demandes — what an entreprise asked for (« we want to hire N people »).
// ---------------------------------------------------------------------------

/** a_contacter · contactee · en_cours · pourvue */
export type DemandeStatut = 'a_contacter' | 'contactee' | 'en_cours' | 'pourvue';

/** One demande. Contact/location fields are nullable in live data. */
export const handicapItemSchema = z.object({
  id: z.string(),
  /** Keys the prestataire profile (`?pres=`) — null when no company matched. */
  companyId: z.string().nullish(),
  companyName: z.string(),
  contactName: z.string().nullish(),
  contactPhone: z.string().nullish(),
  contactEmail: z.string().nullish(),
  jobType: z.string().nullish(),
  positionsCount: z.number().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  comment: z.string().nullish(),
  isContacted: z.boolean(),
  contactedAt: z.string().nullish(),
  contactNote: z.string().nullish(),
  registeredAt: z.string(), // ISO 8601
  updatedAt: z.string().nullish(),
  /** False when `companyName` couldn't be matched to a registered company. */
  companyIdMatched: z.boolean().nullish(),
  /** People placed and still working there. Absent on an API older than the placements. */
  placedCount: z.number().nullish(),
  /** A plain string on purpose: a code this app does not know only loses its colour. */
  statut: z.string().nullish(),
});
export type HandicapItem = z.infer<typeof handicapItemSchema>;

export const handicapListSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(handicapItemSchema),
});
export type HandicapList = z.infer<typeof handicapListSchema>;

/** Server-side filters; `page` is managed by the infinite query. */
export interface HandicapParams {
  search?: string;
  wilaya?: string;
  jobType?: string;
  contacted?: boolean;
  pageSize?: number;
}

/**
 * Body of POST /handicap and PUT /handicap/{id}. The PUT is a full
 * replacement: a field left out is cleared, so `companyId` must be sent back
 * or the demande loses its link to the company (and the company its alerts).
 */
export interface DemandeInput {
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  jobType: string;
  positionsCount: number;
  wilaya: string | null;
  commune: string | null;
  comment: string | null;
  companyId: string | null;
}

// ---------------------------------------------------------------------------
// Placements — one person placed on one demande.
// ---------------------------------------------------------------------------

export const placementSchema = z.object({
  id: z.string(),
  registrationId: z.string().nullish(),
  companyId: z.string().nullish(),
  companyName: z.string().nullish(),
  jobType: z.string().nullish(),
  candidatId: z.string().nullish(),
  candidatName: z.string().nullish(),
  candidatPhone: z.string().nullish(),
  candidatJobType: z.string().nullish(),
  placedAt: z.string().nullish(),
  note: z.string().nullish(),
  /** False once « Terminer » was pressed: the row stays as history. */
  actif: z.boolean(),
  endedAt: z.string().nullish(),
  endReason: z.string().nullish(),
});
export type Placement = z.infer<typeof placementSchema>;

/**
 * The state of one demande — GET /handicap/{id}/placements. Every placement
 * route answers it, so the screen repaints from the answer. `placements`
 * come active first, then newest first.
 */
export const demandeEtatSchema = z.object({
  registrationId: z.string(),
  companyId: z.string().nullish(),
  companyName: z.string().nullish(),
  jobType: z.string().nullish(),
  positionsCount: z.number(),
  placedCount: z.number(),
  /** Positions still open — the most people « Placer » may take. */
  restant: z.number(),
  statut: z.string().nullish(),
  placements: z.array(placementSchema),
});
export type DemandeEtat = z.infer<typeof demandeEtatSchema>;

/** `candidatIds`: 1 to 50. `note`: ≤ 2000, stored on each placement. */
export const PLACER_MAX = 50;
export const HC_TEXT_MAX = 2000;

// ---------------------------------------------------------------------------
// Candidats — de9de9's own list of people looking for a job.
// ---------------------------------------------------------------------------

export const candidatSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  /** « Poste recherché » — the same words as a demande's « Type de poste ». */
  jobType: z.string().nullish(),
  competences: z.string().nullish(),
  /** Internal — never shown to a company. */
  note: z.string().nullish(),
  /** No active placement. */
  disponible: z.boolean(),
  /** Null when `disponible`. */
  placementActif: placementSchema.nullish(),
  addedAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});
export type Candidat = z.infer<typeof candidatSchema>;

export const candidatListSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(candidatSchema),
});
export type CandidatList = z.infer<typeof candidatListSchema>;

/** GET /handicap/candidats/compteurs */
export const candidatCompteursSchema = z.object({
  total: z.number(),
  disponibles: z.number(),
  places: z.number(),
});
export type CandidatCompteurs = z.infer<typeof candidatCompteursSchema>;

/** GET /handicap/candidats/{id} — the person with every placement they had. */
export const candidatDetailSchema = z.object({
  candidat: candidatSchema,
  placements: z.array(placementSchema),
});
export type CandidatDetail = z.infer<typeof candidatDetailSchema>;

export interface CandidatParams {
  /** Name, phone, job or skills. */
  search?: string;
  wilaya?: string;
  jobType?: string;
  /** true = no active placement · false = in a job · absent = everybody. */
  disponible?: boolean;
  pageSize?: number;
}

/** Body of POST /handicap/candidats and PUT /handicap/candidats/{id} (full replacement). */
export interface CandidatInput {
  fullName: string;
  phone: string;
  email: string | null;
  jobType: string;
  wilaya: string | null;
  commune: string | null;
  competences: string | null;
  note: string | null;
}

/** Field limits of a person (guide §5). */
export const CANDIDAT_MAX = { fullName: 160, phone: 32, email: 256, jobType: 160, lieu: 96 } as const;

// ---------------------------------------------------------------------------
// Legacy mock-db seed shape (logic.ts hcWaitlist(), hc1..hc5) — still the
// storage format of src/api/mock/db.ts; the mock handler maps it to
// handicapItemSchema.
// ---------------------------------------------------------------------------
export const handicapWorkerSchema = z.object({
  id: z.string(),
  entreprise: z.string(),
  contact: z.string(),
  phone: z.string(),
  poste: z.string(),
  nombre: z.number(),
  zone: z.string(), // wilaya
  date: z.string(), // inscription date dd/mm/yyyy
  commentaire: z.string(),
  wa: z.string(),
  contacted: z.boolean(), // seeded from state.hcContacted
});
export type HandicapWorker = z.infer<typeof handicapWorkerSchema>;
