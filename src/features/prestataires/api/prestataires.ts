import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/api/apiClient';
import { prestataireSchema } from '../schemas/prestataire';
import type { Prestataire } from '../schemas/prestataire';

export function usePrestataires() {
  return useQuery({
    queryKey: ['prestataires'],
    queryFn: async (): Promise<Prestataire[]> => {
      const res = await apiClient.get('/prestataires');
      return prestataireSchema.array().parse(res.data);
    },
  });
}

export function usePrestataire(id: string) {
  return useQuery({
    queryKey: ['prestataires', id],
    enabled: !!id,
    queryFn: async (): Promise<Prestataire> => {
      const res = await apiClient.get(`/prestataires/${encodeURIComponent(id)}`);
      return prestataireSchema.parse(res.data);
    },
  });
}

// ---------------------------------------------------------------------------
// Search context commande (`?ctx=` banner). Local minimal schema on purpose:
// the commandes feature is built concurrently, so we do NOT import from it.
// `looseObject` keeps every extra field intact — the cache entry under
// ['commandes', id] stays a full Commande for other consumers.
// ---------------------------------------------------------------------------
const ctxCommandeSchema = z.looseObject({
  id: z.string(),
  client: z.string(),
  service: z.string(),
  wilaya: z.string(),
  type: z.enum(['recurrent', 'ponctuel']),
  pattern: z.string(),
});
export type CtxCommande = z.infer<typeof ctxCommandeSchema>;

export function useContextCommande(id: string | null) {
  return useQuery({
    queryKey: ['commandes', id],
    enabled: !!id,
    queryFn: async (): Promise<CtxCommande> => {
      const res = await apiClient.get(`/commandes/${encodeURIComponent(id ?? '')}`);
      return ctxCommandeSchema.parse(res.data);
    },
  });
}
