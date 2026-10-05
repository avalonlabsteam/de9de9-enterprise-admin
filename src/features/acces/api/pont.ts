import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import { pontEtatSchema, pontTestSchema, type PontEtat, type PontTest } from '../schemas/pont';
import { accesKeys } from './acces';

// Under ['acces']: « Actualiser » and the hub's `file: entreprises` refresh the
// card with the rest of the page. The page does not poll.
export const pontKey = ['acces', 'pont'] as const;

/** Opening runs the connection test server-side (15 s by default) before it answers. */
const TEST_TIMEOUT_MS = 45_000;

/** GET /admin/pont-de9de9 — the card. */
export function usePontDe9de9() {
  return useQuery({
    queryKey: pontKey,
    queryFn: async (): Promise<PontEtat> => {
      const res = await apiClient.get('/admin/pont-de9de9');
      return pontEtatSchema.parse(res.data);
    },
  });
}

export function reloadPont(): void {
  void queryClient.invalidateQueries({ queryKey: pontKey });
}

/**
 * The answer is the new state: it replaces the card. The list's pills
 * (« Accordé — pont désactivé ») and `pontActif` follow the switch at once.
 */
function pontChanged(state: PontEtat): void {
  queryClient.setQueryData(pontKey, state);
  void queryClient.invalidateQueries({ queryKey: accesKeys.compteurs });
  void queryClient.invalidateQueries({ queryKey: accesKeys.lists });
}

/**
 * POST /admin/pont-de9de9/ouvrir — the server tests the connection first and
 * refuses the opening (422 / 502, the bridge unchanged) unless it succeeds.
 * Already open and configured: 200, nothing written.
 */
export function useOuvrirPont() {
  return useMutation({
    mutationFn: async ({ motif }: { motif?: string }): Promise<PontEtat> => {
      const text = motif?.trim();
      const res = await apiClient.post('/admin/pont-de9de9/ouvrir', text ? { motif: text } : {}, {
        timeout: TEST_TIMEOUT_MS,
      });
      return pontEtatSchema.parse(res.data);
    },
    onSuccess: pontChanged,
  });
}

/** POST /admin/pont-de9de9/fermer — motif required (kept for de9de9, never sent to the companies). */
export function useFermerPont() {
  return useMutation({
    mutationFn: async ({ motif }: { motif: string }): Promise<PontEtat> => {
      const res = await apiClient.post('/admin/pont-de9de9/fermer', { motif: motif.trim() });
      return pontEtatSchema.parse(res.data);
    },
    onSuccess: pontChanged,
  });
}

/** POST /admin/pont-de9de9/tester — always 200; changes nothing, works while closed. */
export function useTesterPont() {
  return useMutation({
    mutationFn: async (): Promise<PontTest> => {
      const res = await apiClient.post('/admin/pont-de9de9/tester', undefined, { timeout: TEST_TIMEOUT_MS });
      return pontTestSchema.parse(res.data);
    },
  });
}
