// Pure presentation helpers shared by the profile overlay's panels — ported from
// src/admin/logic.ts (profileReviews stars, buildKycVM meta). The payload →
// view-model mapping itself lives in fromFiche.ts.
import { Check, Hourglass, X, type LucideIcon } from 'lucide-react';
import type { TKey } from '@/lib/i18n';
import type { KycStatus } from '../../schemas/prestataire';

export type Translate = (key: TKey) => string;

/** fr-FR money formatting like the prototype ('15 000'). */
export const fmtMoney = (n: number): string => n.toLocaleString('fr-FR');

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
  icon: LucideIcon;
}

const KYC_META: Record<KycStatus, [TKey, string, string, LucideIcon]> = {
  verified: ['commonKycVerifie', '#E7F6EE', '#178A82', Check],
  pending: ['commonKycEnAttente', '#FBF4E4', '#B68A2E', Hourglass],
  rejected: ['commonKycRejete', '#FDECEC', '#E7464E', X],
};

export function kycMeta(status: KycStatus, t: Translate): KycMeta {
  const [key, bg, fg, icon] = KYC_META[status];
  return { label: t(key), bg, fg, icon };
}
