import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import { t } from '@/lib/i18n';
import { kycStateSchema } from '../schemas/prestataire';
import type { KycDocInput, KycState } from '../schemas/prestataire';

export function useKyc(key: string) {
  return useQuery({
    queryKey: ['kyc', key],
    enabled: !!key,
    queryFn: async (): Promise<KycState> => {
      const res = await apiClient.get(`/kyc/${encodeURIComponent(key)}`);
      return kycStateSchema.parse(res.data);
    },
  });
}

/** POST /kyc/:key/docs — logic.ts addKycDoc (+ journal entry, toast 'Document ajouté'). */
export function useAddKycDoc(key: string) {
  return useMutation({
    mutationFn: async (input: KycDocInput): Promise<KycState> => {
      const res = await apiClient.post(`/kyc/${encodeURIComponent(key)}/docs`, input);
      return kycStateSchema.parse(res.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kyc', key] });
      toast.success(t('docToastAjoute'));
    },
  });
}

/** DELETE /kyc/:key/docs/:docId — logic.ts removeKycDoc (+ journal entry, toast 'Document supprimé'). */
export function useRemoveKycDoc(key: string) {
  return useMutation({
    mutationFn: async (docId: string): Promise<KycState> => {
      const res = await apiClient.delete(`/kyc/${encodeURIComponent(key)}/docs/${encodeURIComponent(docId)}`);
      return kycStateSchema.parse(res.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kyc', key] });
      toast.success(t('docToastSupprime'));
    },
  });
}
