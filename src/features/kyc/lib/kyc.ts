// Pure presentation helpers for the KYC screens: colours per status, labels
// the server did not send, dates, sizes, error messages, and the history
// normalizer. No rule is re-derived here — what may be done comes from the
// server's flags (peutValider / peutRefuser / blocage).
import axios from 'axios';
import type { TKey } from '@/lib/i18n';
import { problemMessage } from '@/api/problem';
import type { KycAuditEntry } from '../schemas/kyc';

export type Translate = (key: TKey) => string;

// ===================== colours =====================

export type ToneName = 'grey' | 'blue' | 'green' | 'red' | 'amber';

export interface Tone {
  /** Pill background + text. */
  chip: string;
  dot: string;
  /** Progress-bar segment. */
  bar: string;
  /** Inline-start accent of a card. */
  edge: string;
}

export const TONES: Record<ToneName, Tone> = {
  grey: {
    chip: 'bg-[#EEF1F4] text-[#6B7280] dark:bg-[#9AA4B2]/15 dark:text-[#A6AEBD]',
    dot: 'bg-[#9AA4B2]',
    bar: 'bg-[#C7CFD7] dark:bg-[#3A4356]',
    edge: 'border-s-[#C7CFD7] dark:border-s-[#3A4356]',
  },
  blue: {
    chip: 'bg-[#EAF2FD] text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]',
    dot: 'bg-[#2F7FD0]',
    bar: 'bg-[#2F7FD0]',
    edge: 'border-s-[#2F7FD0]',
  },
  green: {
    chip: 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]',
    dot: 'bg-[#2FA86A]',
    bar: 'bg-[#2FA86A]',
    edge: 'border-s-[#2FA86A]',
  },
  red: {
    chip: 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15',
    dot: 'bg-de9-red',
    bar: 'bg-de9-red',
    edge: 'border-s-de9-red',
  },
  amber: {
    chip: 'bg-[#FBF4E4] text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]',
    dot: 'bg-[#E6A53A]',
    bar: 'bg-[#E6A53A]',
    edge: 'border-s-[#E6A53A]',
  },
};

/** Guide: grey `manquant`, blue `a_verifier`, green `valide`, red `refuse`. */
const DOC_TONE: Record<string, ToneName> = {
  manquant: 'grey',
  a_verifier: 'blue',
  valide: 'green',
  refuse: 'red',
};

export function docTone(statut: string): Tone {
  return TONES[DOC_TONE[statut] ?? 'grey'];
}

/**
 * A submitted dossier waits on de9de9 (amber); one still being filed waits on
 * the company (grey).
 */
export function dossierToneName(statut: string, enRevue: boolean | null | undefined): ToneName {
  if (statut === 'verified') return 'green';
  if (statut === 'rejected') return 'red';
  return enRevue ? 'amber' : 'grey';
}

// ===================== labels the server did not send =====================

const DOC_LABEL: Record<string, TKey> = {
  manquant: 'kycDocManquant',
  a_verifier: 'kycDocAVerifier',
  valide: 'kycDocValide',
  refuse: 'kycDocRefuse',
};

/** The server's `statutLabel` first — it comes ready to print. */
export function docStatutLabel(statut: string, label: string | null | undefined, t: Translate): string {
  if (label) return label;
  const key = DOC_LABEL[statut];
  return key ? t(key) : statut;
}

const DOSSIER_LABEL: Record<string, TKey> = {
  pending: 'commonKycEnAttente',
  verified: 'commonKycVerifie',
  rejected: 'commonKycRejete',
};

export function dossierStatutLabel(statut: string, label: string | null | undefined, t: Translate): string {
  if (label) return label;
  const key = DOSSIER_LABEL[statut];
  return key ? t(key) : statut;
}

const KIND_SHORT: Record<string, string> = { KycRc: 'RC', KycNif: 'NIF', KycNis: 'NIS' };

/** « RC » · « NIF » · « NIS » — the same abbreviations in both languages. */
export function kindShort(kind: string, labelCourt?: string | null): string {
  return labelCourt || KIND_SHORT[kind] || kind;
}

const KIND_LONG: Record<string, TKey> = { KycRc: 'kycKindRc', KycNif: 'kycKindNif', KycNis: 'kycKindNis' };

