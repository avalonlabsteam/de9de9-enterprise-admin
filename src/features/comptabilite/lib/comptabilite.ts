// Pure presentation helpers for « Paiements en ligne »: Algiers calendar days
// for the periods, the status pills' wire values, badge colours per `ton`, and
// the problem codes the actions answer. Every label comes from the server.
import axios from 'axios';
import type { TKey } from '@/lib/i18n';
import { problemDetailsSchema } from '@/features/auth/schemas/auth';

// ===================== dates (Africa/Algiers, GMT+1 all year) =====================

const TZ = 'Africa/Algiers';

/** « 30/09/2026 14:07 » — ISO instants of the detail, in Algiers time. */
export function fmtAlger(iso: string | null | undefined, withTime = true): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

/** Today in Algiers as [year, month 1–12, day]. */
function algiersToday(): [number, number, number] {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
    .split('-')
    .map(Number);
  return [parts[0] ?? 1970, parts[1] ?? 1, parts[2] ?? 1];
}

const pad = (n: number): string => String(n).padStart(2, '0');
const day = (y: number, m: number, d: number): string => `${y}-${pad(m)}-${pad(d)}`;
/** Last day of month `m` (1–12): day 0 of the next month. */
const lastDay = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

export interface DayRange {
  du: string;
  au: string;
}

export type PeriodKey = 'mois' | 'mois_dernier' | 'annee' | 'perso';

/** « Ce mois » · « Mois dernier » · « Cette année » — Algiers days, both bounds inclusive. */
export const PERIOD_PRESETS: Record<Exclude<PeriodKey, 'perso'>, () => DayRange> = {
  mois: () => {
    const [y, m] = algiersToday();
    return { du: day(y, m, 1), au: day(y, m, lastDay(y, m)) };
  },
  mois_dernier: () => {
    const [y0, m0] = algiersToday();
    const [y, m] = m0 === 1 ? [y0 - 1, 12] : [y0, m0 - 1];
    return { du: day(y, m, 1), au: day(y, m, lastDay(y, m)) };
  },
  annee: () => {
    const [y] = algiersToday();
    return { du: day(y, 1, 1), au: day(y, 12, 31) };
  },
};

export const PERIODS: ReadonlyArray<{ key: PeriodKey; labelKey: TKey }> = [
  { key: 'mois', labelKey: 'comptaPeriodeMois' },
  { key: 'mois_dernier', labelKey: 'comptaPeriodeMoisDernier' },
  { key: 'annee', labelKey: 'comptaPeriodeAnnee' },
  { key: 'perso', labelKey: 'comptaPeriodePerso' },
];

const isPreset = (k: string | null): k is Exclude<PeriodKey, 'perso'> =>
  k === 'mois' || k === 'mois_dernier' || k === 'annee';

/**
 * The period on screen, from the URL: `?periode=` names a preset; otherwise
 * `?du=&au=` (an alert or the credits drawer may deep-link with those) is
 * matched against the presets, else it is a custom period. Nothing = this month.
 */
export function periodOf(sp: URLSearchParams): { key: PeriodKey } & DayRange {
  const p = sp.get('periode');
  if (isPreset(p)) return { key: p, ...PERIOD_PRESETS[p]() };
  const du = sp.get('du') ?? '';
  const au = sp.get('au') ?? '';
  if (p !== 'perso' && (du || au)) {
    for (const key of ['mois', 'mois_dernier', 'annee'] as const) {
      const r = PERIOD_PRESETS[key]();
      if (r.du === du && r.au === au) return { key, ...r };
    }
  }
  if (p === 'perso' || du || au) return { key: 'perso', du, au };
  return { key: 'mois', ...PERIOD_PRESETS.mois() };
}

// ===================== status pills =====================

export type StatutPill = 'tous' | 'approuve' | 'en_attente' | 'a_verifier' | 'refuse' | 'expire' | 'echec_initiation';

/** Pill → `Statut` wire values; « En attente » covers the initiation step too. */
export const STATUT_PILLS: ReadonlyArray<{ key: StatutPill; labelKey: TKey; wire?: string }> = [
  { key: 'tous', labelKey: 'tous' },
  { key: 'approuve', labelKey: 'comptaStatutPayes', wire: 'approuve' },
  { key: 'en_attente', labelKey: 'comptaCarteEnAttente', wire: 'en_attente,initiation' },
  { key: 'a_verifier', labelKey: 'comptaCarteAVerifier', wire: 'a_verifier' },
  { key: 'refuse', labelKey: 'comptaCarteRefuses', wire: 'refuse' },
  { key: 'expire', labelKey: 'comptaCarteExpires', wire: 'expire' },
  { key: 'echec_initiation', labelKey: 'comptaCarteEchecs', wire: 'echec_initiation' },
];

export function statutPillOf(value: string | null): StatutPill {
  return STATUT_PILLS.find((p) => p.key === value)?.key ?? 'tous';
}

export const TRIS: ReadonlyArray<{ key: string; labelKey: TKey }> = [
  { key: 'date', labelKey: 'comptaTriDate' },
  { key: 'montant', labelKey: 'comptaTriMontant' },
  { key: 'entreprise', labelKey: 'comptaTriEntreprise' },
];

// ===================== badges =====================

/** `ton` → badge: succes green, attention amber, danger red, info blue, neutre grey. */
const TON_BADGE: Record<string, string> = {
  succes: 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]',
  attention: 'bg-[#FBF4E4] text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]',
  danger: 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15',
  info: 'bg-[#EAF2FD] text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]',
  neutre: 'bg-[#EEF1F4] text-[#6B7280] dark:bg-[#9AA4B2]/15 dark:text-[#A6AEBD]',
};

export function tonBadge(ton: string | null | undefined): string {
  return TON_BADGE[ton ?? ''] ?? (TON_BADGE['neutre'] as string);
}

/** A possible orphan order is red; every other flag is a review reason (amber). */
export function isOrphanFlag(drapeau: string | null | undefined): boolean {
  return !!drapeau && drapeau.startsWith('commande_orpheline_possible');
}

export function roleLabel(role: string | null | undefined, t: (key: TKey) => string): string | null {
  if (!role) return null;
  if (role === 'EnterpriseClientAdmin') return t('comptaRoleAdmin');
  if (role === 'EnterpriseClientStaff') return t('comptaRoleStaff');
  return role;
}

// ===================== problems =====================

export interface ComptaProblem {
  status?: number;
  code?: string;
  field?: string;
}

/** Status, `code` and the field of a validation error, from an axios error or one `fetchBlob` wrapped. */
export function comptaProblem(err: unknown): ComptaProblem {
  const source = err instanceof Error && axios.isAxiosError(err.cause) ? err.cause : err;
  if (!axios.isAxiosError(source)) return {};
  const parsed = problemDetailsSchema.safeParse(source.response?.data);
  const body = parsed.success ? parsed.data : undefined;
  const field = typeof body?.['field'] === 'string' ? body['field'] : undefined;
  const errors = body?.['errors'];
  const firstErrorKey =
    errors && typeof errors === 'object' && !Array.isArray(errors) ? Object.keys(errors)[0] : undefined;
  return {
    status: source.response?.status,
    code: typeof body?.code === 'string' ? body.code : undefined,
    field: field ?? firstErrorKey,
  };
}
