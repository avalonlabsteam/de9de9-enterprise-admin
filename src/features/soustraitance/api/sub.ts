import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import { prestataireSchema } from '@/features/prestataires/schemas/prestataire';
import {
  subDemandeSchema,
  subProSchema,
  type SalarieInput,
  type SubDemande,
  type SubPro,
} from '../schemas/sub';

const SUB_DEMANDES_KEY = ['sub', 'demandes'] as const;
const SUB_PROS_KEY = ['sub', 'pros'] as const;
const PRESTATAIRES_KEY = ['prestataires'] as const;

export function useSubDemandes() {
  return useQuery({
    queryKey: SUB_DEMANDES_KEY,
    queryFn: async (): Promise<SubDemande[]> => {
      const res = await apiClient.get('/sub/demandes');
      return subDemandeSchema.array().parse(res.data);
    },
  });
}

export function useSubPros() {
  return useQuery({
    queryKey: SUB_PROS_KEY,
    queryFn: async (): Promise<SubPro[]> => {
      const res = await apiClient.get('/sub/pros');
      return subProSchema.array().parse(res.data);
    },
  });
}

/**
 * Names of the registered prestataires — the salarié modal merges them with the
 * demandes' entreprises to build its "entreprise destinataire" options
 * (mirrors the prototype's entrepriseOpts derivation).
 * Shares the ['prestataires'] cache with the prestataires feature.
 */
export function usePrestataireNames() {
  return useQuery({
    queryKey: PRESTATAIRES_KEY,
    queryFn: async () => {
      const res = await apiClient.get('/prestataires');
      return prestataireSchema.array().parse(res.data);
    },
    select: (pres): string[] => pres.map((p) => p.name),
  });
}

const createSalarieResponseSchema = z.object({ ok: z.literal(true) });

export function useCreateSalarie() {
  return useMutation({
    mutationFn: async (input: SalarieInput) => {
      const res = await apiClient.post('/sub/salaries', input);
      return createSalarieResponseSchema.parse(res.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUB_DEMANDES_KEY });
      void queryClient.invalidateQueries({ queryKey: SUB_PROS_KEY });
    },
  });
}
