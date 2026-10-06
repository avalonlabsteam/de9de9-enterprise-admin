// Pure presentation helpers for the KYC screens: colours per status, labels
// the server did not send, dates, sizes, error messages, and the history
// normalizer. No rule is re-derived here — what may be done comes from the
// server's flags (peutValider / peutRefuser / blocage).
import axios from 'axios';
import type { TKey } from '@/lib/i18n';
import { problemMessage } from '@/api/problem';
import { roleLabel } from '@/features/annonces/lib/annonces';
import type { KycAuditEntry, KycRevuePiece } from '../schemas/kyc';

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

/** Guide: grey `manquant`, blue `a_verifier` (« En attente »), green `valide`, red `refuse`. */
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
 * A dossier with a piece waiting is de9de9's to decide (amber); one with
 * nothing waiting is the company's to complete (grey).
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

// ===================== the verdict buttons =====================

export interface VerdictButton {
  show: boolean;
  enabled: boolean;
}

export interface PieceVerdicts {
  valider: VerdictButton;
  refuser: VerdictButton;
  /** The server's `blocage`, ready to print. */
  reason: string | undefined;
}

/**
 * « Valider » / « Refuser » on one piece. The server's flags decide — a filed
 * piece is judged at once: no submission to wait for, no number to type first
 * — and a verdict it blocks stays visible, disabled, under its reason (a
 * refusal the company was already told about).
 */
export function pieceVerdicts(piece: KycRevuePiece): PieceVerdicts {
  const blocked = !!piece.courante && !!piece.blocage;
  return {
    valider: { show: piece.peutValider || blocked, enabled: piece.peutValider },
    refuser: { show: piece.peutRefuser || blocked, enabled: piece.peutRefuser },
    reason: piece.blocage ? piece.blocage.message || piece.blocage.code : undefined,
  };
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
  /** 409 kyc_document_changed: the piece's number moved since the screen read it. */
  numeroChange?: boolean;
}

export function kycProblem(err: unknown): KycProblem {
  if (!axios.isAxiosError(err)) return {};
  const data = err.response?.data as { code?: unknown; numero?: unknown } | undefined;
  const code = typeof data?.code === 'string' ? data.code : undefined;
  return {
    status: err.response?.status,
    code,
    numeroChange: code === 'kyc_document_changed' && typeof data?.numero === 'string',
  };
}

/** Localized fallback per problem `code` (guide §2 and §3 error tables). */
const ERROR_KEY: Record<string, TKey> = {
  kyc_document_superseded: 'kycErrSuperseded',
  kyc_document_changed: 'kycErrChanged',
  kyc_document_already_refused: 'kycErrAlreadyRefused',
  concurrency_conflict: 'kycErrConflict',
  not_found: 'kycErrNotFound',
  kyc_document_approved_locked: 'kycErrApprovedLocked',
  kyc_under_review: 'kycErrUnderReview',
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
  const { status, code, numeroChange } = kycProblem(err);
  const key =
    (numeroChange ? 'kycErrNumeroChange' : code ? ERROR_KEY[code] : undefined) ??
    (status !== undefined ? STATUS_KEY[status] : undefined);
  return problemMessage(err, () => (key ? t(key) : undefined));
}

/** The screen is stale: a colleague decided, a number or a version changed, or the dossier moved. */
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

/** An object, or one carried as a JSON string (the audit's `metadataJson`, `afterState`). */
function objectOf(v: unknown): Rec | null {
  if (isRec(v)) return v;
  if (typeof v !== 'string' || !v.trimStart().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(v) as unknown;
    return isRec(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The entry with its specifics merged in. The audit carries them as JSON
 * strings: `metadataJson` says what the step was about (the documents filed,
 * the piece decided, its motif and note) and `afterState` what it left behind
 * (`resoumission`, the dossier's composed motif). What names the step wins.
 */
function withDetails(e: Rec): Rec {
  return {
    ...e,
    ...objectOf(e['afterState']),
    ...objectOf(pick(e, ['details', 'data', 'payload', 'metadata', 'changes', 'context'])),
    ...objectOf(e['metadataJson']),
  };
}

function nameOf(v: unknown): string | null {
  if (isRec(v)) return str(pick(v, ['nom', 'name', 'fullName', 'displayName', 'email']));
  return str(v);
}

/** The platform itself (a self-signup): nobody to name. */
const NO_USER = '00000000-0000-0000-0000-000000000000';

/** Who acted: a name when the audit has one, else the server's own sentence, else the role. */
function actorOf(entry: Rec, t: Translate): string | null {
  const named = nameOf(
    pick(entry, ['actorName', 'userName', 'performedByName', 'actorEmail', 'userEmail', 'actor', 'user', 'performedBy']),
  );
  if (named) return named;
  if (entry['actorUserId'] === NO_USER) return null;
  return str(entry['onBehalfSentence']) ?? roleLabel(str(entry['actorRole']), t);
}

/** The typed numbers a `company.updated` step changed, as « RC », « NIF », « NIS ». */
function numbersChanged(entry: Rec): string[] {
  const before = objectOf(entry['beforeState']);
  const after = objectOf(entry['afterState']);
  if (!before || !after) return [];
  return (['Rc', 'Nif', 'Nis'] as const).filter((k) => (before[k] ?? null) !== (after[k] ?? null)).map((k) => k.toUpperCase());
}

/** Company steps outside the KYC flow that every dossier's history starts with. */
const OTHER_STEP: Record<string, TKey> = {
  'company.created': 'kycEvtEntrepriseCreee',
  'company.self_signup': 'kycEvtInscription',
};

/** Piece kinds named by an entry, as « RC », « NIF », « NIS ». */
function kindsOf(d: Rec): string[] {
  const raw = pick(d, ['kinds', 'pieces', 'documents', 'document', 'kind']);
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
      case 'company.updated': {
        // Correcting a number is a plain company update: say which one moved.
        const numeros = numbersChanged(entry);
        title = numeros.length ? t('kycEvtNumeroModifie').replace('{n}', numeros.join(', ')) : t('kycEvtEntrepriseModifiee');
        break;
      }
      default: {
        // Company-wide audit: other steps (a corrected number…) keep their own wording.
        const known = OTHER_STEP[action];
        title =
          str(pick(entry, ['summary', 'description', 'message', 'libelle', 'label'])) ??
          (known ? t(known) : action || '—');
        code = known ? null : action || null;
      }
    }

    return {
      key: str(entry['id']) ?? `${action}-${i}`,
      title,
      tone,
      code: code && code !== title ? code : null,
      at: str(pick(entry, ['occurredAt', 'createdAt', 'at', 'timestamp', 'date'])),
      actor: actorOf(entry, t),
      motif,
      note,
    };
  });
}
