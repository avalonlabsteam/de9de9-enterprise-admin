import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { downloadFromApi, fetchBlob, previewFromApi, saveBlob } from '@/api/documents';
import { queryClient } from '@/lib/queryClient';
import { creditsQueryKey } from '@/features/credits/api/credits';
import { PERIOD_PRESETS } from '../lib/comptabilite';
import {
  paiementDetailSchema,
  paiementsResponseSchema,
  recuBanqueSchema,
  totauxSchema,
  type PaiementAction,
  type PaiementDetail,
  type PaiementsResponse,
  type Totaux,
} from '../schemas/paiement';

// Every key lives under ['comptabilite']: the hub's `file: credits` refreshes
// the whole page (and the sidebar badge) through that prefix.
export const comptaKeys = {
  all: ['comptabilite'] as const,
  lists: ['comptabilite', 'paiements'] as const,
  list: (f: ComptaFilters) => ['comptabilite', 'paiements', f] as const,
  totauxAll: ['comptabilite', 'totaux'] as const,
  totaux: (f: PeriodFilters) => ['comptabilite', 'totaux', f] as const,
  detail: (id: string) => ['comptabilite', 'paiement', id] as const,
};

/** The answers' `href` values are host paths (/api/v1/…); apiClient already prefixes /api. */
export const rel = (href: string): string => href.replace(/^\/api\/v1/, '');

/** `Du` / `Au` are Algiers calendar days (YYYY-MM-DD), both inclusive. */
export interface PeriodFilters {
  du?: string;
  au?: string;
  clientId?: string;
}

export interface ComptaFilters extends PeriodFilters {
  /** Comma-separated wire values (« En attente » = en_attente,initiation). */
  statut?: string;
  q?: string;
  /** date (default) · montant · entreprise */
  tri?: string;
  page?: number;
  pageSize?: number;
}

/** PascalCase query string, empty values skipped — the twin of the credits `ledgerQuery`. */
function comptaQuery(f: ComptaFilters): string {
  const qs = new URLSearchParams();
  const set = (key: string, v: string | number | undefined): void => {
    if (v !== undefined && v !== '') qs.set(key, String(v));
  };
  set('Du', f.du);
  set('Au', f.au);
  set('ClientId', f.clientId);
  set('Statut', f.statut);
  set('Q', f.q);
  set('Tri', f.tri);
  set('Page', f.page);
  set('PageSize', f.pageSize);
  return qs.toString();
}

/** The list's filters minus paging — what the export takes. */
function withoutPaging(f: ComptaFilters): ComptaFilters {
  return { du: f.du, au: f.au, clientId: f.clientId, statut: f.statut, q: f.q, tri: f.tri };
}

// ===================== list, cards, detail =====================

