// Pure helpers of the Handicap screens: the demande status and its pill, dates,
// phone links, shared class strings, and what a failed call said.
import axios from 'axios';
import type { TKey } from '@/lib/i18n';
import type { Lang } from '@/stores/langStore';
import { asRecord } from '@/lib/pick';
import { problemMessage } from '@/api/problem';
import type { HandicapItem } from '../schemas/handicap';

export type Translate = (key: TKey) => string;

export type HcTab = 'demandes' | 'candidats';

// ===================== class strings (the panel's Material 3 vocabulary) =====================

export const PILL = 'cursor-pointer rounded-full border px-[13px] py-[8px] text-[12px] font-bold';
export const PILL_ON = 'border-secondary-container bg-secondary-container text-on-secondary-container';
export const PILL_OFF = 'border-de9-line bg-card text-de9-slate';
export const BTN_PRIMARY =
  'cursor-pointer rounded-full bg-primary px-[18px] py-[11px] text-[12.5px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60';
export const BTN_OUTLINE =
  'cursor-pointer rounded-full border border-de9-line bg-card px-3.5 py-2 text-[12px] font-bold text-de9-slate disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_TONAL =
  'cursor-pointer rounded-full bg-secondary-container px-3.5 py-2 text-[12px] font-bold text-on-secondary-container disabled:cursor-not-allowed disabled:opacity-50';
export const INPUT_CLS =
  'w-full rounded-xs border border-outline bg-card px-3.5 py-2.5 text-[13.5px] text-de9-ink outline-none aria-invalid:border-de9-red';
export const SEARCH_CLS =
  'w-full flex-none rounded-xs border border-outline bg-card px-[15px] py-[10px] text-[12.5px] text-de9-ink outline-none sm:w-[280px]';
export const LINK_CLS = 'cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]';
export const HEAD_ROW =
  'gap-[10px] border-b border-de9-line bg-secondary px-5 py-[13px] text-[10px] font-bold uppercase tracking-[.03em] text-de9-gray';
export const BODY_ROW = 'items-center gap-[10px] border-b border-de9-line px-5 py-[13px]';

const CHIP = {
  amber: 'bg-[#FBF4E4] text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]',
  grey: 'bg-[#EEF1F4] text-[#6B7280] dark:bg-[#9AA4B2]/15 dark:text-[#A6AEBD]',
  blue: 'bg-[#EAF2FD] text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]',
  green: 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]',
} as const;

export const CHIP_GREEN = CHIP.green;
export const CHIP_BLUE = CHIP.blue;
export const CHIP_GREY = CHIP.grey;

// ===================== demande status =====================

type StatutSource = Pick<HandicapItem, 'statut' | 'isContacted' | 'placedCount' | 'positionsCount'>;

/**
 * The server's `statut`. An API older than the placements sends none: the
 * status is then read from the box and the counts, by the guide's own table.
 */
export function statutOf(row: StatutSource): string {
  if (row.statut) return row.statut;
  const placed = row.placedCount ?? 0;
  const positions = row.positionsCount ?? 0;
  if (placed > 0) return positions > 0 && placed >= positions ? 'pourvue' : 'en_cours';
  return row.isContacted ? 'contactee' : 'a_contacter';
}

/** Guide §2: amber à contacter, grey contactée, blue en cours, green pourvue. */
const STATUT: Record<string, { labelKey: TKey; chip: string }> = {
  a_contacter: { labelKey: 'hcStatutAContacter', chip: CHIP.amber },
  contactee: { labelKey: 'hcStatutContactee', chip: CHIP.grey },
  en_cours: { labelKey: 'hcStatutEnCours', chip: CHIP.blue },
  pourvue: { labelKey: 'hcStatutPourvue', chip: CHIP.green },
};

export function statutMeta(statut: string, t: Translate): { label: string; chip: string } {
  const meta = STATUT[statut];
  return meta ? { label: t(meta.labelKey), chip: meta.chip } : { label: statut, chip: CHIP.grey };
}

// ===================== dates, phones =====================

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const pad = (n: number): string => String(n).padStart(2, '0');

/** ISO 8601 → « 25/08/2026 ». */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** ISO 8601 → « Lundi 25/08/2026 » in the UI language. */
export function dayLabel(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${(lang === 'ar' ? DAYS_AR : DAYS_FR)[d.getDay()]} ${shortDate(iso)}`;
}

/** An Algerian number as typed (« 0770 03 04 05 ») → « +213770030405 ». */
function international(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  return '+213' + digits.replace(/^0/, '');
}

export const telHref = (phone: string): string => 'tel:' + international(phone);
export const waHref = (phone: string): string => 'https://wa.me/' + international(phone).slice(1);

// ===================== errors =====================

export interface HcProblem {
  status?: number;
  code?: string;
  /** The people a 404 / 409 names (`handicap_candidat_not_found`, `…_deja_place`). */
  candidatIds: string[];
  /** Server messages per field, keyed like the form (`fullName`, `positionsCount`…). */
  fieldErrors: Record<string, string>;
}

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

export function hcProblem(err: unknown): HcProblem {
  if (!axios.isAxiosError(err)) return { candidatIds: [], fieldErrors: {} };
  const body = asRecord(err.response?.data);
  const fieldErrors: Record<string, string> = {};
  // 400 validation_failed: `errors { field: [messages] }` (ASP.NET names fields in PascalCase).
  for (const [key, value] of Object.entries(asRecord(body?.['errors']) ?? {})) {
    const messages = (Array.isArray(value) ? value : [value]).filter((m): m is string => typeof m === 'string');
    const field = lowerFirst(key.split('.').pop() ?? key);
    if (field && messages.length) fieldErrors[field] = messages.join(' ');
  }
  // …or one `field` with the reason in `detail` (the placements route).
  const field = body?.['field'];
  const detail = body?.['detail'];
  if (typeof field === 'string' && field && typeof detail === 'string' && !fieldErrors[lowerFirst(field)]) {
    fieldErrors[lowerFirst(field)] = detail;
  }
  const ids = body?.['candidatIds'];
  return {
    status: err.response?.status,
    code: typeof body?.['code'] === 'string' ? body['code'] : undefined,
    candidatIds: Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [],
    fieldErrors,
  };
}

const ERROR_KEY: Record<string, TKey> = {
  not_found: 'hcErrDemandeIntrouvable',
  handicap_candidat_not_found: 'hcErrCandidatIntrouvable',
  handicap_candidat_deja_place: 'hcErrDejaPlace',
  handicap_demande_pourvue: 'hcErrPourvue',
  handicap_placement_not_found: 'hcErrPlacementIntrouvable',
  concurrency_conflict: 'hcErrConflit',
  validation_failed: 'hcErrValidation',
};

/** The server's own words first (its `detail` names the people), then a localized line for the code. */
export function hcErrorMessage(err: unknown, t: Translate): string {
  const { code } = hcProblem(err);
  const key = code ? ERROR_KEY[code] : undefined;
  return problemMessage(err, () => (key ? t(key) : undefined));
}

/** The row, the person or the placement is gone, or someone else changed it: what is on screen is stale. */
export function isStale(p: HcProblem): boolean {
  return p.status === 404 || p.status === 409;
}
