import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import {
  annonceDetailSchema,
  annoncesQueueSchema,
  referentielSchema,
  repriseSchema,
  type AnnonceAction,
  type AnnonceDetail,
  type AnnoncesQueue,
  type Referentiel,
  type Reprise,
} from '../schemas/annonces';
import { RECOMPUTES_CARD, actionPath } from '../lib/annonces';

// Every key lives under ['annonces']: the queue, its counters, the menu badge
// and every open annonce. A live alert whose code starts with `annonce.`
// refreshes that prefix (alertes/lib/actions.ts).
export const annoncesKeys = {
  all: ['annonces'] as const,
  queues: ['annonces', 'queue'] as const,
  queue: (f: AnnoncesFilters) => ['annonces', 'queue', f] as const,
  badge: ['annonces', 'badge'] as const,
  detail: (id: string) => ['annonces', 'detail', id] as const,
};

/** Like the KYC queue: other admins and the companies move annonces between tabs. */
const POLL_MS = 60_000;

export interface AnnoncesFilters {
  /** a_valider (the server's default) · publiees · modifiees · suspendues · b2c_publication · toutes */
  onglet?: string;
  /** b2b · b2c */
  type?: string;
  companyId?: string;
  /** A catalogue category code (B2B) or a de9de9 app category id (B2C). */
  categorie?: string;
  /** In the title, or the company's legal or trade name. */
  q?: string;
  page?: number;
  /** 20 by default, 100 at most. */
  pageSize?: number;
}

function query(f: AnnoncesFilters): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(f)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** GET /admin/annonces — the six counters ride on every answer, whatever its filters. */
export function useAnnoncesQueue(f: AnnoncesFilters) {
  return useQuery({
    queryKey: annoncesKeys.queue(f),
    queryFn: async (): Promise<AnnoncesQueue> => {
      const res = await apiClient.get(`/admin/annonces${query(f)}`);
      return annoncesQueueSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
  });
}

/**
 * The menu badge: what waits for an admin — « À valider » + « Modifiées ».
 * One row is enough to read the counters. Quiet on an API without the page.
 */
export function useAnnoncesBadge(): number {
  const { data } = useQuery({
    queryKey: annoncesKeys.badge,
    queryFn: async (): Promise<AnnoncesQueue> => {
      const res = await apiClient.get('/admin/annonces?pageSize=1');
      return annoncesQueueSchema.parse(res.data);
    },
    refetchInterval: POLL_MS,
    retry: false,
  });
  const count = (code: string): number => data?.onglets.find((o) => o.code === code)?.count ?? 0;
  return count('a_valider') + count('modifiees');
}

/** GET /admin/annonces/{annonceId} — one call paints the whole page. */
export function useAnnonceDetail(id: string) {
  return useQuery({
    queryKey: annoncesKeys.detail(id),
    enabled: !!id,
    queryFn: async (): Promise<AnnonceDetail> => {
      const res = await apiClient.get(`/admin/annonces/${encodeURIComponent(id)}`);
      return annonceDetailSchema.parse(res.data);
    },
  });
}

export function refreshAnnonces(): void {
  void queryClient.invalidateQueries({ queryKey: annoncesKeys.all });
}

export interface AnnonceActionInput {
  annonceId: string;
  action: Pick<AnnonceAction, 'code' | 'href'>;
  /** What the page shows: a stale one answers 409 instead of acting on unseen content. */
  version: number;
  /** « Refuser » and « Suspendre » only: 1 to 500 characters, read by the company. */
  motif?: string;
  /** b2b · b2c — a B2B decision recomputes the company's directory card. */
  type: string;
}

/**
 * POST /admin/annonces/{id}/approuver | refuser | suspendre | retablir |
 * marquer-revue — the answer is the refreshed page: it replaces the detail.
 */
export function useAnnonceAction() {
  return useMutation({
    mutationFn: async ({ annonceId, action, version, motif }: AnnonceActionInput): Promise<AnnonceDetail> => {
      const body = motif === undefined ? { version } : { motif: motif.trim(), version };
      const res = await apiClient.post(actionPath(annonceId, action), body);
      return annonceDetailSchema.parse(res.data);
    },
    onSuccess: (detail, { annonceId, action, type }) => {
      queryClient.setQueryData(annoncesKeys.detail(annonceId), detail);
      void queryClient.invalidateQueries({ queryKey: annoncesKeys.queues });
      void queryClient.invalidateQueries({ queryKey: annoncesKeys.badge });
      if (type === 'b2b' && RECOMPUTES_CARD.has(action.code)) {
        void queryClient.invalidateQueries({ queryKey: ['prestataires'] });
        void queryClient.invalidateQueries({ queryKey: ['entreprises'] });
      }
    },
  });
}

export function reloadAnnonce(id: string): void {
  void queryClient.invalidateQueries({ queryKey: annoncesKeys.detail(id) });
}

/**
 * POST /admin/annonces/reprendre-fiches — once after deployment: every card
 * still filled by hand becomes B2B annonces. `simuler` writes nothing. One
 * save per company in one request: its own long timeout.
 */
export function useReprendreFiches() {
  return useMutation({
    mutationFn: async ({ simuler, companyIds }: { simuler: boolean; companyIds?: string[] }): Promise<Reprise> => {
      const res = await apiClient.post(
        '/admin/annonces/reprendre-fiches',
        { simuler, ...(companyIds ? { companyIds } : {}) },
        { timeout: 120_000 },
      );
      return repriseSchema.parse(res.data);
    },
    onSuccess: (res) => {
      if (res.simulation) return;
      refreshAnnonces();
      void queryClient.invalidateQueries({ queryKey: ['prestataires'] });
    },
  });
}

/** POST /admin/annonces/b2c/referentiel/actualiser — reads the de9de9 app up to three times. */
export function useActualiserReferentiel() {
  return useMutation({
    mutationFn: async (): Promise<Referentiel> => {
      const res = await apiClient.post('/admin/annonces/b2c/referentiel/actualiser', undefined, { timeout: 45_000 });
      return referentielSchema.parse(res.data);
    },
  });
}
