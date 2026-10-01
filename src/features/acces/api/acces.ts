import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import {
  accesCompteursSchema,
  accesListSchema,
  accesLotSchema,
  legacySyncSchema,
  type AccesCompteurs,
  type AccesList,
  type AccesLot,
  type LegacySync,
} from '../schemas/acces';
import type { AccesAction } from '../lib/acces';

// Every key lives under ['acces']: one prefix refreshes the list, the counters,
// the sidebar badge and any company's sync state on screen (the hub's
// `file: entreprises` does exactly that — see alertes/lib/actions.ts).
export const accesKeys = {
  all: ['acces'] as const,
  lists: ['acces', 'list'] as const,
  list: (f: AccesFilters) => ['acces', 'list', f] as const,
  compteurs: ['acces', 'compteurs'] as const,
  sync: (companyId: string) => ['acces', 'sync', companyId] as const,
};

const enc = encodeURIComponent;

export interface AccesFilters {
  /** « Contains », on the legal name, the trade name, the contact e-mail and the RC. */
  q?: string;
  /** accorde · non_accorde · actif · en_attente · suspendu · echec */
  b2c?: string;
  /** oui · non */
  b2b?: string;
  /** pending · verified · rejected */
  kyc?: string;
  /** client · prestataire */
  cote?: string;
  /** 1-based. */
  page?: number;
  /** 25 by default, 200 at most. */
  pageSize?: number;
}

function accesQuery(f: AccesFilters): string {
  const qs = new URLSearchParams();
  const set = (key: string, v: string | number | undefined): void => {
    if (v !== undefined && v !== '') qs.set(key, String(v));
  };
  set('q', f.q);
  set('b2c', f.b2c);
  set('b2b', f.b2b);
  set('kyc', f.kyc);
  set('cote', f.cote);
  set('page', f.page);
  set('pageSize', f.pageSize);
  return qs.toString();
}

// ===================== list, counters =====================

