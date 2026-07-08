import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useT } from '@/lib/i18n';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePrestataire } from '../api/prestataires';
import { useSubmitReview } from '../api/reviews';
import { reviewInputSchema } from '../schemas/review';
import type { ReviewInput } from '../schemas/review';

export interface ReviewModalProps {
  presId: string;
  presName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Avis de9de9 — évaluer un prestataire (logic.ts openReviewPres/submitReview, ReviewAndNotes.tsx design). */
export function ReviewModal({ presId, presName, open, onOpenChange }: ReviewModalProps) {
  const t = useT();
  const { data: pres } = usePrestataire(open ? presId : '');
  const submitReview = useSubmitReview();

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<ReviewInput>({
    resolver: zodResolver(reviewInputSchema),
    defaultValues: { presId, presName, cmd: '', occ: '', service: '', note: 0, comment: '' },
  });
  const note = watch('note');
  const { errors, isSubmitting } = formState;

  // logic.ts openReviewPres — service defaults to the prestataire's first sub.
  useEffect(() => {
    if (!open) return;
    reset({ presId, presName, cmd: '', occ: '', service: pres?.subs[0] ?? '', note: 0, comment: '' });
    submitReview.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presId, presName, pres?.id]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await submitReview.mutateAsync(values);
      onOpenChange(false);
    } catch {
      /* mutation error shown inline below */
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-[26px] shadow-[0_30px_70px_rgba(20,30,45,.4)] ring-0 sm:max-w-[460px]"
      >
        <form onSubmit={onSubmit}>
          <div className="flex size-[54px] items-center justify-center rounded-[15px] bg-[#F4EFFB] text-[26px] dark:bg-[#7C57C7]/15">⭐</div>
          <DialogTitle className="mt-4 text-[19px] font-extrabold leading-normal text-de9-ink">
            {t('avisDe9')}
          </DialogTitle>
          <div className="mt-1 text-[13px] text-de9-slate">
            {presName} · <span className="text-de9-gray">{t('reviewAvisLibre')}</span>
          </div>

          <div className="mt-[18px] text-[12px] font-bold text-de9-slate">{t('noteLabelR')}</div>
          <div className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setValue('note', n, { shouldValidate: true })}
                className="cursor-pointer text-[34px] leading-none"
                style={{ color: n <= note ? '#F2A93B' : '#D7DEE4' }}
              >
                {n <= note ? '★' : '☆'}
              </button>
            ))}
          </div>
          <div className="min-h-[18px] text-[11.5px] font-semibold text-de9-red">
            {errors.note ? t('reviewToastSelectionnezNote') : ''}
          </div>

          <div className="mt-2 text-[12px] font-bold text-de9-slate">{t('serviceConcerne')}</div>
          <Input
            {...register('service')}
            className="mt-1.5 h-auto w-full rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-[11px] text-[13.5px] text-de9-ink shadow-none outline-none"
          />

          <div className="mt-4 text-[12px] font-bold text-de9-slate">{t('commentaireObl')}</div>
          <Textarea
            {...register('comment')}
            placeholder={t('phCommentaire')}
            className="mt-1.5 min-h-[84px] w-full resize-y rounded-xl border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-[13.5px] text-de9-ink shadow-none outline-none"
          />
          <div className="min-h-[18px] text-[11.5px] font-semibold text-de9-red">
            {errors.comment ? t('reviewToastCommentaireObligatoire') : ''}
          </div>

          {submitReview.isError && (
            <div className="rounded-[10px] bg-[#FDEBEC] px-3 py-2 text-[12px] font-semibold text-de9-red dark:bg-[#E7464E]/15">
              {submitReview.error instanceof Error ? submitReview.error.message : 'Erreur'}
            </div>
          )}

          <div className="mt-4 flex gap-[11px]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 cursor-pointer rounded-[13px] bg-secondary p-3.5 text-center text-[14px] font-bold text-de9-slate"
            >
              {t('annuler')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 cursor-pointer rounded-[13px] bg-[#7C57C7] p-3.5 text-center text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(124,87,199,.4)] disabled:opacity-60"
            >
              {t('enregistrerAvis')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
