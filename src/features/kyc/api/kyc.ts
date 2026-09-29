import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import {
  kycAuditSchema,
  kycKpisSchema,
  kycQueueSchema,
  kycRevueSchema,
  kycVerdictAnswerSchema,
  type KycAuditEntry,
  type KycKpis,
  type KycQueue,
  type KycRevue,
  type KycVerdictAnswer,
} from '../schemas/kyc';

// Every key lives under ['kyc'] — the client fiche's mock KYC uses
// ['kyc', 'client:<name>'], which none of these collide with.
export const kycKeys = {
  list: (params: KycQueueParams) => ['kyc', 'list', params] as const,
  kpis: ['kyc', 'kpis'] as const,
  revue: (companyId: string) => ['kyc', 'revue', companyId] as const,
  audit: (companyId: string) => ['kyc', 'audit', companyId] as const,
};

const enc = encodeURIComponent;

// ===================== queue =====================

export type KycTab = 'aExaminer' | 'nonSoumis' | 'verifies' | 'aCorriger' | 'tous';

/** Tab → filters (guide §3 « The queue »). « À examiner » includes the rounds in progress. */
export const KYC_TAB_QUERY: Record<KycTab, { statut?: string; soumis?: boolean }> = {
  aExaminer: { statut: 'pending', soumis: true },
  nonSoumis: { statut: 'pending', soumis: false },
  verifies: { statut: 'verified' },
  aCorriger: { statut: 'rejected' },
  tous: {},
};

export interface KycQueueParams {
  tab: KycTab;
  /** Company name, RC, NIF, NIS or contact e-mail. */
  q?: string;
  page: number;
  pageSize: number;
}

/**
 * GET /kyc — the review queue, oldest submission first. Polled like the
 * counters: another admin's verdicts move rows between tabs.
 */
