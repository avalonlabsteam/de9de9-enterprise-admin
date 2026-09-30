// Pure presentation helpers for the bell, the drawer and the toasts. The server
// has already written every word and computed every path; this only maps the
// `ton` and `icone` tokens to the console's palette and icon set, and prints
// `creeLe` as a relative time.
import {
  Accessibility,
  Banknote,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  FilePenLine,
  FileText,
  Receipt,
  ShieldCheck,
  Smartphone,
  Star,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { TKey } from '@/lib/i18n';
import type { Lang } from '@/stores/langStore';
import type { Alerte, AlerteCategorie } from '../schemas/alertes';

/** Guide 11 §1.4 — token → lucide icon; unknown tokens get the bell. */
const ICONS: Record<string, LucideIcon> = {
  demande: FileText,
  devis: FilePenLine,
  commande: Briefcase,
  visite: CalendarCheck,
  facture: Receipt,
  paiement: Banknote,
  portefeuille: Wallet,
  kyc: ShieldCheck,
  compte: Building2,
  equipe: Users,
  b2c: Smartphone,
  avis: Star,
  handicap: Accessibility,
  info: Bell,
};

export function iconOf(icone: string | null | undefined): LucideIcon {
  return (icone ? ICONS[icone] : undefined) ?? Bell;
}

export interface TonStyle {
  /** Icon tile on a light card (drawer rows). */
  tile: string;
  /** Icon tile on the dark toast. */
  toastTile: string;
  /** Inline-start accent of the toast. */
  edge: string;
}

/** Guide 11 §1.3 — `ton` is a meaning: action violet, alerte red, succes green, info blue. */
const TONS: Record<string, TonStyle> = {
  action: {
    tile: 'bg-[#F1ECFD] text-[#7C5CE0] dark:bg-[#7C5CE0]/15 dark:text-[#B3A0F0]',
    toastTile: 'bg-[#7C5CE0]/25 text-[#C9BAF7]',
    edge: 'border-s-[#7C5CE0]',
  },
  alerte: {
    tile: 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15',
    toastTile: 'bg-[#E7464E]/25 text-[#F59A9F]',
    edge: 'border-s-de9-red',
  },
  succes: {
    tile: 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]',
    toastTile: 'bg-[#2FA86A]/25 text-[#8EDDB1]',
    edge: 'border-s-[#2FA86A]',
  },
  info: {
    tile: 'bg-[#EAF2FD] text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]',
    toastTile: 'bg-[#2F7FD0]/25 text-[#9CC6F0]',
    edge: 'border-s-[#2F7FD0]',
  },
};

export function tonStyle(ton: string): TonStyle {
  return TONS[ton] ?? (TONS['info'] as TonStyle);
}

/** `action` and `alerte` stay 8 s, the rest 4 s (guide 11 §7.1). */
export function toastDuration(ton: string): number {
  return ton === 'action' || ton === 'alerte' ? 8_000 : 4_000;
}

/** Guide 11 §1.2 — the chip labels are fixed. */
export const CATEGORIE_LABEL: Record<AlerteCategorie, TKey> = {
  demandes: 'alertesCatDemandes',
  commandes: 'alertesCatCommandes',
  factures: 'alertesCatFactures',
  credits: 'alertesCatCredits',
  kyc: 'alertesCatKyc',
  equipe: 'alertesCatEquipe',
  compte: 'alertesCatCompte',
  b2c: 'alertesCatB2c',
  avis: 'alertesCatAvis',
  autre: 'alertesCatAutre',
};

/** « il y a 5 min », « hier »… — from `creeLe`, in the console's language. */
export function relativeTime(iso: string, lang: Lang, justNow: string, now = Date.now()): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '';
  const seconds = Math.round((now - at) / 1000);
  if (seconds < 45) return justNow;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return new Date(at).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Where a tap goes, or null when the row only informs (`aucun`) or belongs to another app. */
export function targetOf(a: Alerte): string | null {
  if (a.cible.ecran === 'aucun' || !a.cible.chemin) return null;
  if (a.cible.app && a.cible.app !== 'admin') return null;
  return a.cible.chemin;
}

/** The console already shows the alert's screen: same path, query aside (guide 11 §7.1). */
export function isSameScreen(a: Alerte, pathname: string): boolean {
  const target = targetOf(a);
  if (!target) return false;
  const path = target.split('?')[0] ?? '';
  return path.replace(/\/+$/, '') === pathname.replace(/\/+$/, '');
}