/** GET /admin/acces-entreprises — newest company first. The page never polls; « Actualiser » refetches. */
export function useAccesEntreprises(f: AccesFilters) {
  return useQuery({
    queryKey: accesKeys.list(f),
    queryFn: async (): Promise<AccesList> => {
      const qs = accesQuery(f);
      const res = await apiClient.get(`/admin/acces-entreprises${qs ? '?' + qs : ''}`);
      return accesListSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/** GET /admin/acces-entreprises/compteurs — over all companies: the list's filters never apply. */
export function useAccesCompteurs(opts: { badge?: boolean } = {}) {
  return useQuery({
    queryKey: accesKeys.compteurs,
    queryFn: async (): Promise<AccesCompteurs> => {
      const res = await apiClient.get('/admin/acces-entreprises/compteurs');
      return accesCompteursSchema.parse(res.data);
    },
    // The sidebar badge rides along on every screen: an error (an API older
    // than this page) must stay quiet and cheap.
    ...(opts.badge ? { retry: false, staleTime: 5 * 60_000 } : {}),
  });
}

/**
 * The sidebar badge: companies whose de9de9 sync is in « Échec ». No polling —
 * the hub's `file: entreprises` refreshes the ['acces'] prefix.
 */
export function useAccesEchecsBadge(): number {
  const { data } = useAccesCompteurs({ badge: true });
  return data?.b2cEchecs ?? 0;
}

/** What an action changed: the list, the counters and every sync state on screen. */
export function refreshAcces(): void {
  void queryClient.invalidateQueries({ queryKey: accesKeys.all });
}

// ===================== the four bulk actions =====================

const ROUTES: Record<AccesAction, string> = {
  b2c_accorder: '/admin/acces-entreprises/b2c/accorder',
  b2c_retirer: '/admin/acces-entreprises/b2c/retirer',
  b2b_activer: '/admin/acces-entreprises/b2b/activer',
  b2b_desactiver: '/admin/acces-entreprises/b2b/desactiver',
};

export interface AccesLotInput {
  action: AccesAction;
  /** 1 to 200; the row's switch and menu send one. */
  companyIds: string[];
  /** ≤ 1000 characters; blank = absent. Required by « retirer » and « désactiver ». */
  motif?: string;
}

/**
 * POST /admin/acces-entreprises/{b2c/accorder | b2c/retirer | b2b/activer |
 * b2b/desactiver} — one hook for the four routes, which share their body and
 * their answer. The answer is ALWAYS 200 with one result per company (`fait`
 * or `ignore`): never read it as « everything was done ». Only a malformed
 * body is a 400, and then nothing was changed.
 *
 * The server saves the companies one after the other and runs the lot to its
 * end even if the request is cut, hence the long timeout — and why a call
 * that got no answer must not be resent blindly.
 */
export function useAccesLot() {
  return useMutation({
    mutationFn: async ({ action, companyIds, motif }: AccesLotInput): Promise<AccesLot> => {
      const text = motif?.trim();
      const res = await apiClient.post(ROUTES[action], { companyIds, ...(text ? { motif: text } : {}) }, { timeout: 120_000 });
      return accesLotSchema.parse(res.data);
    },
    onSuccess: (_lot, { action }) => {
      refreshAcces();
      // The company pages show both flags; a B2B switch also changes who the
      // prestataire search returns.
      void queryClient.invalidateQueries({ queryKey: ['entreprises'] });
      if (action === 'b2b_activer' || action === 'b2b_desactiver') {
        void queryClient.invalidateQueries({ queryKey: ['prestataires', 'recherche'] });
      }
    },
  });
}

// ===================== one company's sync =====================

/** GET /admin/companies/{companyId}/legacy-sync — the fiche's « Sync » tab. */
export function useLegacySync(companyId: string) {
  return useQuery({
    queryKey: accesKeys.sync(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<LegacySync> => {
      const res = await apiClient.get(`/admin/companies/${enc(companyId)}/legacy-sync`);
      return legacySyncSchema.parse(res.data);
    },
  });
}

/** Reload the tab after a 404 or a 409 `concurrency_conflict`: what it shows is stale. */
export function reloadLegacySync(companyId: string): void {
  void queryClient.invalidateQueries({ queryKey: accesKeys.sync(companyId) });
}

/** The answer of the three routes below is the refreshed sync state: it replaces the tab's content. */
function syncChanged(companyId: string, state: LegacySync): void {
  queryClient.setQueryData(accesKeys.sync(companyId), state);
  void queryClient.invalidateQueries({ queryKey: accesKeys.lists });
  void queryClient.invalidateQueries({ queryKey: accesKeys.compteurs });
}

/**
 * POST /admin/companies/{companyId}/legacy-sync/retry — « Relancer la
 * synchronisation »: every waiting row becomes due now and the failed rows are
 * reopened. No body. 409 `b2c_access_required` when the company has no access
 * and nothing to relaunch.
 */
export function useRetryLegacySync() {
  return useMutation({
    mutationFn: async (companyId: string): Promise<LegacySync> => {
      const res = await apiClient.post(`/admin/companies/${enc(companyId)}/legacy-sync/retry`);
      return legacySyncSchema.parse(res.data);
    },
    onSuccess: (state, companyId) => syncChanged(companyId, state),
  });
}

export interface FicheB2cInput {
  companyId: string;
  /** true: « Accorder l'accès B2C ». false: « Retirer l'accès B2C », with its motif. */
  accorder: boolean;
  motif?: string;
}

/**
 * The fiche's one-company routes. Their names are historical: `b2c/resume`
 * GRANTS the access (no body) and `b2c/suspend` REVOKES it (`reason` required,
 * sent to the company). Both do what the bulk routes do for one company.
 */
export function useFicheB2c() {
  return useMutation({
    mutationFn: async ({ companyId, accorder, motif }: FicheB2cInput): Promise<LegacySync> => {
      const base = `/admin/companies/${enc(companyId)}/b2c`;
      const res = accorder
        ? await apiClient.post(`${base}/resume`)
        : await apiClient.post(`${base}/suspend`, { reason: motif?.trim() ?? '' });
      return legacySyncSchema.parse(res.data);
    },
    onSuccess: (state, { companyId }) => {
      syncChanged(companyId, state);
      void queryClient.invalidateQueries({ queryKey: ['entreprises', companyId] });
    },
  });
}
