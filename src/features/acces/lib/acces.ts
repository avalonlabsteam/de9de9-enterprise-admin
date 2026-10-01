// Pure helpers of the « Accès » screens: the four actions and their wording,
// the counters, the filter values, pill colours per `ton`, the labels of the
// sync queue, and what a failed call said. No state is re-derived here — the
// B2C pill is the server's (`b2cEtat`), and a result line prints its `detail`.
import axios from 'axios';
import type { TKey } from '@/lib/i18n';
import { asRecord } from '@/lib/pick';
import { problemMessage } from '@/api/problem';
import type { AccesCompteurs, AccesResultat } from '../schemas/acces';

export type Translate = (key: TKey) => string;

/** The API's limits: a motif holds 1000 characters, a send 200 companies. */
export const MOTIF_MAX = 1000;
export const SELECTION_MAX = 200;
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZES: readonly number[] = [25, 50, 100, 200];

/** The list's columns — shared by the header and the rows: box · entreprise · KYC · B2C · B2B · menu. */
export const ACCES_GRID = 'grid-cols-[30px_1.8fr_0.7fr_1.6fr_1.15fr_36px]';

/** « 1 entreprise » / « 3 entreprises » — `{n}` is filled in. */
export function plural(n: number, one: TKey, many: TKey, t: Translate): string {
  return t(n === 1 ? one : many).replace('{n}', String(n));
}

