import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import {
  ctrCompteursSchema,
  ctrDemandeDetailSchema,
  ctrDemandesPageSchema,
  ctrPlacementResultSchema,
  ctrProsPageSchema,
  prosFiltresSchema,
  type CtrCompteurs,
  type CtrDemandeDetail,
  type CtrDemandesPage,
  type CtrPlacementResult,
  type CtrProsPage,
  type ProsFiltres,
} from '../schemas/contractuels';

// Every key lives under ['contractuels']: the page « Sous-traitance », the
// screen of one demande (/contractuels/:id) and the hub's `file: contractuels`
// / `file: soustraitance` all read and refresh through that one prefix.
export const ctrKeys = {
  all: ['contractuels'] as const,
  demandes: ['contractuels', 'demandes'] as const,
  list: (f: CtrDemandesFilters) => ['contractuels', 'demandes', 'list', f] as const,
  compteurs: ['contractuels', 'demandes', 'compteurs'] as const,
  demande: (id: string) => ['contractuels', 'demande', id] as const,
  filtres: ['contractuels', 'filtres'] as const,
  pros: (f: CtrProsFilters) => ['contractuels', 'pros', f] as const,
};

const enc = encodeURIComponent;

/** Query string with the empty values — and the `false` flags — left out. */
function query(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export interface CtrDemandesFilters {
  /** a_traiter (submitted + in progress) · submitted · in_progress · fulfilled · closed · cancelled; absent = all. */
  status?: string;
  companyId?: string;
  page?: number;
  /** 20 by default, 100 at most. */
  pageSize?: number;
}

export interface CtrProsFilters {
  q?: string;
  categoryId?: number;
  serviceId?: number;
  wilayaId?: number;
  abandonMax?: number;
  servicesMin?: number;
  offresRecuesMin?: number;
  offresEnvoyeesMin?: number;
  kyc?: boolean;
  dispo?: boolean;
  inactifs?: boolean;
  /** services (default) · abandon · offres_recues · offres_envoyees · note · nom */
  tri?: string;
  /** Flags each row against that demande's company; filters nothing. */
  demandeId?: string;
  page?: number;
  pageSize?: number;
}

// ===================== reads =====================

/** GET /admin/contractuels/pros/filtres — the de9de9 app's categories, services and wilayas. */
export function useCtrFiltres() {
  return useQuery({
    queryKey: ctrKeys.filtres,
    queryFn: async (): Promise<ProsFiltres> => {
      const res = await apiClient.get('/admin/contractuels/pros/filtres');
      return prosFiltresSchema.parse(res.data);
    },
    staleTime: 60 * 60_000,
  });
}

/** GET /admin/contractuels/demandes — newest first. */
export function useCtrDemandes(f: CtrDemandesFilters, enabled = true) {
  return useQuery({
    queryKey: ctrKeys.list(f),
    enabled,
    queryFn: async (): Promise<CtrDemandesPage> => {
      const res = await apiClient.get(`/admin/contractuels/demandes${query({ ...f })}`);
      return ctrDemandesPageSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/** GET /admin/contractuels/demandes/compteurs */
export function useCtrCompteurs() {
  return useQuery({
    queryKey: ctrKeys.compteurs,
    queryFn: async (): Promise<CtrCompteurs> => {
      const res = await apiClient.get('/admin/contractuels/demandes/compteurs');
      return ctrCompteursSchema.parse(res.data);
    },
  });
}

/** GET /admin/contractuels/demandes/{id} — the demande and its placements. */
export function useCtrDemande(id: string | null) {
  return useQuery({
    queryKey: ctrKeys.demande(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<CtrDemandeDetail> => {
      const res = await apiClient.get(`/admin/contractuels/demandes/${enc(id ?? '')}`);
      return ctrDemandeDetailSchema.parse(res.data);
    },
  });
}

/** GET /admin/contractuels/pros — filtered and sorted on the server. */
export function useCtrPros(f: CtrProsFilters) {
  return useQuery({
    queryKey: ctrKeys.pros(f),
    queryFn: async (): Promise<CtrProsPage> => {
      const res = await apiClient.get(`/admin/contractuels/pros${query({ ...f })}`);
      return ctrProsPageSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

// ===================== actions =====================

/** Lists, counters, demandes and the pros' flags — plus the companies' équipes a placement changes. */
export function refreshCtr(): void {
  void queryClient.invalidateQueries({ queryKey: ctrKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['companies'] });
}

/** POST /admin/contractuels/demandes/{id}/take — status in_progress; the company is told de9de9 is searching. */
export function useTakeDemande() {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.post(`/admin/contractuels/demandes/${enc(id)}/take`);
    },
    onSuccess: refreshCtr,
  });
}

/** POST /admin/contractuels/demandes/{id}/close — the reason is optional. */
export function useCloseDemande() {
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }): Promise<void> => {
      const text = reason?.trim();
      await apiClient.post(`/admin/contractuels/demandes/${enc(id)}/close`, text ? { reason: text } : {});
    },
    onSuccess: refreshCtr,
  });
}

/** POST /admin/contractuels/placements/{placementId}/release — the reason is required. */
export function useReleasePlacement() {
  return useMutation({
    mutationFn: async ({ placementId, reason }: { placementId: string; reason: string }): Promise<void> => {
      await apiClient.post(`/admin/contractuels/placements/${enc(placementId)}/release`, { reason: reason.trim() });
    },
    onSuccess: refreshCtr,
  });
}

/**
 * POST /admin/contractuels/demandes/{id}/placements — « + Ajouter comme
 * salarié ». Only the id: the server reads the name and the phone in the
 * de9de9 app. The pro joins the company's équipe as a contractuel.
 */
export function usePlacerPro() {
  return useMutation({
    mutationFn: async ({ demandeId, legacyProUserId }: { demandeId: string; legacyProUserId: string }): Promise<CtrPlacementResult> => {
      const res = await apiClient.post(`/admin/contractuels/demandes/${enc(demandeId)}/placements`, { legacyProUserId });
      return ctrPlacementResultSchema.parse(res.data);
    },
    onSuccess: refreshCtr,
  });
}
