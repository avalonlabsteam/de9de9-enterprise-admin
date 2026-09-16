// Pure presentation helpers shared by the profile overlay's panels — ported from
// src/admin/logic.ts (profileReviews stars, buildKycVM meta, setKycStatus labels,
// logKyc stamps). The payload → view-model mapping itself lives in fromFiche.ts.
import type { TKey } from '@/lib/i18n';
import type { KycStatus } from '../../schemas/prestataire';

export type Translate = (key: TKey) => string;

/** fr-FR money formatting like the prototype ('15 000'). */
export const fmtMoney = (n: number): string => n.toLocaleString('fr-FR');

/** '★★★☆☆' star string (logic.ts profileReviews). */
export function starsOf(note: number): string {
  return '★★★★★'.slice(0, note) + '☆☆☆☆☆'.slice(0, 5 - note);
}

/** 'dd/mm/yyyy · hh:mm' stamp for local KYC journal entries (logic.ts logKyc). */
export function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() +
    ' · ' + p(d.getHours()) + ':' + p(d.getMinutes())
  );
}

/** Colored status chip — commande setup, invoice status, KYC state. */
export interface StatusBadge {
  label: string;
  bg: string;
  fg: string;
}

// ---------- KYC status meta (logic.ts buildKycVM) ----------
export interface KycMeta {
  label: string;
  bg: string;
  fg: string;
  icon: string;
}

const KYC_META: Record<KycStatus, [TKey, string, string, string]> = {
  verified: ['commonKycVerifie', '#E7F6EE', '#178A82', '✓'],
  pending: ['commonKycEnAttente', '#FBF4E4', '#B68A2E', '⏳'],
  rejected: ['commonKycRejete', '#FDECEC', '#E7464E', '✕'],
};

export function kycMeta(status: KycStatus, t: Translate): KycMeta {
  const [key, bg, fg, icon] = KYC_META[status];
  return { label: t(key), bg, fg, icon };
}

/** French status labels used in the KYC journal entries (logic.ts setKycStatus). */
export const KYC_LABEL_FR: Record<KycStatus, string> = {
  verified: 'Vérifié',
  pending: 'En attente',
  rejected: 'Rejeté',
};
