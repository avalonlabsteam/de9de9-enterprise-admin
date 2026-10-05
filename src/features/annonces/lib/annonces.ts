// Pure helpers of the « Annonces » screens: the six tabs, the five tones,
// labels the server does not send (history status codes, roles), the date a
// tab shows, the path of an action, and what a failed call said.
import axios from 'axios';
import type { TKey } from '@/lib/i18n';
import { asRecord } from '@/lib/pick';
import { problemMessage } from '@/api/problem';
import { TAXO, slugify, type TaxoCat } from '@/features/prestataires/lib/taxonomy';
import type { AnnonceAction, AnnonceEntreprise, AnnonceLigne } from '../schemas/annonces';

export type Translate = (key: TKey) => string;

export const PAGE_SIZE = 20;
export const MOTIF_MAX = 500;

// ===================== the six tabs =====================

export const ONGLETS = ['a_valider', 'publiees', 'modifiees', 'suspendues', 'b2c_publication', 'toutes'] as const;
export type OngletCode = (typeof ONGLETS)[number];

/** A tab read from the URL; anything else is « no tab » (the server's default). */
export function ongletOf(value: string | null): OngletCode | null {
  const v = (value ?? '').trim().toLowerCase();
  return (ONGLETS as readonly string[]).includes(v) ? (v as OngletCode) : null;
}

/** Guide §2: « À valider » shows the submission, the publication tabs the first publication, the others the last write. */
export function dateOf(row: AnnonceLigne, onglet: string): string | null | undefined {
  if (onglet === 'a_valider') return row.soumiseLe;
  if (onglet === 'publiees' || onglet === 'b2c_publication') return row.publieeLe;
  return row.modifieeLe;
}

export const TYPES: ReadonlyArray<{ v: string; labelKey: TKey }> = [
  { v: 'b2b', labelKey: 'annTypeB2b' },
  { v: 'b2c', labelKey: 'annTypeB2c' },
];

// ===================== tones =====================

/** The company screens' five tones — not the four of « Accès ». Unknown → grey. */
const TON_CHIP: Record<string, string> = {
  neutre: 'bg-[#EEF1F4] text-[#6B7280] dark:bg-[#9AA4B2]/15 dark:text-[#A6AEBD]',
  attention: 'bg-[#FBF4E4] text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]',
  succes: 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]',
  info: 'bg-[#EAF2FD] text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]',
  danger: 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15',
};

export function tonChip(ton: string | null | undefined): string {
  return TON_CHIP[ton ?? ''] ?? (TON_CHIP['neutre'] as string);
}

// ===================== labels the server does not send =====================

/** The history carries status CODES only (`avant` → `apres`). */
const STATUT_KEY: Record<string, TKey> = {
  brouillon: 'annStatutBrouillon',
  en_revue: 'annStatutEnRevue',
  publiee: 'annStatutPubliee',
  en_pause: 'annStatutEnPause',
  refusee: 'annStatutRefusee',
  suspendue: 'annStatutSuspendue',
  archivee: 'annStatutArchivee',
};

export function statutLabel(code: string | null | undefined, t: Translate): string {
  if (!code) return '—';
  const key = STATUT_KEY[code];
  return key ? t(key) : code;
}

const ROLE_KEY: Record<string, TKey> = {
  PrestataireAdmin: 'annRolePrestataireAdmin',
  PrestataireStaff: 'annRolePrestataireStaff',
  EnterpriseClientAdmin: 'annRoleClientAdmin',
  EnterpriseClientStaff: 'annRoleClientStaff',
  De9de9Admin: 'annRoleDe9de9',
};

export function roleLabel(role: string | null | undefined, t: Translate): string | null {
  if (!role) return null;
  const key = ROLE_KEY[role];
  return key ? t(key) : role;
}

const KYC_KEY: Record<string, { key: TKey; ton: string }> = {
  pending: { key: 'commonKycEnAttente', ton: 'attention' },
  verified: { key: 'commonKycVerifie', ton: 'succes' },
  rejected: { key: 'commonKycRejete', ton: 'danger' },
};

export function kycPill(statut: string | null | undefined, t: Translate): { label: string; chip: string } | null {
  if (!statut) return null;
  const meta = KYC_KEY[statut];
  return meta ? { label: t(meta.key), chip: tonChip(meta.ton) } : { label: statut, chip: tonChip('neutre') };
}

/**
 * Guide §3: a published B2B annonce reaches the clients only while its
 * company is a KYC-verified prestataire with the B2B access and a listed card.
 * Each condition that fails, as the sentence to print.
 */
export function invisibiliteOf(e: AnnonceEntreprise): TKey[] {
  const out: TKey[] = [];
  if (e.estPrestataire === false) out.push('annInvisiblePasPrestataire');
  if (e.kycVerifie === false) out.push('annInvisibleKyc');
  if (e.b2bOuvert === false) out.push('annInvisibleB2b');
  if (e.ficheListee === false) out.push('annInvisibleDelistee');
  if (e.ficheListee == null) out.push('annInvisibleSansFiche');
  return out;
}

/** The catalogue category of a B2B annonce, for its 3D icon: codes are slugs of the French labels. */
export function taxoOf(code: string | null | undefined): TaxoCat | undefined {
  if (!code) return undefined;
  return TAXO.find((c) => slugify(c.fr) === code);
}

// ===================== actions =====================

/**
 * The path of an action: the server's `href` without its /api/v1 (the api
 * client adds /api), else built from the code — `marquer_revue` is
 * `marquer-revue`, the other four are their own segment.
 */
export function actionPath(annonceId: string, action: Pick<AnnonceAction, 'code' | 'href'>): string {
  if (action.href) return action.href.replace(/^(?:https?:\/\/[^/]+)?\/api\/v1/, '');
  return `/admin/annonces/${encodeURIComponent(annonceId)}/${action.code.replace(/_/g, '-')}`;
}

/** B2B actions that recompute the company's directory card. */
export const RECOMPUTES_CARD = new Set(['approuver', 'suspendre', 'retablir']);

// ===================== problems =====================

export interface AnnProblem {
  status?: number;
  code?: string;
  field?: string;
  /** No answer at all: a timeout or a cut connection. */
  sansReponse: boolean;
}

export function annProblem(err: unknown): AnnProblem {
  if (!axios.isAxiosError(err)) return { sansReponse: false };
  const body = asRecord(err.response?.data);
  const code = body?.['code'];
  const field = body?.['field'];
  return {
    status: err.response?.status,
    code: typeof code === 'string' ? code : undefined,
    field: typeof field === 'string' && field ? field : Object.keys(asRecord(body?.['errors']) ?? {})[0],
    sansReponse: !err.response,
  };
}

const CODE_KEY: Record<string, TKey> = {
  annonce_not_found: 'annErrIntrouvable',
  concurrency_conflict: 'annErrConflit',
  annonce_etat_invalide: 'annErrEtat',
  categorie_non_disponible: 'annErrCategorie',
  referentiel_indisponible: 'annErrReferentiel',
};

/**
 * The server's own sentence first (`detail`), then a localized line for the
 * code. `notFound`: what a 404 without a body means here — the router's answer
 * to an id that is not a GUID.
 */
export function annErrorMessage(err: unknown, t: Translate, notFound?: TKey): string {
  const { code } = annProblem(err);
  const key = code ? CODE_KEY[code] : undefined;
  return problemMessage(err, (status) => (key ? t(key) : status === 404 && notFound ? t(notFound) : undefined));
}
