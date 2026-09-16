// Presentation maps for worklist rows, shared by the worklist page and the
// console's read-only fallback view. Status styling is keyed by the S/V code
// the API sends in `currentStatus.code` ('S1', 'V5·C', …) — the mock twin emits
// the same codes, so both render identically; unknown codes stay neutral.
import type { TKey } from '@/lib/i18n';
import type { Ball } from '../schemas/commande';

export type Tr = (key: TKey) => string;

export interface BadgeStyle {
  bg: string;
  fg: string;
}

/** Unknown statuses from the server fall back to neutral grey. */
export const NEUTRAL_BADGE: BadgeStyle = { bg: '#F1F4F6', fg: '#9AA4B2' };

const RED: BadgeStyle = { bg: '#FDECEC', fg: '#E7464E' };
const ORANGE: BadgeStyle = { bg: '#FEF3E2', fg: '#D9871F' };
const BLUE: BadgeStyle = { bg: '#EAF2FD', fg: '#2F7FD0' };
const GREEN: BadgeStyle = { bg: '#E7F6EE', fg: '#2FA86A' };
const PURPLE: BadgeStyle = { bg: '#F4EFFB', fg: '#7C57C7' };
const AMBER: BadgeStyle = { bg: '#FBF4E4', fg: '#B68A2E' };

/**
 * Badge color per S/V code. The admin dashboard spells two codes differently
 * ('V5.C', 'VX') from the worklist ('V5·C', 'V✕'), so both spellings are keyed.
 */
const STATUS_BADGE: Record<string, BadgeStyle> = {
  S1: RED, // à rappeler
  S2: ORANGE, // devis à demander
  S3: ORANGE, // en attente des devis
  S4: BLUE, // devis transmis, attente du choix client
  V0: AMBER, // à planifier
  V1: BLUE, // à confirmer
  V2: GREEN, // confirmée
  V3: GREEN, // ouvrier affecté
  V4: PURPLE, // terminée, sans facture
  V5: PURPLE, // facture déposée
  'V5·C': RED, // contestée
  'V5.C': RED,
  V6: GREEN, // approuvée
  V7: GREEN, // réglée
  'V✕': NEUTRAL_BADGE, // annulée
  VX: NEUTRAL_BADGE,
};

export function statusBadge(code: string): BadgeStyle {
  return STATUS_BADGE[code] ?? NEUTRAL_BADGE;
}

export const BALL_COLOR: Record<Ball, string> = {
  client: '#2F7FD0',
  pro: '#2FA86A',
  de9: '#E7464E',
  done: '#9AA4B2',
};

export function ballLabel(ball: Ball, t: Tr): string {
  if (ball === 'client') return t('roleClient');
  if (ball === 'pro') return t('rolePrestataire');
  if (ball === 'de9') return 'de9de9';
  return t('commonTermine');
}

const DAY_KEYS: TKey[] = [
  'commonJourDimanche',
  'commonJourLundi',
  'commonJourMardi',
  'commonJourMercredi',
  'commonJourJeudi',
  'commonJourVendredi',
  'commonJourSamedi',
];

/**
 * Minutes → days / hours / minutes, zero parts dropped: 45 → « 45 min »,
 * 312 → « 5 h 12 min », 3672 → « 2 j 13 h 12 min ». Signless — the caller's
 * label says whether it's overdue or remaining.
 */
export function formatDuration(totalMinutes: number, t: Tr): string {
  const m = Math.round(Math.abs(totalMinutes));
  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  const mins = m % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${t('dureeJours')}`);
  if (hours) parts.push(`${hours} ${t('dureeHeures')}`);
  if (mins || parts.length === 0) parts.push(`${mins} ${t('dureeMinutes')}`);
  return parts.join(' ');
}

/** ISO datetime → « Lundi 15/09/2026 » (raw value if unparseable). */
export function visitLabel(iso: string, t: Tr): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  const dayKey = DAY_KEYS[d.getDay()];
  const day = dayKey ? t(dayKey) : '';
  return `${day} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`.trim();
}
