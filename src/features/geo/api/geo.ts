// Geo dictionaries (wilayas / communes) — static reference data, cached for
// the whole session (staleTime: Infinity).
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { communeSchema, wilayaSchema, type Commune, type Wilaya } from '../schemas/geo';

export function useWilayas() {
  return useQuery({
    queryKey: ['geo', 'wilayas'],
    queryFn: async (): Promise<Wilaya[]> => {
      const res = await apiClient.get('/geo/wilayas');
      return wilayaSchema.array().parse(res.data);
    },
    staleTime: Infinity,
  });
}

/** Communes of one wilaya; pass `null` while no wilaya is selected. */
export function useCommunes(wilayaCode: number | null) {
  return useQuery({
    queryKey: ['geo', 'wilayas', wilayaCode, 'communes'],
    queryFn: async (): Promise<Commune[]> => {
      const res = await apiClient.get(`/geo/wilayas/${wilayaCode}/communes`);
      return communeSchema.array().parse(res.data);
    },
    enabled: wilayaCode != null,
    staleTime: Infinity,
  });
}
