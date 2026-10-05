// Pure helpers of the contractuel demandes and the de9de9 pros: status pills,
// the abandon rate's colour, the pros' availability, photos, and what a
// failed call said. Labels the server sends are printed as sent.
import axios from 'axios';
import type { TKey } from '@/lib/i18n';
import { asRecord } from '@/lib/pick';
import type { CtrDemande, CtrPro } from '../schemas/contractuels';

export type Translate = (key: TKey) => string;

export const DEMANDES_PAGE_SIZE = 20;
export const PROS_PAGE_SIZE = 20;
export const REASON_MAX = 2000;

const CHIP = {
  amber: 'bg-[#FBF4E4] text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]',
  blue: 'bg-[#EAF2FD] text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]',
  green: 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]',
  grey: 'bg-[#EEF1F4] text-[#6B7280] dark:bg-[#9AA4B2]/15 dark:text-[#A6AEBD]',
  red: 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15',
} as const;

export const CHIP_GREEN = CHIP.green;
export const CHIP_AMBER = CHIP.amber;
export const CHIP_BLUE = CHIP.blue;
export const CHIP_GREY = CHIP.grey;

/** Guide 23 §6: Envoyée amber, En cours blue, Pourvue green, Clôturée and Annulée grey. */
const STATUT: Record<string, { labelKey: TKey; chip: string }> = {
  submitted: { labelKey: 'stStatutSubmitted', chip: CHIP.amber },
  in_progress: { labelKey: 'stStatutInProgress', chip: CHIP.blue },
  fulfilled: { labelKey: 'stStatutFulfilled', chip: CHIP.green },
  closed: { labelKey: 'stStatutClosed', chip: CHIP.grey },
  cancelled: { labelKey: 'stStatutCancelled', chip: CHIP.grey },
};

/** The server's label when it sends one, coloured by the status code. */
export function statutPill(d: Pick<CtrDemande, 'status' | 'statusLabel'>, t: Translate): { label: string; chip: string } {
  const meta = STATUT[d.status];
  return { label: d.statusLabel ?? (meta ? t(meta.labelKey) : d.status), chip: meta?.chip ?? CHIP.grey };
}

/** Still open to a placement: sent or being searched. */
export const isOuverte = (d: Pick<CtrDemande, 'status'>): boolean => d.status === 'submitted' || d.status === 'in_progress';

export function restantOf(d: Pick<CtrDemande, 'restant' | 'requestedCount' | 'fulfilledCount'>): number {
  return d.restant ?? Math.max(0, d.requestedCount - d.fulfilledCount);
}

/** Guide 23 §10: ≤ 10 % green, ≤ 20 % amber, above red. */
export function abandonClass(rate: number): string {
  if (rate <= 10) return 'text-[#2FA86A] dark:text-[#6FCF97]';
  if (rate <= 20) return 'text-[#B68A2E] dark:text-[#D9B36A]';
  return 'text-de9-red';
}

export function placeChezText(p: Pick<CtrPro, 'placeChez'>): string {
  const v = p.placeChez;
  return Array.isArray(v) ? v.join(', ') : (v ?? '');
}

const MEDIA_HOST = (import.meta.env.VITE_DE9DE9_MEDIA_URL ?? '').replace(/\/+$/, '');

/**
 * The pro's photo as the de9de9 app stores it: a full URL is used as is; a
 * path needs the de9de9 media host (VITE_DE9DE9_MEDIA_URL) — without it the
 * row shows the initials.
 */
export function photoSrc(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (/^(https?:)?\/\//i.test(photoUrl) || photoUrl.startsWith('data:')) return photoUrl;
  if (!MEDIA_HOST) return null;
  return `${MEDIA_HOST}/${photoUrl.replace(/^\/+/, '')}`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ===================== problems =====================

export interface CtrProblem {
  status?: number;
  code?: string;
  field?: string;
  /** No answer at all: a timeout or a cut connection. */
  sansReponse: boolean;
}

export function ctrProblem(err: unknown): CtrProblem {
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

/** The de9de9 app database does not answer: say so and offer « Réessayer », never a hard-coded list. */
export const isLegacyUnavailable = (err: unknown): boolean => ctrProblem(err).code === 'legacy_unavailable';
