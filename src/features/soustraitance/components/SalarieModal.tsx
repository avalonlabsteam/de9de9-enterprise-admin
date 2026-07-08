import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { salarieInputSchema, type SalarieInput } from '../schemas/sub';
import { useCreateSalarie, usePrestataireNames, useSubDemandes } from '../api/sub';

interface SalarieModalProps {
  pro: { id: string; name: string };
  defaultEntreprise: string;
  onClose: () => void;
}

/** "Ajouter comme salarié" modal — RHF + Zod on salarieInputSchema. */
export function SalarieModal({ pro, defaultEntreprise, onClose }: SalarieModalProps) {
  const t = useT();
  const createSalarie = useCreateSalarie();
  const { data: presNames } = usePrestataireNames();
  const { data: demandes } = useSubDemandes();

  // Prototype: [...new Set([...prestataires names, ...demandes entreprises])].sort()
  const entrepriseOpts = useMemo(
    () =>
      [...new Set([...(presNames ?? []), ...(demandes ?? []).map((d) => d.entreprise)])].sort(),
    [presNames, demandes],
  );

  const form = useForm<SalarieInput>({
    resolver: zodResolver(salarieInputSchema),
    defaultValues: { proId: pro.id, proName: pro.name, entreprise: defaultEntreprise },
  });

  const onSubmit = async (input: SalarieInput) => {
    await createSalarie.mutateAsync(input);
    toast.success(
      t('salarieToastAjoute').replace('{n}', input.proName).replace('{m}', input.entreprise),
    );
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[85vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-7 text-de9-ink shadow-[0_30px_70px_rgba(20,30,45,.4)] sm:max-w-[440px]"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="flex size-[54px] items-center justify-center rounded-[15px] bg-[#E5F7F4] text-[26px] dark:bg-[#178A82]/20">
            🧑‍🔧
          </div>
          <DialogTitle className="mt-4 text-[19px] font-extrabold text-de9-ink">
            {t('stModalTitre')}
          </DialogTitle>
          <DialogDescription className="mt-[9px] text-[13px] leading-[1.55] font-normal text-de9-slate">
            {t('stModalInfo')}
          </DialogDescription>
          <div className="mt-4 rounded-xl bg-secondary px-3.5 py-3 text-[13px]">
            {t('stColNom')} : <b>{pro.name}</b>
          </div>
          <div className="mt-3.5">
            <div className="mb-1.5 text-xs font-semibold text-de9-slate">
              {t('stChoisirEntreprise')}
            </div>
            <Controller
              control={form.control}
              name="entreprise"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    aria-invalid={!!form.formState.errors.entreprise}
                    className="h-auto w-full rounded-xl border-[1.5px] border-de9-line bg-card p-3 text-sm text-de9-ink data-placeholder:text-de9-gray"
                  >
                    <SelectValue placeholder={`— ${t('stChoisirEntreprise')} —`} />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {entrepriseOpts.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="min-h-[18px] pt-1 text-[11.5px] font-semibold text-de9-red">
              {form.formState.errors.entreprise ? t('salarieToastChoisirEntreprise') : ''}
            </p>
          </div>
          <div className="mt-3 flex gap-[11px]">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-auto flex-1 rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate hover:bg-secondary/80"
            >
              {t('annuler')}
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-auto flex-[1.4] rounded-[13px] bg-de9-teal-dark p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(23,138,130,.38)] hover:bg-de9-teal-dark/90"
            >
              {t('stConfirmerSalarie')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
