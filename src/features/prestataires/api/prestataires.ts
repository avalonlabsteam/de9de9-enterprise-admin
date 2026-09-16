import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import type { DemandeDevisPayload } from '../schemas/demandeDevis';
import { prestataireSchema } from '../schemas/prestataire';
import type { Prestataire } from '../schemas/prestataire';
import {
  rechercheResponseSchema,
  type RechercheParams,
  type RechercheResponse,
} from '../schemas/recherche';
import {
  prestataireFicheResponseSchema,
  type PrestataireFicheResponse,
} from '../schemas/fiche';

/**
 * The recherche endpoint binds PascalCase params and repeats array keys
 * (`Categories=a&Categories=b`), which axios' default serializer would mangle
 * into `Categories[]=…` — so the query string is built by hand.
 */
function rechercheQuery(p: RechercheParams): string {
  const qs = new URLSearchParams();
  const set = (key: string, v: string | number | boolean | undefined): void => {
    if (v !== undefined && v !== '') qs.set(key, String(v));
  };
  set('Q', p.q);
  p.categories?.forEach((c) => qs.append('Categories', c));
  p.sousCategories?.forEach((c) => qs.append('SousCategories', c));
  p.familles?.forEach((f) => qs.append('Familles', f));
  set('Wilaya', p.wilaya);
  set('Commune', p.commune);
  set('NoteMin', p.noteMin);
  set('EffectifMin', p.effectifMin);
  set('EffectifMax', p.effectifMax);
  set('TarifMinDzd', p.tarifMinDzd);
  set('TarifMaxDzd', p.tarifMaxDzd);
  set('DelaiMaxHeures', p.delaiMaxHeures);
  set('DispoNow', p.dispoNow);
  set('KycOnly', p.kycOnly);
  set('CertifieOnly', p.certifieOnly);
  set('Liste', p.liste);
  set('Tri', p.tri);
  set('Page', p.page);
  set('PageSize', p.pageSize);
  return qs.toString();
}

/**
 * GET /prestataires/recherche — server-side prestataire search, filtered and
 * paginated. `keepPreviousData` keeps the current cards on screen while a
 * page/filter change refetches.
 */
export function useRecherchePrestataires(params: RechercheParams) {
  return useQuery({
    queryKey: ['prestataires', 'recherche', params],
    queryFn: async (): Promise<RechercheResponse> => {
      const res = await apiClient.get(`/prestataires/recherche?${rechercheQuery(params)}`);
      return rechercheResponseSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * GET /prestataires/{companyId} — the whole profile overlay in one payload:
 * the public `fiche`, the `avis` roll-up + first page, and the back-office
 * `dossier` (identity, vitrine, KYC, contrat, commandes, factures, versements,
 * documents, avis, équipe, stats).
 *
 * The path segment is a COMPANY id — `PrestataireSearchItem.companyId`, not its
 * `id`. The mock twin also answers to a mock prestataire id or a name, so the
 * profile still opens offline from the console's « voir le prestataire » links.
 */
export function usePrestataireFiche(companyId: string) {
  return useQuery({
    queryKey: ['prestataires', companyId, 'fiche'],
    enabled: !!companyId,
    queryFn: async (): Promise<PrestataireFicheResponse> => {
      const res = await apiClient.get(`/prestataires/${encodeURIComponent(companyId)}`);
      return prestataireFicheResponseSchema.parse(res.data);
    },
  });
}

export function usePrestataires() {
  return useQuery({
    queryKey: ['prestataires'],
    queryFn: async (): Promise<Prestataire[]> => {
      const res = await apiClient.get('/prestataires');
      return prestataireSchema.array().parse(res.data);
    },
  });
}

// ---------------------------------------------------------------------------
// Search context commande (`?ctx=`): read from the worklist detail, which takes
// the commande id for live rows and mock ones alike and carries the client
// company id the brief needs. Local minimal schema on purpose: the commandes
// feature is built concurrently, so we do NOT import from it. Own cache key —
// ['commandes', 'worklist-detail', id] holds the full, aliased detail.
// ---------------------------------------------------------------------------
const ctxCommandeSchema = z.looseObject({
  id: z.string(),
  reference: z.string().nullish(),
  clientName: z.string(),
  clientCompanyId: z.string().nullish(),
  /** The category label on live rows ('Nettoyage & Hygiène'), a service name on mock ones. */
  service: z.string().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  cadence: z.string().nullish(), // 'Ponctuel' | 'Récurrent'
});
export type CtxCommande = z.infer<typeof ctxCommandeSchema>;

export function useContextCommande(id: string | null) {
  return useQuery({
    queryKey: ['commandes', 'ctx', id],
    enabled: !!id,
    queryFn: async (): Promise<CtxCommande> => {
      const res = await apiClient.get(`/commandes/worklist/${encodeURIComponent(id ?? '')}`);
      return ctxCommandeSchema.parse(res.data);
    },
  });
}

/**
 * POST /appels-offres/:rfqId/demander-devis — send the brief of an existing
 * appel d'offres to the selected prestataires (S2 → S3). multipart/form-data:
 * `payload` is the JSON body as a string and every photo and document is its
 * own `files` part; axios adds the multipart boundary itself (no Content-Type
 * is forced). Uploads get a longer timeout than the client default. The
 * response isn't read — everything under ['commandes'] refetches.
 */
export function useDemanderDevis(rfqId: string) {
  return useMutation({
    mutationFn: async ({ payload, files }: { payload: DemandeDevisPayload; files: File[] }): Promise<void> => {
      const form = new FormData();
      form.append('payload', JSON.stringify(payload));
      files.forEach((file) => form.append('files', file));
      await apiClient.post(`/appels-offres/${encodeURIComponent(rfqId)}/demander-devis`, form, { timeout: 120_000 });
    },
    onSuccess: () => {
      // The console is unmounted while the brief is filled, so its detail query is
      // INACTIVE: the default refetchType ('active') only marks it stale, and the
      // console would paint the old S2 payload before a background refetch swapped
      // it to S3. Force that one query, and leave the rest of ['commandes'] to
      // refetch when next used — 'all' across the prefix would fire every cached
      // worklist page, KPI and row detail at once.
      void queryClient.invalidateQueries({ queryKey: ['commandes'] });
      void queryClient.invalidateQueries({
        queryKey: ['commandes', 'worklist-detail', rfqId],
        refetchType: 'all',
      });
    },
  });
}
