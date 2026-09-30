import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';

// ============================================================================
// Contract: « Alertes en temps réel » — common guide 11 + admin guide 11a.
// Real paths under /api/v1 (AdminOnly, platform rows only):
//   list       GET  /admin/alertes?nonLues=&categorie=&depuis=&page=&pageSize=
//   counters   GET  /admin/alertes/compteurs
//   read one   POST /admin/alertes/{id}/lue            → compteurs (idempotent, 404 ignored)
//   read all   POST /admin/alertes/lues  { categorie? } → { marquees, compteurs }
//   live       hub /hubs/notifications — events `alerte`, `compteurs`, `file`
//
// The server writes the French text, picks the tone and the icon, and builds
// the console path (`cible.chemin`): nothing is re-derived here. Codes, tones,
// icons and categories stay plain strings so a value the console does not
// know yet falls back to a neutral look instead of failing the parse.
// ============================================================================

/** The ten chips, in the guide's order (§1.2). Never changes. */
export const ALERTE_CATEGORIES = [
  'demandes',
  'commandes',
  'factures',
  'credits',
  'kyc',
  'equipe',
  'compte',
  'b2c',
  'avis',
  'autre',
] as const;
export type AlerteCategorie = (typeof ALERTE_CATEGORIES)[number];

/** action · alerte · succes · info (§1.3). */
export type AlerteTon = 'action' | 'alerte' | 'succes' | 'info';

export const alerteActeurSchema = z.object({
  /** client · prestataire · de9de9 · systeme */
  type: z.string().nullish(),
  /** Admin rows: the company that acted (for `systeme`, the company concerned). */
  companyId: z.string().nullish(),
  nom: z.string().nullish(),
});

export const alerteCibleSchema = z.object({
  app: z.string().nullish(),
  /** `aucun` = the row only informs. */
  ecran: z.string(),
  params: z.record(z.string(), z.unknown()).nullish(),
  /** Console path with its query, null exactly when `ecran` is `aucun`. */
  chemin: z.string().nullish(),
});

export const alerteSchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  categorie: z.string(),
  titre: z.string(),
  texte: z.string().nullish(),
  ton: z.string(),
  icone: z.string().nullish(),
  /** UTC ISO — sort key, relative time, catch-up cursor. */
  creeLe: z.string(),
  lu: z.boolean(),
  luLe: z.string().nullish(),
  /** Null on rows written before the codes existed. */
  acteur: alerteActeurSchema.nullish(),
  cible: alerteCibleSchema,
});
export type Alerte = z.infer<typeof alerteSchema>;

export const alertePageSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(alerteSchema),
});
export type AlertePage = z.infer<typeof alertePageSchema>;

/** The bell's numbers: REST answer, mark-read answers and the hub's `compteurs`. */
export const alerteCompteursSchema = z.object({
  app: z.string().nullish(),
  nonLues: z.number(),
  /** Always the ten keys (zeros included); the sum equals `nonLues`. */
  parCategorie: z.record(z.string(), z.number()).nullish(),
  /** Always null for admins. */
  autreCote: z.unknown().nullish(),
});
export type AlerteCompteurs = z.infer<typeof alerteCompteursSchema>;

/** POST /admin/alertes/lues */
export const alertesMarqueesSchema = z.object({
  marquees: z.number(),
  compteurs: alerteCompteursSchema,
});

/** Hub `file` — a console queue changed; refresh it silently (11a §5). */
export const fileSignalSchema = z.object({
  file: z.string(),
  code: z.string().nullish(),
  /** The alert's target id (a facture, a devis, a movement…). */
  cibleId: z.string().nullish(),
  /** The company concerned. */
  companyId: z.string().nullish(),
  creeLe: z.string().nullish(),
});
export type FileSignal = z.infer<typeof fileSignalSchema>;
