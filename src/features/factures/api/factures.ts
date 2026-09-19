import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import { downloadFromApi, previewFromApi, type PreviewResult } from '@/api/documents';
import {
  factureConsoleResponseSchema,
  factureDetailSchema,
  factureFichiersSchema,
  factureFiltresSchema,
  factureKpisSchema,
  factureSchema,
  type Facture,
  type FactureActionCode,
  type FactureConsoleParams,
  type FactureConsoleResponse,
  type FactureDetail,
  type FactureFichier,
  type FactureFiltres,
  type FactureKpis,
} from '../schemas/facture';

export const facturesQueryKey = ['factures'] as const;

/** PascalCase query string for /factures/console (Q, Statut, Page, …). */
function consoleQuery(p: FactureConsoleParams): string {
  const qs = new URLSearchParams();
  const set = (key: string, v: string | number | undefined): void => {
    if (v !== undefined && v !== '') qs.set(key, String(v));
  };
  set('Q', p.q);
  set('Statut', p.statut);
  set('ClientId', p.clientId);
  set('PrestataireId', p.prestataireId);
  set('Du', p.du);
  set('Au', p.au);
  set('MontantMin', p.montantMin);
  set('MontantMax', p.montantMax);
  set('Tri', p.tri);
  set('Page', p.page);
  set('PageSize', p.pageSize);
  return qs.toString();
}

/**
 * GET /factures/console — the factures board, filtered/sorted/paginated
 * server-side. Lives under the ['factures'] prefix so facture actions'
 * invalidations refresh it automatically.
 */