export function useKycQueue(params: KycQueueParams) {
  return useQuery({
    queryKey: kycKeys.list(params),
    queryFn: async (): Promise<KycQueue> => {
      const res = await apiClient.get('/kyc', {
        params: {
          ...KYC_TAB_QUERY[params.tab],
          q: params.q || undefined,
          page: params.page,
          pageSize: params.pageSize,
        },
      });
      return kycQueueSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

/**
 * GET /kyc/kpis — the cards and the sidebar badge. There is no live channel
 * in the app yet (the API pushes `AdminSignal` over SignalR), so the badge
 * polls; TanStack pauses the interval while the tab is hidden.
 */
export function useKycKpis() {
  return useQuery({
    queryKey: kycKeys.kpis,
    queryFn: async (): Promise<KycKpis> => {
      const res = await apiClient.get('/kyc/kpis');
      return kycKpisSchema.parse(res.data);
    },
    refetchInterval: 60_000,
  });
}

// ===================== review screen =====================

/** GET /companies/{companyId}/kyc/revue */
export function useKycRevue(companyId: string) {
  return useQuery({
    queryKey: kycKeys.revue(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<KycRevue> => {
      const res = await apiClient.get(`/companies/${enc(companyId)}/kyc/revue`);
      return kycRevueSchema.parse(res.data);
    },
    // A colleague may decide a piece while this tab sits in the background.
    refetchOnWindowFocus: true,
  });
}

/** GET /audit/Company/{companyId} — the dossier's history, newest first. */
export function useKycAudit(companyId: string) {
  return useQuery({
    queryKey: kycKeys.audit(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<KycAuditEntry[]> => {
      const res = await apiClient.get(`/audit/Company/${enc(companyId)}`);
      return kycAuditSchema.parse(res.data);
    },
  });
}

/**
 * Refresh what a KYC write moves: the queue, the counters, the history, and —
 * unless the caller already stored the fresh one — the review screen. The
 * verified badge (`kycVerifie`) lives in the prestataire payloads too.
 */
function refreshAfterKycWrite(companyId: string, revueIsFresh = false): void {
  void queryClient.invalidateQueries({ queryKey: ['kyc', 'list'] });
  void queryClient.invalidateQueries({ queryKey: kycKeys.kpis });
  void queryClient.invalidateQueries({ queryKey: kycKeys.audit(companyId) });
  if (!revueIsFresh) void queryClient.invalidateQueries({ queryKey: kycKeys.revue(companyId) });
  void queryClient.invalidateQueries({ queryKey: ['prestataires'] });
}

/** Reload the review screen after a 404/409/422 — what it shows is stale. */
export function reloadKycRevue(companyId: string): void {
  refreshAfterKycWrite(companyId);
}

// ===================== verdicts =====================

export type KycVerdict = 'valider' | 'refuser';

export interface KycVerdictInput {
  companyId: string;
  documentId: string;
  verdict: KycVerdict;
  /**
   * The document's `statut` as the screen showed it. Always sent: it turns a
   * colleague's verdict into a 409 instead of silently overriding it.
   */
  statutVu: string;
  /** Required on « Refuser » — written for the company. */
  motif?: string;
  /** Internal, never shown to the company. */
  note?: string;
}

/**
 * POST /companies/{companyId}/kyc/documents/{documentId}/valider | /refuser.
 * Answers the refreshed review screen, which replaces the cached one.
 */
export function useKycVerdict() {
  return useMutation({
    mutationFn: async ({
      companyId,
      documentId,
      verdict,
      statutVu,
      motif,
      note,
    }: KycVerdictInput): Promise<KycVerdictAnswer> => {
      const body = {
        ...(verdict === 'refuser' ? { motif } : {}),
        ...(note ? { note } : {}),
        statutVu,
      };
      const res = await apiClient.post(
        `/companies/${enc(companyId)}/kyc/documents/${enc(documentId)}/${verdict}`,
        body,
      );
      return kycVerdictAnswerSchema.parse(res.data);
    },
    onSuccess: (answer, { companyId }) => {
      queryClient.setQueryData(kycKeys.revue(companyId), answer.dossier);
      refreshAfterKycWrite(companyId, true);
    },
  });
}

// ===================== de9de9 acting for the company =====================

export interface KycUploadInput {
  companyId: string;
  kind: string;
  file: File;
}

/**
 * POST /companies/{companyId}/kyc/documents — multipart, each `files` part
 * paired by position with one `kinds` field. The new file becomes the current
 * version (the old one stays in the history); during a round it joins the
 * round. A validated document is never replaced (409, refuse it first).
 */
export function useKycUploadForCompany() {
  return useMutation({
    mutationFn: async ({ companyId, kind, file }: KycUploadInput): Promise<void> => {
      const fd = new FormData();
      fd.append('files', file);
      fd.append('kinds', kind);
      await apiClient.post(`/companies/${enc(companyId)}/kyc/documents`, fd, {
        // A 10 MB scan over a slow link outlives the 15s default.
        timeout: 120_000,
      });
    },
    onSuccess: (_, { companyId }) => refreshAfterKycWrite(companyId),
  });
}

/** POST /companies/{companyId}/kyc/soumettre — no body, same rules as the company's own submit. */
export function useKycSubmitForCompany() {
  return useMutation({
    mutationFn: async (companyId: string): Promise<void> => {
      await apiClient.post(`/companies/${enc(companyId)}/kyc/soumettre`);
    },
    onSuccess: (_, companyId) => refreshAfterKycWrite(companyId),
  });
}

/** The company field each piece's number is stored in. */
export const KYC_NUMBER_FIELD: Record<string, 'rc' | 'nif' | 'nis'> = {
  KycRc: 'rc',
  KycNif: 'nif',
  KycNis: 'nis',
};

export interface KycNumberInput {
  companyId: string;
  field: 'rc' | 'nif' | 'nis';
  value: string;
}

/**
 * Correct a typed number. The guide's recipe: read GET /companies/{companyId},
 * change the number, PUT the full body back. The raw body is sent back as
 * received, so fields this app does not model survive the round trip. de9de9
 * is never locked out of a number (the change is audited).
 */
export function useCorrectKycNumber() {
  return useMutation({
    mutationFn: async ({ companyId, field, value }: KycNumberInput): Promise<void> => {
      const url = `/companies/${enc(companyId)}`;
      const res = await apiClient.get(url);
      const company: unknown = res.data;
      if (!company || typeof company !== 'object' || Array.isArray(company)) {
        throw new Error('Unexpected company payload');
      }
      await apiClient.put(url, { ...(company as Record<string, unknown>), [field]: value });
    },
    onSuccess: (_, { companyId }) => refreshAfterKycWrite(companyId),
  });
}
