import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import { factureSchema, type Facture } from '../schemas/facture';

export const facturesQueryKey = ['factures'] as const;

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

/** de9de9 actions available from the factures board (prototype `act` kinds). */
export type FactureActionKind = 'approve' | 'contest' | 'resolve' | 'settle';

export interface FactureActionInput {
  cmdId: string;
  kind: FactureActionKind;
  occId: string;
}

/**
 * Posts a facture action to the owning commande
 * (`POST /commandes/:cmdId/actions`) and refreshes factures + commandes.
 */
export function useFactureAction() {
  return useMutation({
    mutationFn: async ({ cmdId, kind, occId }: FactureActionInput): Promise<void> => {
      await apiClient.post(`/commandes/${cmdId}/actions`, { kind, occId });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['factures'] }),
        queryClient.invalidateQueries({ queryKey: ['commandes'] }),
      ]);
    },
  });
}
