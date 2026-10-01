import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import { pickArray, pickText } from '@/lib/pick';
import {
  candidatCompteursSchema,
  candidatDetailSchema,
  candidatListSchema,
  candidatSchema,
  demandeEtatSchema,
  handicapItemSchema,
  handicapListSchema,
  type Candidat,
  type CandidatCompteurs,
  type CandidatDetail,
  type CandidatInput,
  type CandidatParams,
  type DemandeEtat,
  type DemandeInput,
  type HandicapItem,
  type HandicapParams,
} from '../schemas/handicap';

const DEMANDES_PAGE_SIZE = 20;
const CANDIDATS_PAGE_SIZE = 25;
const enc = encodeURIComponent;

// Every key lives under ['handicap']: the alerts hub's `file: handicap`
// refreshes that prefix, so both tabs and an open dialog follow a colleague.
export const handicapKeys = {
  all: ['handicap'] as const,
  demandes: (p: HandicapParams) => ['handicap', 'list', p] as const,
  candidats: (p: CandidatParams) => ['handicap', 'candidats', 'list', p] as const,
  compteurs: ['handicap', 'candidats', 'compteurs'] as const,
  candidat: (id: string) => ['handicap', 'candidats', 'detail', id] as const,
  placements: (registrationId: string) => ['handicap', 'placements', registrationId] as const,
};

/**
 * A write moves more than its own row: placing people changes a demande's
 * `placedCount`, the people's « Situation » and the counters. Everything under
 * ['handicap'] is refreshed, except a demande's state the caller just stored.
 */
function refreshHandicap(freshEtatOf?: string): void {
  void queryClient.invalidateQueries({
    queryKey: handicapKeys.all,
    predicate: (q) => !(freshEtatOf && q.queryKey[1] === 'placements' && q.queryKey[2] === freshEtatOf),
  });
}

/** Refetch after a 404/409: what the screen shows is stale. */
export function reloadHandicap(): void {
  refreshHandicap();
}

/**
 * Job titles already loaded in either tab, as suggestions for the forms: a
 * person's « Poste recherché » only matches a demande's « Type de poste » (and
 * the filters) when both use the same words.
 */
export function knownJobTypes(): string[] {
  const seen = new Set<string>();
  for (const [, cached] of queryClient.getQueriesData({ queryKey: handicapKeys.all })) {
    for (const page of pickArray(cached, 'pages')) {
      for (const row of pickArray(page, 'data')) {
        const job = pickText(row, 'jobType');
        if (job) seen.add(job);
      }
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'fr'));
}

// ===================== demandes =====================

/**
 * GET /handicap — the demandes. Pages accumulate via `fetchNextPage` (the
 * « Charger plus » button); a filter change restarts at page 1.
 */
export function useHandicapList(params: HandicapParams) {
  return useInfiniteQuery({
    queryKey: handicapKeys.demandes(params),
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get('/handicap', {
        params: { ...params, pageSize: params.pageSize ?? DEMANDES_PAGE_SIZE, page: pageParam },
      });
      return handicapListSchema.parse(res.data);
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.has_more_pages ? last.meta.current_page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

/** POST /handicap (201) or PUT /handicap/{id} (full replacement) — both answer the row. */
export function useSaveDemande() {
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: DemandeInput }): Promise<HandicapItem> => {
      const res = id ? await apiClient.put(`/handicap/${enc(id)}`, input) : await apiClient.post('/handicap', input);
      return handicapItemSchema.parse(res.data);
    },
    onSuccess: () => refreshHandicap(),
  });
}

/** DELETE /handicap/{id} — 204. Its placements go with it: the people become available again. */
export function useDeleteDemande() {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(`/handicap/${enc(id)}`);
    },
    onSuccess: () => refreshHandicap(),
  });
}

/**
 * The « Contacté » box: POST /handicap/{id}/contacter `{ note? }` ticks it,
 * POST /handicap/{id}/reouvrir unticks it. Both answer the row.
 */
export function useSetContacted() {
  return useMutation({
    mutationFn: async ({ id, contacted, note }: { id: string; contacted: boolean; note?: string }): Promise<HandicapItem> => {
      const res = contacted
        ? await apiClient.post(`/handicap/${enc(id)}/contacter`, note ? { note } : {})
        : await apiClient.post(`/handicap/${enc(id)}/reouvrir`);
      return handicapItemSchema.parse(res.data);
    },
    onSuccess: () => refreshHandicap(),
  });
}