export function kindLong(kind: string, kindLabel: string | null | undefined, t: Translate): string {
  if (kindLabel) return kindLabel;
  const key = KIND_LONG[kind];
  return key ? t(key) : kind;
}

// ===================== dates & sizes =====================

const DAY_KEYS: readonly TKey[] = [
  'commonJourDimanche',
  'commonJourLundi',
  'commonJourMardi',
  'commonJourMercredi',
  'commonJourJeudi',
  'commonJourVendredi',
  'commonJourSamedi',
];

const pad = (n: number): string => String(n).padStart(2, '0');

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO 8601 → « Lundi 28/09/2026 » in the UI language. */
export function fmtDate(iso: string | null | undefined, t: Translate): string {
  const d = parse(iso);
  if (!d) return iso || '—';
  const day = DAY_KEYS[d.getDay()];
  return `${day ? t(day) + ' ' : ''}${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** ISO 8601 → « Lundi 28/09/2026 · 09:12 ». */
export function fmtDateTime(iso: string | null | undefined, t: Translate): string {
  const d = parse(iso);
  if (!d) return iso || '—';
  return `${fmtDate(iso, t)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** How long a dossier has waited: « 45 min », « 5 h », « 3 j ». Null when unknown. */
export function waitLabel(iso: string | null | undefined, t: Translate): string | null {
  const d = parse(iso);
  if (!d) return null;
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutes < 0) return null;
  if (minutes < 60) return `${minutes} ${t('dureeMinutes')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${t('dureeHeures')}`;
  return `${Math.floor(hours / 24)} ${t('dureeJours')}`;
}

export function fmtSize(bytes: number | null | undefined, t: Translate): string | null {
  if (bytes == null || bytes < 0) return null;
  if (bytes < 1024 * 1024) {
    return t('kycTailleKo').replace('{n}', String(Math.max(1, Math.round(bytes / 1024))));
  }
  const mo = (bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return t('kycTailleMo').replace('{n}', mo);
}

// ===================== errors =====================

export interface KycProblem {
  status?: number;
  code?: string;
}

export function kycProblem(err: unknown): KycProblem {
  if (!axios.isAxiosError(err)) return {};
  const data = err.response?.data as { code?: unknown } | undefined;
  return {
    status: err.response?.status,
    code: typeof data?.code === 'string' ? data.code : undefined,
  };
}

/** Localized fallback per problem `code` (guide §2 and §3 error tables). */
const ERROR_KEY: Record<string, TKey> = {
  kyc_document_superseded: 'kycErrSuperseded',
  kyc_document_changed: 'kycErrChanged',
  kyc_document_not_submitted: 'kycErrNotSubmitted',
  kyc_document_already_refused: 'kycErrAlreadyRefused',
  concurrency_conflict: 'kycErrConflict',
  kyc_number_missing: 'kycErrNumberMissing',
  not_found: 'kycErrNotFound',
  kyc_document_approved_locked: 'kycErrApprovedLocked',
  kyc_under_review: 'kycErrUnderReview',
  kyc_incomplete: 'kycErrIncomplete',
  kyc_pieces_to_replace: 'kycErrPiecesToReplace',
  kyc_identifiers_missing: 'kycErrIdentifiersMissing',
  kyc_already_verified: 'kycErrAlreadyVerified',
  empty_file: 'kycErrEmptyFile',
};

const STATUS_KEY: Record<number, TKey> = {
  404: 'kycErrNotFound',
  413: 'kycFichierTropGros',
  415: 'kycFichierType',
};

/**
 * The server's own words first (its `detail` names the piece), then the
 * validation messages, then a localized message for the code or status.
 */
export function kycErrorMessage(err: unknown, t: Translate): string {
  const { status, code } = kycProblem(err);
  const key = (code ? ERROR_KEY[code] : undefined) ?? (status !== undefined ? STATUS_KEY[status] : undefined);
  return problemMessage(err, () => (key ? t(key) : undefined));
}

/** The screen is stale: a colleague decided, a new version arrived, or the dossier moved. */
export function isStaleProblem(p: KycProblem): boolean {
  return p.status === 404 || p.status === 409 || p.status === 422;
}

// ===================== history (GET /audit/Company/{companyId}) =====================

export interface KycAuditEvent {
  key: string;
  title: string;
  tone: ToneName;
  /** The raw action when it is not one of the KYC steps the guide lists. */
  code: string | null;
  at: string | null;
  actor: string | null;
  /** « Motif envoyé » box. */
  motif: string | null;
  /** Internal note. */
  note: string | null;
}

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

function str(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() ? v : null;
  if (typeof v === 'number') return String(v);
  return null;
}

function pick(o: Rec, keys: readonly string[]): unknown {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

/** The entry with its specifics merged in, whether flat or nested (object or JSON string). */
function withDetails(e: Rec): Rec {
  let nested = pick(e, ['details', 'data', 'payload', 'metadata', 'changes', 'context']);
  if (typeof nested === 'string') {
    try {
      nested = JSON.parse(nested) as unknown;
    } catch {
      nested = undefined;
    }
  }
  return isRec(nested) ? { ...e, ...nested } : e;
}

function nameOf(v: unknown): string | null {
  if (isRec(v)) return str(pick(v, ['nom', 'name', 'fullName', 'displayName', 'email']));
  return str(v);
}

/** Piece kinds named by an entry, as « RC », « NIF », « NIS ». */
function kindsOf(d: Rec): string[] {
  const raw = pick(d, ['kinds', 'pieces', 'documents', 'kind']);
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return list
    .map((x) => (isRec(x) ? str(x['kind']) : str(x)))
    .filter((k): k is string => !!k)
    .map((k) => kindShort(k));
}

export function auditEvents(entries: KycAuditEntry[], t: Translate): KycAuditEvent[] {
  return entries.map((entry, i) => {
    const d = withDetails(entry);
    const action = str(pick(entry, ['action', 'type', 'event', 'eventType'])) ?? '';
    const kinds = kindsOf(d);
    const kindList = kinds.join(', ');
    const motif = str(d['motif']);
    const note = str(pick(d, ['note', 'noteInterne']));
    let title: string;
    let tone: ToneName = 'grey';
    let code: string | null = null;

    switch (action) {
      case 'company.kyc.documents.uploaded': {
        const remplace = Array.isArray(d['remplace']) ? d['remplace'] : [];
        const renvoyes = remplace
          .filter((r): r is Rec => isRec(r) && r['ancienStatut'] === 'refuse')
          .map((r) => kindShort(str(r['kind']) ?? ''))
          .filter(Boolean);
        title = renvoyes.length
          ? t(renvoyes.length > 1 ? 'kycEvtRenvoyes' : 'kycEvtRenvoye').replace('{n}', renvoyes.join(', '))
          : kindList
            ? t('kycEvtDeposes').replace('{n}', kindList)
            : t('kycEvtDeposesSans');
        tone = 'blue';
        break;
      }
      case 'company.kyc.submitted':
        title = d['resoumission'] === true ? t('kycEvtRenvoyesDossier') : t('kycEvtSoumis');
        tone = 'amber';
        break;
      case 'company.kyc.document.approved':
        title = t('kycEvtValide').replace('{n}', kindList || t('kycDocument'));
        tone = 'green';
        break;
      case 'company.kyc.document.refused':
        title = t('kycEvtRefuse').replace('{n}', kindList || t('kycDocument'));
        tone = 'red';
        break;
      case 'company.kyc.verified':
        title = t('kycEvtVerifie');
        tone = 'green';
        break;
      case 'company.kyc.rejected':
        title = t('kycEvtACorriger');
        tone = 'red';
        break;
      case 'company.kyc.pending':
        title = t('kycEvtRemisEnDepot');
        break;
      default:
        // Company-wide audit: other steps (a corrected number…) keep their own wording.
        title = str(pick(entry, ['summary', 'description', 'message', 'libelle', 'label'])) ?? (action || '—');
        code = action || null;
    }

    return {
      key: str(entry['id']) ?? `${action}-${i}`,
      title,
      tone,
      code: code && code !== title ? code : null,
      at: str(pick(entry, ['occurredAt', 'createdAt', 'at', 'timestamp', 'date'])),
      actor: nameOf(
        pick(entry, [
          'actorName',
          'userName',
          'performedByName',
          'actorEmail',
          'userEmail',
          'actor',
          'user',
          'performedBy',
        ]),
      ),
      motif,
      note,
    };
  });
}
