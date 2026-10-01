// « Ajouter une demande » (POST /handicap — an employer who called de9de9) and
// its edit (PUT /handicap/{id}, a full replacement). No field describes a
// disability or a health condition, and none may be added.
import { useId, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { knownJobTypes, reloadHandicap, useSaveDemande } from '../api/handicap';
import type { DemandeInput, HandicapItem } from '../schemas/handicap';
import { INPUT_CLS, hcErrorMessage, hcProblem } from '../lib/handicap';
import { DialogActions, DialogFrame, FormField } from './shared';
import { LieuFields } from './LieuFields';

const nonBlank = (s: string): boolean => s.trim().length > 0;
const emailOrEmpty = (s: string): boolean => !s.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

const formSchema = z.object({
  companyName: z.string().refine(nonBlank),
  contactName: z.string().refine(nonBlank),
  contactPhone: z.string().refine(nonBlank),
  contactEmail: z.string().refine(emailOrEmpty),
  jobType: z.string().refine(nonBlank),
  // `valueAsNumber` hands NaN for an empty box, which fails here.
  positionsCount: z.number().int().min(1),
  wilaya: z.string(),
  commune: z.string(),
  comment: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

const orNull = (s: string): string | null => s.trim() || null;

export function DemandeFormDialog({ row, onClose }: { row: HandicapItem | null; onClose: () => void }) {
  const t = useT();
  const save = useSaveDemande();
  const jobListId = useId();
  const jobTypes = useMemo(() => knownJobTypes(), []);
  const placed = row?.placedCount ?? 0;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: row?.companyName ?? '',
      contactName: row?.contactName ?? '',
      contactPhone: row?.contactPhone ?? '',
      contactEmail: row?.contactEmail ?? '',
      jobType: row?.jobType ?? '',
      positionsCount: row?.positionsCount ?? 1,
      wilaya: row?.wilaya ?? '',
      commune: row?.commune ?? '',
      comment: row?.comment ?? '',
    },
  });
  const { register, handleSubmit, setError, formState } = form;

  const errorOf = (name: keyof FormValues): string | undefined => {
    const e = formState.errors[name];
    if (!e) return undefined;
    if (e.type === 'server' && e.message) return e.message;
    if (name === 'contactEmail') return t('hcEmailInvalide');
    if (name === 'positionsCount') return t('hcNombreMin');
    return t('hcChampRequis');
  };

  const onSubmit = (v: FormValues): void => {
    const input: DemandeInput = {
      companyName: v.companyName.trim(),
      contactName: v.contactName.trim(),
      contactPhone: v.contactPhone.trim(),
      contactEmail: orNull(v.contactEmail),
      jobType: v.jobType.trim(),
      positionsCount: v.positionsCount,
      wilaya: orNull(v.wilaya),
      commune: orNull(v.commune),
      comment: orNull(v.comment),
      // A full replacement: left out, the demande would lose its company.
      companyId: row?.companyId ?? null,
    };
    save.mutate(
      { id: row?.id ?? null, input },
      {
        onSuccess: () => {
          toast.success(t(row ? 'hcDemandeModifiee' : 'hcDemandeAjoutee'));
          onClose();
        },
        onError: (err) => {
          const p = hcProblem(err);
          const named = Object.entries(p.fieldErrors).filter(([field]) => field in v);
          if (p.status === 400 && named.length) {
            for (const [field, message] of named) setError(field as keyof FormValues, { type: 'server', message });
            return;
          }
          toast.error(hcErrorMessage(err, t));
          // Deleted by a colleague meanwhile: nothing left to edit.
          if (p.status === 404) {
            reloadHandicap();
            onClose();
          }
        },
      },
    );
  };

  return (
    <DialogFrame title={t(row ? 'hcModifierDemande' : 'hcAjouterDemande')} onClose={onClose} locked={save.isPending}>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <FormField
              label={t('hcColEntreprise')}
              required
              error={errorOf('companyName')}
              hint={row?.companyId ? t('hcEntrepriseLiee') : undefined}
            >
              <input
                {...register('companyName')}
                autoFocus={!row}
                aria-invalid={!!formState.errors.companyName}
                className={INPUT_CLS}
              />
            </FormField>
            <FormField label={t('hcColPoste')} required error={errorOf('jobType')}>
              <input
                {...register('jobType')}
                list={jobListId}
                aria-invalid={!!formState.errors.jobType}
                className={INPUT_CLS}
              />
              <datalist id={jobListId}>
                {jobTypes.map((job) => (
                  <option key={job} value={job} />
                ))}
              </datalist>
            </FormField>
            <FormField label={t('hcColContact')} required error={errorOf('contactName')}>
              <input {...register('contactName')} aria-invalid={!!formState.errors.contactName} className={INPUT_CLS} />
            </FormField>
            <FormField label={t('hcTelephone')} required error={errorOf('contactPhone')}>
              <input
                {...register('contactPhone')}
                type="tel"
                dir="ltr"
                aria-invalid={!!formState.errors.contactPhone}
                className={cn(INPUT_CLS, 'rtl:text-right')}
              />
            </FormField>
            <FormField label={t('hcEmail')} error={errorOf('contactEmail')}>
              <input
                {...register('contactEmail')}
                type="email"
                dir="ltr"
                aria-invalid={!!formState.errors.contactEmail}
                className={cn(INPUT_CLS, 'rtl:text-right')}
              />
            </FormField>
            <FormField
              label={t('hcNombrePostes')}
              required
              error={errorOf('positionsCount')}
              hint={placed > 0 ? t('hcDejaPlaces').replace('{n}', String(placed)) : undefined}
            >
              <input
                {...register('positionsCount', { valueAsNumber: true })}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                aria-invalid={!!formState.errors.positionsCount}
                className={INPUT_CLS}
              />
            </FormField>
            <LieuFields />
            <FormField label={t('hcColComment')} error={errorOf('comment')} className="sm:col-span-2">
              <textarea {...register('comment')} rows={3} dir="auto" className={cn(INPUT_CLS, 'resize-y')} />
            </FormField>
          </div>
          <DialogActions
            onCancel={onClose}
            submitLabel={t(row ? 'hcEnregistrer' : 'hcAjouter')}
            pending={save.isPending}
          />
        </form>
      </FormProvider>
    </DialogFrame>
  );
}