export function useFacturesConsole(params: FactureConsoleParams) {
  return useQuery({
    queryKey: ['factures', 'console', params],
    queryFn: async (): Promise<FactureConsoleResponse> => {
      const res = await apiClient.get(`/factures/console?${consoleQuery(params)}`);
      return factureConsoleResponseSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/** All facture rows (derived server-side from deposited occurrence factures). */
export function useFactures() {
  return useQuery({
    queryKey: facturesQueryKey,
    queryFn: async (): Promise<Facture[]> => {
      const res = await apiClient.get('/factures');
      return factureSchema.array().parse(res.data);
    },
  });
}


// ===================== console: cards, tabs, « Voir », files, actions =====================

/** The list's filters minus what kpis/filtres ignore (tab, sort, paging). */
function filtersOnly(p: FactureConsoleParams): FactureConsoleParams {
  return {
    q: p.q,
    clientId: p.clientId,
    prestataireId: p.prestataireId,
    du: p.du,
    au: p.au,
    montantMin: p.montantMin,
    montantMax: p.montantMax,
  };
}

/** GET /factures/console/kpis — the 4 cards (credits + count) in one request. */
export function useFacturesKpis(params: FactureConsoleParams) {
  const filters = filtersOnly(params);
  return useQuery({
    queryKey: ['factures', 'kpis', filters],
    queryFn: async (): Promise<FactureKpis> => {
      const res = await apiClient.get(`/factures/console/kpis?${consoleQuery(filters)}`);
      return factureKpisSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/** GET /factures/console/filtres — tab counts, sort options, client/pro lists. */
export function useFacturesFiltres(params: FactureConsoleParams, limit = 100) {
  const filters = filtersOnly(params);
  return useQuery({
    queryKey: ['factures', 'filtres', filters, limit],
    queryFn: async (): Promise<FactureFiltres> => {
      const qs = consoleQuery(filters);
      const res = await apiClient.get(`/factures/console/filtres?${qs}${qs ? '&' : ''}limit=${limit}`);
      return factureFiltresSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/** GET /factures/console/{invoiceId} — everything the « Voir » window shows. */
export function useFactureDetail(invoiceId: string | null) {
  return useQuery({
    queryKey: ['factures', 'detail', invoiceId],
    enabled: !!invoiceId,
    queryFn: async (): Promise<FactureDetail> => {
      const res = await apiClient.get(`/factures/console/${encodeURIComponent(invoiceId ?? '')}`);
      return factureDetailSchema.parse(res.data);
    },
  });
}

/** GET /factures/console/{invoiceId}/fichiers. */
export function useFactureFichiers(invoiceId: string | null) {
  return useQuery({
    queryKey: ['factures', 'fichiers', invoiceId],
    enabled: !!invoiceId,
    queryFn: async (): Promise<FactureFichier[]> => {
      const res = await apiClient.get(`/factures/console/${encodeURIComponent(invoiceId ?? '')}/fichiers`);
      return factureFichiersSchema.parse(res.data);
    },
  });
}

/** Store the fresh detail the server answered with, then refresh everything it moves. */
function afterFactureWrite(detail: FactureDetail): void {
  queryClient.setQueryData(['factures', 'detail', detail.invoiceId], detail);
  void queryClient.invalidateQueries({ queryKey: ['factures'] });
  // Approving debits the client's wallet and settling pays the prestataire, so
  // the credits ledger moves; the worklist row changes status too.
  void queryClient.invalidateQueries({ queryKey: ['credits'] });
  void queryClient.invalidateQueries({ queryKey: ['commandes'] });
}

export interface FactureConsoleActionInput {
  invoiceId: string;
  code: Exclude<FactureActionCode, 'ajouter-fichiers'>;
  /** { note } approuver · { motif } contester · { resolution } resoudre-litige · { reference } regler */
  body?: Record<string, string>;
}

/**
 * POST /factures/console/{invoiceId}/{approuver|contester|resoudre-litige|regler}.
 * Replaces POST /commandes/{cmdId}/actions. No Idempotency-Key: a second call
 * on a transition already taken answers 409, so a double click cannot debit
 * twice. Answers the up-to-date « Voir » detail.
 */
export function useFactureConsoleAction() {
  return useMutation({
    mutationFn: async ({ invoiceId, code, body }: FactureConsoleActionInput): Promise<FactureDetail> => {
      const res = await apiClient.post(`/factures/console/${encodeURIComponent(invoiceId)}/${code}`, body ?? {});
      return factureDetailSchema.parse(res.data);
    },
    onSuccess: afterFactureWrite,
  });
}

/** POST /factures/console/{invoiceId}/fichiers — multipart `files`, 10 MB each. */
export function useAjouterFichiersFacture() {
  return useMutation({
    mutationFn: async ({ invoiceId, files }: { invoiceId: string; files: File[] }): Promise<FactureDetail> => {
      const fd = new FormData();
      for (const file of files) fd.append('files', file);
      const res = await apiClient.post(`/factures/console/${encodeURIComponent(invoiceId)}/fichiers`, fd, {
        timeout: 120_000,
      });
      return factureDetailSchema.parse(res.data);
    },
    onSuccess: afterFactureWrite,
  });
}

/** « La » facture, or one specific file when `documentId` is given. */
function factureFileUrl(invoiceId: string, documentId?: string): string {
  const base = `/factures/console/${encodeURIComponent(invoiceId)}`;
  return documentId ? `${base}/fichiers/${encodeURIComponent(documentId)}/telecharger` : `${base}/telecharger`;
}

/** Save a facture file. A missing file answers 404 `facture_sans_fichier`. */
export function downloadFactureFile(
  invoiceId: string,
  opts: { documentId?: string; fileName?: string; fallbackMessage?: string } = {},
): Promise<void> {
  return downloadFromApi(factureFileUrl(invoiceId, opts.documentId), {
    fallbackName: opts.fileName ?? 'facture.pdf',
    fallbackMessage: opts.fallbackMessage,
  });
}

/** Inline preview (`?inline=true`) — revoke the returned URL on close. */
export function previewFactureFile(
  invoiceId: string,
  opts: { documentId?: string; fallbackMessage?: string } = {},
): Promise<PreviewResult> {
  return previewFromApi(factureFileUrl(invoiceId, opts.documentId), { fallbackMessage: opts.fallbackMessage });
}
