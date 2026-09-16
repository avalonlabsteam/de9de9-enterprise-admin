import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import {
  factureConsoleResponseSchema,
  factureSchema,
  type Facture,
  type FactureConsoleParams,
  type FactureConsoleResponse,
  type FactureStatus,
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

/** Total for one statut (or all, when null) via a PageSize=1 console query. */
export function useFacturesConsoleCount(statut: FactureStatus | null) {
  return useQuery({
    queryKey: ['factures', 'console-count', statut],
    queryFn: async (): Promise<number> => {
      const res = await apiClient.get(
        `/factures/console?${consoleQuery({ statut: statut ?? undefined, page: 1, pageSize: 1 })}`,
      );
      return factureConsoleResponseSchema.parse(res.data).meta.total;
    },
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
