// « Ajouter une personne » (POST /handicap/candidats) and its edit (PUT
// /handicap/candidats/{id}, a full replacement that leaves the placements
// alone). A list of named people is sensitive data even with no medical field:
// a person is added only with their agreement, and nothing here may describe a
// disability or a health condition.
import { useId, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { knownJobTypes, reloadHandicap, useSaveCandidat } from '../api/handicap';
import { CANDIDAT_MAX, HC_TEXT_MAX, type Candidat, type CandidatInput } from '../schemas/handicap';
import { INPUT_CLS, hcErrorMessage, hcProblem } from '../lib/handicap';
import { DialogActions, DialogFrame, FormField } from './shared';
import { LieuFields } from './LieuFields';

const nonBlank = (s: string): boolean => s.trim().length > 0;
const emailOrEmpty = (s: string): boolean => !s.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

const formSchema = z.object({
  fullName: z.string().refine(nonBlank),
  phone: z.string().refine(nonBlank),
  email: z.string().refine(emailOrEmpty),
  jobType: z.string().refine(nonBlank),
  wilaya: z.string(),
  commune: z.string(),
  competences: z.string(),
  note: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

const orNull = (s: string): string | null => s.trim() || null;

export function CandidatFormDialog({ candidat, onClose }: { candidat: Candidat | null; onClose: () => void }) {
  const t = useT();
  const save = useSaveCandidat();
  const jobListId = useId();
  const jobTypes = useMemo(() => knownJobTypes(), []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: candidat?.fullName ?? '',
      phone: candidat?.phone ?? '',
      email: candidat?.email ?? '',
      jobType: candidat?.jobType ?? '',
      wilaya: candidat?.wilaya ?? '',
      commune: candidat?.commune ?? '',
      competences: candidat?.competences ?? '',
      note: candidat?.note ?? '',
    },
  });
  const { register, handleSubmit, setError, formState } = form;

  const errorOf = (name: keyof FormValues): string | undefined => {
    const e = formState.errors[name];
    if (!e) return undefined;
    if (e.type === 'server' && e.message) return e.message;
    return name === 'email' ? t('hcEmailInvalide') : t('hcChampRequis');
  };

  const onSubmit = (v: FormValues): void => {
    const input: CandidatInput = {
      fullName: v.fullName.trim(),
      phone: v.phone.trim(),
      email: orNull(v.email),
      jobType: v.jobType.trim(),
      wilaya: orNull(v.wilaya),
      commune: orNull(v.commune),
      competences: orNull(v.competences),
      note: orNull(v.note),
    };
    save.mutate(
      { id: candidat?.id ?? null, input },
      {
        onSuccess: () => {
          toast.success(t(candidat ? 'hcPersonneModifiee' : 'hcPersonneAjoutee'));
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
    <DialogFrame
      title={t(candidat ? 'hcModifierPersonne' : 'hcAjouterPersonne')}
      lead={t('hcPersonneAccord')}
      onClose={onClose}
      locked={save.isPending}
    >
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <FormField label={t('hcNomComplet')} required error={errorOf('fullName')}>
              <input
                {...register('fullName')}
                maxLength={CANDIDAT_MAX.fullName}
                autoFocus={!candidat}
                aria-invalid={!!formState.errors.fullName}
                className={INPUT_CLS}
              />
            </FormField>
            <FormField label={t('hcPosteRecherche')} required error={errorOf('jobType')}>
              <input
                {...register('jobType')}
                maxLength={CANDIDAT_MAX.jobType}
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
            <FormField label={t('hcTelephone')} required error={errorOf('phone')}>
              <input
                {...register('phone')}
                type="tel"
                dir="ltr"
                maxLength={CANDIDAT_MAX.phone}
                aria-invalid={!!formState.errors.phone}
                className={cn(INPUT_CLS, 'rtl:text-right')}
              />
            </FormField>
            <FormField label={t('hcEmail')} error={errorOf('email')}>
              <input
                {...register('email')}
                type="email"
                dir="ltr"
                maxLength={CANDIDAT_MAX.email}
                aria-invalid={!!formState.errors.email}
                className={cn(INPUT_CLS, 'rtl:text-right')}
              />
            </FormField>
            <LieuFields />
            <FormField label={t('hcCompetences')} error={errorOf('competences')} className="sm:col-span-2">
              <textarea
                {...register('competences')}
                rows={2}
                dir="auto"
                maxLength={HC_TEXT_MAX}
                placeholder={t('hcCompetencesPh')}
                className={cn(INPUT_CLS, 'resize-y')}
              />
            </FormField>
            <FormField label={t('hcNoteInterne')} error={errorOf('note')} className="sm:col-span-2">
              <textarea
                {...register('note')}
                rows={2}
                dir="auto"
                maxLength={HC_TEXT_MAX}
                className={cn(INPUT_CLS, 'resize-y')}
              />
            </FormField>
          </div>
          <DialogActions
            onCancel={onClose}
            submitLabel={t(candidat ? 'hcEnregistrer' : 'hcAjouter')}
            pending={save.isPending}
          />
        </form>
      </FormProvider>
    </DialogFrame>
  );
}
