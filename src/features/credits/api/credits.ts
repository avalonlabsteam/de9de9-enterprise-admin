import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import { creditEntrySchema, type CreditEntry, type RechargeInput } from '../schemas/credit';

export const creditsQueryKey = ['credits'] as const;

/** Full credits ledger — recharges, débits facture, versements pro (newest first). */
export function useCredits() {
  return useQuery({
    queryKey: creditsQueryKey,
    queryFn: async (): Promise<CreditEntry[]> => {
      const res = await apiClient.get('/credits');
      return creditEntrySchema.array().parse(res.data);
    },
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
