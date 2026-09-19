import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import { downloadFromApi } from '@/api/documents';
import {
  creditClientSchema,
  creditClientsResponseSchema,
  creditMovementSchema,
  creditsFiltresSchema,
  creditsKpisSchema,
  creditsLedgerResponseSchema,
  type CreditClient,
  type CreditClientsResponse,
  type CreditMovement,
  type CreditsFiltres,
  type CreditsKpis,
  type CreditsKpisParams,
  type CreditsLedgerParams,
  type CreditsLedgerResponse,
  type RechargeSubmitInput,
} from '../schemas/credit';

export const creditsQueryKey = ['credits'] as const;

/** PascalCase query string for GET /credits (Q, Type, Page, …). */
function ledgerQuery(p: CreditsLedgerParams): string {
  const qs = new URLSearchParams();
  const set = (key: string, v: string | number | undefined): void => {
    if (v !== undefined && v !== '') qs.set(key, String(v));
  };
  set('Q', p.q);
  set('Type', p.type);
  set('ClientId', p.clientId);
  set('Du', p.du);
  set('Au', p.au);
  set('Tri', p.tri);
  set('Page', p.page);
  set('PageSize', p.pageSize);
  return qs.toString();
}

/**
 * GET /credits — the ledger (recharges, débits facture, versements pro),
 * filtered/paginated server-side. Under the ['credits'] prefix so a created
 * recharge invalidates it.
 */
export function useCreditsLedger(params: CreditsLedgerParams) {
  return useQuery({
    queryKey: ['credits', 'ledger', params],
    queryFn: async (): Promise<CreditsLedgerResponse> => {
      const res = await apiClient.get(`/credits?${ledgerQuery(params)}`);
      return creditsLedgerResponseSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

// ===================== cards, tabs, detail, recharge, pieces, export =====================

/** The ledger's filters minus what kpis/filtres/export ignore. */
function withoutPaging(p: CreditsLedgerParams): CreditsLedgerParams {
  return { q: p.q, type: p.type, clientId: p.clientId, du: p.du, au: p.au, tri: p.tri };
}

/** GET /credits/kpis — the cards for a period (mois | annee | perso with du+au). */
export function useCreditsKpis(params: CreditsKpisParams) {
  // perso needs both bounds; asking without them is a guaranteed 400.
  const ready = params.period !== 'perso' || (!!params.du && !!params.au);
  return useQuery({
    queryKey: ['credits', 'kpis', params],
    enabled: ready,
    queryFn: async (): Promise<CreditsKpis> => {
      const res = await apiClient.get('/credits/kpis', {
        params: {
          period: params.period,
          ...(params.period === 'perso' ? { du: params.du, au: params.au } : {}),
        },
      });
      return creditsKpisSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/** GET /credits/filtres — tab counts, sorts, the Client filter list, methods. */
export function useCreditsFiltres(params: CreditsLedgerParams, limit = 100) {
  // The tab is ignored by /filtres — its counts are what fill the tabs.
  const filters: CreditsLedgerParams = { ...withoutPaging(params), type: undefined };
  return useQuery({
    queryKey: ['credits', 'filtres', filters, limit],
    queryFn: async (): Promise<CreditsFiltres> => {
      const qs = ledgerQuery(filters);
      const res = await apiClient.get(`/credits/filtres?${qs}${qs ? '&' : ''}limit=${limit}`);
      return creditsFiltresSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/** GET /credits/{movementId} — clicking a ledger row. */
export function useCreditMovement(movementId: string | null) {
  return useQuery({
    queryKey: ['credits', 'movement', movementId],
    enabled: !!movementId,
    queryFn: async (): Promise<CreditMovement> => {
      const res = await apiClient.get(`/credits/${encodeURIComponent(movementId ?? '')}`);
      return creditMovementSchema.parse(res.data);
    },
  });
}

/**
 * GET /credits/clients?q= — the recharge dialog's autocomplete. Never use the
 * filtres client list for this: a new client with no movement is not in it.
 * The caller debounces `q`.
 */
export function useCreditClients(q: string, enabled = true, limit = 10) {
  return useQuery({
    queryKey: ['credits', 'clients', q, limit],
    enabled,
    queryFn: async (): Promise<CreditClientsResponse> => {
      const res = await apiClient.get('/credits/clients', { params: { q, limit } });
      return creditClientsResponseSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/** GET /credits/clients/{id} — refresh the chosen client's balance. */
export function useCreditClient(clientId: string | null) {
  return useQuery({
    queryKey: ['credits', 'client', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<CreditClient> => {
      const res = await apiClient.get(`/credits/clients/${encodeURIComponent(clientId ?? '')}`);
      return creditClientSchema.parse(res.data);
    },
  });
}

/**
 * POST /credits/recharges — multipart, 201 with the created movement. Carries
 * the FILES, not just their names. No Idempotency-Key, so the caller disables
 * « Enregistrer » while this is pending.
 */
export function useSubmitRecharge() {
  return useMutation({
    mutationFn: async (v: RechargeSubmitInput): Promise<CreditMovement> => {
      const fd = new FormData();
      fd.append('clientId', v.clientId);
      fd.append('montant', String(v.montant));
      fd.append('methode', v.methode);
      if (v.reference?.trim()) fd.append('reference', v.reference.trim());
      fd.append('visibleClient', String(v.visibleClient));
      if (v.justif) fd.append('justif', v.justif);
      if (v.facture) fd.append('facture', v.facture);
      const res = await apiClient.post('/credits/recharges', fd, { timeout: 120_000 });
      return creditMovementSchema.parse(res.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: creditsQueryKey });
    },
  });
}

/**
 * POST /credits/recharges/{rechargeId}/pieces — fill a « Manquant » piece.
 * A part sent replaces that slot's file; a part omitted is left untouched.
 * Also repairs rows created by the old POST /recharges, whose pieces have no
 * content and download as 404.
 */
export function useRechargePieces() {
  return useMutation({
    mutationFn: async ({
      rechargeId,
      justif,
      facture,
    }: {
      rechargeId: string;
      justif?: File | null;
      facture?: File | null;
    }): Promise<CreditMovement> => {
      const fd = new FormData();
      if (justif) fd.append('justif', justif);
      if (facture) fd.append('facture', facture);
      const res = await apiClient.post(`/credits/recharges/${encodeURIComponent(rechargeId)}/pieces`, fd, {
        timeout: 120_000,
      });
      return creditMovementSchema.parse(res.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: creditsQueryKey });
    },
  });
}

/**
 * GET /credits/export — the CSV for the filters on screen (paging ignored,
 * 5 000 rows max; a capped file's name ends in -tronque-5000). UTF-8 with BOM,
 * `;`-separated, so Excel FR opens it directly.
 */
export function exportCreditsCsv(params: CreditsLedgerParams, fallbackMessage?: string): Promise<void> {
  const qs = ledgerQuery(withoutPaging(params));
  return downloadFromApi(`/credits/export${qs ? '?' + qs : ''}`, {
    fallbackName: 'credits.csv',
    fallbackMessage,
  });
}
