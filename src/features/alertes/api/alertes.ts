import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import {
  alerteCompteursSchema,
  alertePageSchema,
  alertesMarqueesSchema,
  type AlerteCategorie,
  type AlerteCompteurs,
  type AlertePage,
} from '../schemas/alertes';
import { alertesActions } from '../stores/alertesStore';

export const alertesKeys = {
  lists: ['alertes', 'list'] as const,
  list: (filter: AlertesFilter) => ['alertes', 'list', filter] as const,
};

export const ALERTES_PAGE_SIZE = 25;

export interface AlertesQuery {
  /** true = unread only; absent = both. */
  nonLues?: boolean;
  categorie?: AlerteCategorie | null;
  /** ISO — rows strictly after it (the catch-up cursor). */
  depuis?: string;
  page?: number;
  pageSize?: number;
}

/** GET /admin/alertes — newest first. */
export async function fetchAlertesPage(q: AlertesQuery): Promise<AlertePage> {
  const res = await apiClient.get('/admin/alertes', {
    params: {
      nonLues: q.nonLues ? true : undefined,
      categorie: q.categorie ?? undefined,
      depuis: q.depuis,
      page: q.page,
      pageSize: q.pageSize,
    },
  });
  return alertePageSchema.parse(res.data);
}

/** GET /admin/alertes/compteurs — the bell and the chips. */
export async function fetchCompteurs(): Promise<AlerteCompteurs> {
  const res = await apiClient.get('/admin/alertes/compteurs');
  return alerteCompteursSchema.parse(res.data);
}

/** POST /admin/alertes/{id}/lue — idempotent; answers the new numbers. */
export async function postAlerteLue(id: string): Promise<AlerteCompteurs> {
  const res = await apiClient.post(`/admin/alertes/${encodeURIComponent(id)}/lue`);
  return alerteCompteursSchema.parse(res.data);
}

// ===================== drawer feed =====================

/** The drawer's tab and chip. */
export interface AlertesFilter {
  nonLues: boolean;
  categorie: AlerteCategorie | null;
}

/**
 * The drawer's pages. Each page lands in the store (dedupe by id); the drawer
 * renders the store, so live rows and read states show without a refetch.
 * Only the paging cursor lives here.
 */
export function useAlertesFeed(filter: AlertesFilter, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: alertesKeys.list(filter),
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = await fetchAlertesPage({ ...filter, page: pageParam, pageSize: ALERTES_PAGE_SIZE });
      alertesActions.merge(page.data);
      return page.meta;
    },
    getNextPageParam: (meta) => (meta.has_more_pages ? meta.current_page + 1 : undefined),
    // Live rows reach the store on their own; a reopen only needs fresh pages
    // when the list may have moved under it.
    staleTime: 60_000,
  });
}

/** Reload the drawer's pages (other admins read rows; the rows are not pushed again). */
export function reloadAlertesFeed(): void {
  void queryClient.invalidateQueries({ queryKey: alertesKeys.lists });
}

/** POST /admin/alertes/lues — « Tout marquer comme lu », for one chip or all. */
export function useMarquerToutLu() {
  return useMutation({
    mutationFn: async (categorie: AlerteCategorie | null) => {
      const res = await apiClient.post('/admin/alertes/lues', categorie ? { categorie } : {});
      return alertesMarqueesSchema.parse(res.data);
    },
    onSuccess: (answer, categorie) => {
      alertesActions.markAllRead(categorie);
      alertesActions.setCompteurs(answer.compteurs);
    },
  });
}