// ===================== candidats =====================

/** GET /handicap/candidats — newest person first; « Charger plus » like the demandes. */
export function useCandidats(params: CandidatParams, enabled = true) {
  return useInfiniteQuery({
    queryKey: handicapKeys.candidats(params),
    enabled,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get('/handicap/candidats', {
        params: { ...params, pageSize: params.pageSize ?? CANDIDATS_PAGE_SIZE, page: pageParam },
      });
      return candidatListSchema.parse(res.data);
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.has_more_pages ? last.meta.current_page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

/** GET /handicap/candidats/compteurs → { total, disponibles, places } */
export function useCandidatCompteurs() {
  return useQuery({
    queryKey: handicapKeys.compteurs,
    queryFn: async (): Promise<CandidatCompteurs> => {
      const res = await apiClient.get('/handicap/candidats/compteurs');
      return candidatCompteursSchema.parse(res.data);
    },
  });
}

/** GET /handicap/candidats/{id} — one person and every placement they had. */
export function useCandidatDetail(id: string | null) {
  return useQuery({
    queryKey: handicapKeys.candidat(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<CandidatDetail> => {
      const res = await apiClient.get(`/handicap/candidats/${enc(id ?? '')}`);
      return candidatDetailSchema.parse(res.data);
    },
  });
}

/** POST /handicap/candidats (201) or PUT /handicap/candidats/{id} — placements are untouched. */
export function useSaveCandidat() {
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: CandidatInput }): Promise<Candidat> => {
      const res = id
        ? await apiClient.put(`/handicap/candidats/${enc(id)}`, input)
        : await apiClient.post('/handicap/candidats', input);
      return candidatSchema.parse(res.data);
    },
    onSuccess: () => refreshHandicap(),
  });
}

/**
 * DELETE /handicap/candidats/{id} — 204, never refused: the person and all
 * their placements are erased, and the position they held reopens.
 */
export function useDeleteCandidat() {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(`/handicap/candidats/${enc(id)}`);
    },
    onSuccess: () => refreshHandicap(),
  });
}

// ===================== placements =====================

/** GET /handicap/{id}/placements — the state of one demande. */
export function useDemandeEtat(registrationId: string | null) {
  return useQuery({
    queryKey: handicapKeys.placements(registrationId ?? ''),
    enabled: !!registrationId,
    queryFn: async (): Promise<DemandeEtat> => {
      const res = await apiClient.get(`/handicap/${enc(registrationId ?? '')}/placements`);
      return demandeEtatSchema.parse(res.data);
    },
  });
}

/** Store the state a placement route answered, then refresh what it moved. */
function afterPlacement(etat: DemandeEtat): void {
  queryClient.setQueryData(handicapKeys.placements(etat.registrationId), etat);
  refreshHandicap(etat.registrationId);
}

/**
 * POST /handicap/{id}/placements `{ candidatIds, note }` — all or none. On
 * success the server also ticks « Contacté » and alerts the company.
 */
export function usePlacer() {
  return useMutation({
    mutationFn: async ({
      registrationId,
      candidatIds,
      note,
    }: {
      registrationId: string;
      candidatIds: string[];
      note?: string;
    }): Promise<DemandeEtat> => {
      const res = await apiClient.post(`/handicap/${enc(registrationId)}/placements`, {
        candidatIds,
        ...(note ? { note } : {}),
      });
      return demandeEtatSchema.parse(res.data);
    },
    onSuccess: afterPlacement,
  });
}

/**
 * POST /handicap/placements/{placementId}/terminer `{ motif? }` — the placement
 * stays as history, the person is available again, the company is told.
 */
export function useTerminerPlacement() {
  return useMutation({
    mutationFn: async ({ placementId, motif }: { placementId: string; motif?: string }): Promise<DemandeEtat> => {
      const res = await apiClient.post(`/handicap/placements/${enc(placementId)}/terminer`, motif ? { motif } : {});
      return demandeEtatSchema.parse(res.data);
    },
    onSuccess: afterPlacement,
  });
}

/** DELETE /handicap/placements/{placementId} — a mistake: erased, no history, nobody is told. */
export function useAnnulerPlacement() {
  return useMutation({
    mutationFn: async (placementId: string): Promise<DemandeEtat> => {
      const res = await apiClient.delete(`/handicap/placements/${enc(placementId)}`);
      return demandeEtatSchema.parse(res.data);
    },
    onSuccess: afterPlacement,
  });
}