/** GET /comptabilite/paiements — the page never polls; « Actualiser » refetches. */
export function useComptaPaiements(f: ComptaFilters) {
  return useQuery({
    queryKey: comptaKeys.list(f),
    queryFn: async (): Promise<PaiementsResponse> => {
      const res = await apiClient.get(`/comptabilite/paiements?${comptaQuery(f)}`);
      return paiementsResponseSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/** GET /comptabilite/paiements/totaux — `Statut` and `Q` never apply to the cards. */
export function useComptaTotaux(f: PeriodFilters, opts: { badge?: boolean } = {}) {
  const period: PeriodFilters = { du: f.du, au: f.au, clientId: f.clientId };
  return useQuery({
    queryKey: comptaKeys.totaux(period),
    queryFn: async (): Promise<Totaux> => {
      const res = await apiClient.get(`/comptabilite/paiements/totaux?${comptaQuery(period)}`);
      return totauxSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
    // The sidebar badge rides along on every screen: an error (the feature not
    // set up yet) must stay quiet and cheap.
    ...(opts.badge ? { retry: false, staleTime: 5 * 60_000 } : {}),
  });
}

/**
 * The sidebar badge: payments « à vérifier » created this month (Algiers). No
 * polling — the hub's `file: credits` refreshes the ['comptabilite'] prefix.
 */
export function useComptaAVerifierBadge(): number {
  const { data } = useComptaTotaux(PERIOD_PRESETS.mois(), { badge: true });
  return data?.aVerifier.nombre ?? 0;
}

/** GET /comptabilite/paiements/{id} — the dialog. */
export function useComptaPaiement(id: string | null) {
  return useQuery({
    queryKey: comptaKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<PaiementDetail> => {
      const res = await apiClient.get(`/comptabilite/paiements/${encodeURIComponent(id ?? '')}`);
      return paiementDetailSchema.parse(res.data);
    },
  });
}

// ===================== actions =====================

export interface PaiementActionInput {
  id: string;
  action: PaiementAction;
  /** Required by the review actions (`motifRequis`), 1–512 characters. */
  motif?: string;
}

/**
 * The detail's `actions` — « Re-vérifier », « Créditer / Rejeter après revue ».
 * Each answers the refreshed detail, which replaces the dialog's content.
 */
export function usePaiementAction() {
  return useMutation({
    mutationFn: async ({ action, motif }: PaiementActionInput): Promise<PaiementDetail> => {
      const res = await apiClient.post(rel(action.href), action.motifRequis ? { motif: motif?.trim() ?? '' } : undefined);
      return paiementDetailSchema.parse(res.data);
    },
    onSuccess: (detail, { id }) => {
      queryClient.setQueryData(comptaKeys.detail(id), detail);
      void queryClient.invalidateQueries({ queryKey: comptaKeys.lists });
      void queryClient.invalidateQueries({ queryKey: comptaKeys.totauxAll });
      // Credited: a recharge entered the ledger.
      if (detail.statut === 'approuve') void queryClient.invalidateQueries({ queryKey: creditsQueryKey });
    },
  });
}

/** Reload the dialog after a 409 `concurrency_conflict`: what it shows is stale. */
export function reloadPaiement(id: string): void {
  void queryClient.invalidateQueries({ queryKey: comptaKeys.detail(id) });
}

// ===================== files =====================

/**
 * GET /comptabilite/paiements/export — the CSV for the filters on screen
 * (paging ignored, 5 000 rows max). Answers the saved name: a capped file's
 * ends with `-tronque-5000`.
 */
export async function exportPaiementsCsv(f: ComptaFilters, fallbackMessage: string): Promise<string> {
  const qs = comptaQuery(withoutPaging(f));
  const { blob, fileName } = await fetchBlob(`/comptabilite/paiements/export${qs ? '?' + qs : ''}`, {
    fallbackName: 'paiements-en-ligne.csv',
    fallbackMessage,
  });
  saveBlob(blob, fileName);
  return fileName;
}

/** GET /comptabilite/bilan — approved payments by PAYMENT day; `Du` and `Au` required. */
export function bilanUrl(f: PeriodFilters): string {
  const qs = new URLSearchParams({ Du: f.du ?? '', Au: f.au ?? '', ...(f.clientId ? { ClientId: f.clientId } : {}) });
  return `/comptabilite/bilan?${qs.toString()}`;
}

export const BILAN_FALLBACK_NAME = 'bilan-paiements-en-ligne.pdf';

export function downloadBilan(f: PeriodFilters, fallbackMessage: string): Promise<void> {
  return downloadFromApi(bilanUrl(f), { fallbackName: BILAN_FALLBACK_NAME, fallbackMessage });
}

/** GET …/{id}/recu-banque — GuiddiniPay's receipt link, fetched now and opened at once. */
export async function fetchRecuBanque(href: string): Promise<string> {
  const res = await apiClient.get(rel(href));
  return recuBanqueSchema.parse(res.data).url;
}

// ===================== PDF preview =====================

export interface ApiPreview {
  url: string | null;
  contentType: string;
  loading: boolean;
  /** The server's reason (`detail`) when the file could not be fetched. */
  error: string | null;
}

interface PreviewState {
  forUrl: string;
  url: string | null;
  contentType: string;
  error: string | null;
}

/**
 * Fetch a binary route with `inline=true` for an in-page preview (receipts,
 * the BILAN). The object URL holds the whole file: revoked when `apiUrl`
 * changes or the caller unmounts. Null fetches nothing.
 */
export function useApiPreview(apiUrl: string | null, fallbackName: string, fallbackMessage: string): ApiPreview {
  const [state, setState] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (!apiUrl) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    previewFromApi(apiUrl, { fallbackName, fallbackMessage })
      .then((res) => {
        if (cancelled) {
          URL.revokeObjectURL(res.url);
          return;
        }
        objectUrl = res.url;
        setState({ forUrl: apiUrl, url: res.url, contentType: res.contentType, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            forUrl: apiUrl,
            url: null,
            contentType: '',
            error: err instanceof Error ? err.message : fallbackMessage,
          });
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setState((s) => (s?.forUrl === apiUrl ? null : s));
    };
  }, [apiUrl, fallbackName, fallbackMessage]);

  const current = state && state.forUrl === apiUrl ? state : null;
  return {
    url: current?.url ?? null,
    contentType: current?.contentType ?? '',
    loading: !!apiUrl && !current,
    error: current?.error ?? null,
  };
}
