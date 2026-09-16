import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import { queryClient } from '@/lib/queryClient';
import { t } from '@/lib/i18n';
import { reviewSchema } from '../schemas/review';
import type { Review, ReviewInput } from '../schemas/review';

export function useReviews(presId?: string) {
  return useQuery({
    queryKey: ['reviews', presId ?? 'all'],
    queryFn: async (): Promise<Review[]> => {
      const res = await apiClient.get('/reviews', { params: presId ? { presId } : undefined });
      return reviewSchema.array().parse(res.data);
    },
  });
}

/** POST /reviews — logic.ts submitReview: prepend + toast 'Avis de9de9 enregistré · <pres>'. */
export function useSubmitReview() {
  return useMutation({
    mutationFn: async (input: ReviewInput): Promise<Review> => {
      const res = await apiClient.post('/reviews', input);
      return reviewSchema.parse(res.data);
    },
    onSuccess: (_review, input) => {
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      // The profile overlay reads its avis from GET /prestataires/{companyId}.
      void queryClient.invalidateQueries({ queryKey: ['prestataires'] });
      if (input.cmd) void queryClient.invalidateQueries({ queryKey: ['commandes'] });
      toast.success(t('reviewToastEnregistre').replace('{n}', input.presName ?? input.presId));
    },
  });
}