export function initialsOf(nom: string): string {
  return nom
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ===================== the four actions =====================

export type AccesAction = 'b2c_accorder' | 'b2c_retirer' | 'b2b_activer' | 'b2b_desactiver';

export const ACTION_ORDER: readonly AccesAction[] = ['b2c_accorder', 'b2c_retirer', 'b2b_activer', 'b2b_desactiver'];

export interface ActionMeta {
  /** The button, in the selection bar and the row menu. */
  labelKey: TKey;
  /** One company: `{nom}`. Several: `{n}`. */
  titre1: TKey;
  titreN: TKey;
  texte1: TKey;
  texteN: TKey;
  confirmKey: TKey;
  /** The summary's title: `{n}` done out of `{m}`. */
  resultKey: TKey;
  /** Revoking or suspending: the motif is mandatory and sent to the company. */
  motifRequis: boolean;
  danger: boolean;
}

export const ACTIONS: Record<AccesAction, ActionMeta> = {
  b2c_accorder: {
    labelKey: 'accesAccorderB2c',
    titre1: 'accesAccorderTitre1',
    titreN: 'accesAccorderTitreN',
    texte1: 'accesAccorderTexte1',
    texteN: 'accesAccorderTexteN',
    confirmKey: 'accesAccorderConfirm',
    resultKey: 'accesResAccorde',
    motifRequis: false,
    danger: false,
  },
  b2c_retirer: {
    labelKey: 'accesRetirerB2c',
    titre1: 'accesRetirerTitre1',
    titreN: 'accesRetirerTitreN',
    texte1: 'accesRetirerTexte1',
    texteN: 'accesRetirerTexteN',
    confirmKey: 'accesRetirerConfirm',
    resultKey: 'accesResRetire',
    motifRequis: true,
    danger: true,
  },
  b2b_activer: {
    labelKey: 'accesRetablirB2b',
    titre1: 'accesRetablirTitre1',
    titreN: 'accesRetablirTitreN',
    texte1: 'accesRetablirTexte1',
    texteN: 'accesRetablirTexteN',
    confirmKey: 'accesRetablirConfirm',
    resultKey: 'accesResRetabli',
    motifRequis: false,
    danger: false,
  },
  b2b_desactiver: {
    labelKey: 'accesSuspendreB2b',
    titre1: 'accesSuspendreTitre1',
    titreN: 'accesSuspendreTitreN',
    texte1: 'accesSuspendreTexte',
    texteN: 'accesSuspendreTexte',
    confirmKey: 'accesSuspendreConfirm',
    resultKey: 'accesResSuspendu',
    motifRequis: true,
    danger: true,
  },
};

/** « Accorder B2C » skips these, company by company: the dialog can say so before sending. */
export function seraIgnoree(snapshot: { active: boolean; roles: readonly string[] }): boolean {
  return !snapshot.active || !snapshot.roles.includes('prestataire');
}

// ===================== results =====================

export const isFait = (r: AccesResultat): boolean => r.resultat === 'fait';

/** Nothing changed for the company and nothing is wrong with it: the same send can go again. */
const RAISONS_A_REESSAYER = new Set(['modification_concurrente', 'erreur_enregistrement']);

export const isRetryable = (r: AccesResultat): boolean => !isFait(r) && RAISONS_A_REESSAYER.has(r.raison ?? '');

/** What a grant or a revoke queued for the de9de9 app. */
const FILE_KEY: Record<string, TKey> = {
  provision: 'accesFileProvision',
  update: 'accesFileUpdate',
  approve: 'accesFileApprove',
  catalogue: 'accesFileCatalogue',
  suspend: 'accesFileSuspend',
};

export function fileLabel(code: string, t: Translate): string {
  const key = FILE_KEY[code];
  return key ? t(key) : code;
}

// ===================== counters =====================

export interface ChipDef {
  key: string;
  field: Exclude<keyof AccesCompteurs, 'pontActif'>;
  labelKey: TKey;
  /** The filter pair a click sets — a chip never shows a number its filter does not list. */
  b2c: string;
  b2b: string;
  /** green: the figure, always. red / amber: the whole card, once the figure is above zero. */
  tone?: 'green' | 'red' | 'amber';
}

export const CHIPS: readonly ChipDef[] = [
  { key: 'toutes', field: 'total', labelKey: 'accesChipToutes', b2c: '', b2b: '' },
  { key: 'accorde', field: 'b2cAccordes', labelKey: 'accesChipB2cAccorde', b2c: 'accorde', b2b: '' },
  { key: 'actif', field: 'b2cActifs', labelKey: 'accesChipActifs', b2c: 'actif', b2b: '', tone: 'green' },
  { key: 'en_attente', field: 'b2cEnAttente', labelKey: 'commonKycEnAttente', b2c: 'en_attente', b2b: '' },
  { key: 'suspendu', field: 'b2cSuspendus', labelKey: 'accesChipSuspendus', b2c: 'suspendu', b2b: '' },
  { key: 'echec', field: 'b2cEchecs', labelKey: 'accesChipEchecs', b2c: 'echec', b2b: '', tone: 'red' },
  { key: 'non_accorde', field: 'b2cNonAccordes', labelKey: 'accesChipB2cNonAccorde', b2c: 'non_accorde', b2b: '' },
  { key: 'b2b_suspendu', field: 'b2bDesactives', labelKey: 'accesChipB2bSuspendu', b2c: '', b2b: 'non', tone: 'amber' },
];

// ===================== filters =====================

export interface FilterOption {
  v: string;
  labelKey: TKey;
}

export const B2C_FILTERS: readonly FilterOption[] = [
  { v: 'accorde', labelKey: 'accesB2cAccorde' },
  { v: 'non_accorde', labelKey: 'accesB2cNonAccorde' },
  { v: 'actif', labelKey: 'accesB2cActif' },
  { v: 'en_attente', labelKey: 'commonKycEnAttente' },
  { v: 'suspendu', labelKey: 'accesSuspendu' },
  { v: 'echec', labelKey: 'accesEchec' },
];

export const B2B_FILTERS: readonly FilterOption[] = [
  { v: 'oui', labelKey: 'accesActif' },
  { v: 'non', labelKey: 'accesSuspendu' },
];

export const KYC_FILTERS: readonly FilterOption[] = [
  { v: 'pending', labelKey: 'commonKycEnAttente' },
  { v: 'verified', labelKey: 'commonKycVerifie' },
  { v: 'rejected', labelKey: 'commonKycRejete' },
];

export const COTE_FILTERS: readonly FilterOption[] = [
  { v: 'client', labelKey: 'roleClient' },
  { v: 'prestataire', labelKey: 'rolePrestataire' },
];

/**
 * A filter read from the URL. The server takes the values in any case and
 * answers 400 to one it does not know: such a value reads as « Tous » here.
 */
export function filterOf(value: string | null, options: readonly FilterOption[]): string {
  const v = (value ?? '').trim().toLowerCase();
  return options.some((o) => o.v === v) ? v : '';
}

export function pageSizeOf(value: string | null): number {
  const n = Number(value);
  return PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

export function roleLabel(role: string, t: Translate): string {
  if (role === 'client') return t('roleClient');
  if (role === 'prestataire') return t('rolePrestataire');
  return role;
}

// ===================== pills =====================

/** This page's four tones: alerte red, neutre grey, succes green, attente amber. */
const TON_PILL: Record<string, string> = {
  alerte: 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15',
  neutre: 'bg-[#ECEFF2] text-[#5A6270] dark:bg-[#9AA4B2]/15 dark:text-[#A6AEBD]',
  succes: 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]',
  attente: 'bg-[#FBF4E4] text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]',
};

/** An unknown `ton` is grey. */
export function tonPill(ton: string | null | undefined): string {
  return TON_PILL[ton ?? ''] ?? (TON_PILL['neutre'] as string);
}

const KYC_TON: Record<string, string> = { pending: 'attente', verified: 'succes', rejected: 'alerte' };

export function kycPill(statut: string | null | undefined): string {
  return tonPill(KYC_TON[statut ?? '']);
}

// ===================== the sync queue =====================

interface Labelled {
  labelKey: TKey;
  ton: string;
}

/** The company's de9de9 app account. */
const SYNC_STATUT: Record<string, Labelled> = {
  Pending: { labelKey: 'commonKycEnAttente', ton: 'attente' },
  Provisioned: { labelKey: 'syncStatutProvisioned', ton: 'attente' },
  Approved: { labelKey: 'syncStatutApproved', ton: 'succes' },
  Suspended: { labelKey: 'accesSuspendu', ton: 'neutre' },
  Failed: { labelKey: 'accesEchec', ton: 'alerte' },
};

/** One row of the queue. */
const ROW_STATUT: Record<string, Labelled> = {
  Pending: { labelKey: 'commonKycEnAttente', ton: 'attente' },
  Sent: { labelKey: 'syncRowSent', ton: 'succes' },
  Failed: { labelKey: 'accesEchec', ton: 'alerte' },
  Cancelled: { labelKey: 'syncRowCancelled', ton: 'neutre' },
  Superseded: { labelKey: 'syncRowSuperseded', ton: 'neutre' },
};

function labelled(map: Record<string, Labelled>, value: string, t: Translate): { label: string; pill: string } {
  const meta = map[value];
  return meta ? { label: t(meta.labelKey), pill: tonPill(meta.ton) } : { label: value, pill: tonPill('neutre') };
}

export const syncStatut = (status: string, t: Translate) => labelled(SYNC_STATUT, status, t);
export const rowStatut = (status: string, t: Translate) => labelled(ROW_STATUT, status, t);

const KIND_KEY: Record<string, TKey> = {
  ProvisionAccount: 'syncKindProvision',
  UpdateAccount: 'syncKindUpdate',
  ApproveAccount: 'syncKindApprove',
  SuspendAccount: 'syncKindSuspend',
  ResumeAccount: 'syncKindResume',
  SyncCatalogue: 'syncKindCatalogue',
};

export function kindLabel(kind: string, t: Translate): string {
  const key = KIND_KEY[kind];
  return key ? t(key) : kind;
}

// ===================== errors =====================

export interface AccesProblem {
  status?: number;
  code?: string;
  /** The parameter or body field a 400 `validation_failed` names. */
  field?: string;
  /** No answer at all — a timeout or a cut connection: the request may still have run. */
  sansReponse: boolean;
}

export function accesProblem(err: unknown): AccesProblem {
  if (!axios.isAxiosError(err)) return { sansReponse: false };
  const body = asRecord(err.response?.data);
  const code = body?.['code'];
  const field = body?.['field'];
  // The framework's own 400 (an id that is not a GUID) names its fields under `errors`.
  const firstErrorKey = Object.keys(asRecord(body?.['errors']) ?? {})[0];
  return {
    status: err.response?.status,
    code: typeof code === 'string' ? code : undefined,
    field: typeof field === 'string' && field ? field : firstErrorKey,
    sansReponse: !err.response,
  };
}

const CODE_KEY: Record<string, TKey> = {
  b2c_access_required: 'accesErrB2cRequis',
  concurrency_conflict: 'accesErrConflit',
  not_found: 'accesErrIntrouvable',
  entreprise_inactive: 'accesErrInactive',
  cote_prestataire_desactive: 'accesErrCotePrestataire',
  erreur_enregistrement: 'accesErrEnregistrement',
};

/** The server's own sentence first (`detail`), then a localized line for the code. */
export function accesErrorMessage(err: unknown, t: Translate): string {
  const { code } = accesProblem(err);
  const key = code ? CODE_KEY[code] : undefined;
  return problemMessage(err, () => (key ? t(key) : undefined));
}
