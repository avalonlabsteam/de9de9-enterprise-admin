import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import {
  creditEntrySchema,
  creditsLedgerResponseSchema,
  type CreditEntry,
  type CreditsLedgerParams,
  type CreditsLedgerResponse,
  type RechargeInput,
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

const createRechargeResponseSchema = z.object({ credit: creditEntrySchema });

/**
 * POST /recharges — creates the ledger row exactly like the prototype's
 * `confirmRecharge` (create mode) and refreshes the ['credits'] cache.
 */
export function useCreateRecharge() {
  return useMutation({
    mutationFn: async (input: RechargeInput): Promise<CreditEntry> => {
      const res = await apiClient.post('/recharges', input);
      return createRechargeResponseSchema.parse(res.data).credit;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: creditsQueryKey });
    },
  });
}
