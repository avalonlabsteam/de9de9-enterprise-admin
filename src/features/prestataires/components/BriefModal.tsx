import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Prestataire } from '../schemas/prestataire';
import type { CtxCommande } from '../api/prestataires';
import { selectionActions } from '../stores/selectionStore';

// The prototype's brief form has no blocking validation — every field is free text.
const briefFormSchema = z.object({
  service: z.string(),
  description: z.string(),
  budgetMin: z.string(),
  budgetMax: z.string(),
  superficie: z.string(),
  adresse: z.string(),
  commune: z.string(),
  wilaya: z.string(),
  frequence: z.string(),
  dates: z.string(),
  contraintes: z.string(),
});
type BriefFormValues = z.infer<typeof briefFormSchema>;

interface BriefModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Selected prestataires (same brief goes to all of them). */
  selected: Prestataire[];
  /** Search-context commande (`?ctx=`) — prefills service/wilaya/fréquence. */
  ctx: CtxCommande | null;
}

const labelCls = 'mb-1.5 text-[12px] font-bold text-de9-slate';
const hintCls = 'font-medium text-de9-gray';
const inputCls =
  'h-auto w-full rounded-xl border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-[14px] text-de9-ink shadow-none outline-none';
const textareaCls =
  'min-h-[84px] w-full resize-y rounded-xl border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-[13.5px] text-de9-ink shadow-none outline-none';

function FileChip({ icon, name, onRemove }: { icon: string; name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-[7px] rounded-[10px] border-[1.5px] border-de9-line bg-card px-[11px] py-2">
      <span className="text-[15px]">{icon}</span>
      <span className="max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-de9-slate">
        {name}
      </span>
      <button type="button" onClick={onRemove} className="cursor-pointer text-[13px] text-[#C0C8D0]">
        ✕
      </button>
    </div>
  );
}

function AddFileChip({
  label,
  accept,
  onFiles,
}: {
  label: string;
  accept?: string;
  onFiles: (names: string[]) => void;
}) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const fs = e.target.files;
    if (fs && fs.length) onFiles([...fs].map((f) => f.name));
    e.target.value = '';
  };
  return (
    <label className="flex cursor-pointer items-center gap-[7px] rounded-[10px] border-[1.5px] border-dashed border-[#CBD3DB] bg-card px-[13px] py-2">
      <span className="text-[16px] text-de9-teal">＋</span>
      <span className="text-[12px] font-bold text-de9-slate">{label}</span>
      <input type="file" accept={accept} multiple onChange={handle} className="hidden" />
    </label>
  );
}

/** Brief — demande de devis détaillée (logic.ts requestQuotes/submitBrief, BriefModal.tsx design). */
export function BriefModal({ open, onOpenChange, selected, ctx }: BriefModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open so each opening starts from fresh prefilled state. */}
      {open && <BriefModalContent onOpenChange={onOpenChange} selected={selected} ctx={ctx} />}
    </Dialog>
  );
}

function BriefModalContent({ onOpenChange, selected, ctx }: Omit<BriefModalProps, 'open'>) {
  const t = useT();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);

  // Prefilled from the context commande (logic.ts requestQuotes); fresh on every open.
  const { register, handleSubmit, formState } = useForm<BriefFormValues>({
    resolver: zodResolver(briefFormSchema),
    defaultValues: {
      service: ctx?.service ?? '',
      description: '',
      budgetMin: '',
      budgetMax: '',
      superficie: '',
      adresse: '',
      commune: '',
      wilaya: ctx?.wilaya ?? '',
      frequence: ctx
        ? ctx.type === 'recurrent'
          ? t('briefFrequenceRecurrent') + ctx.pattern
          : t('commonPonctuel')
        : '',
      dates: '',
      contraintes: '',
    },
  });

  // logic.ts submitBrief — toast 'Brief envoyé à N prestataires', clear selection,
  // close; with a ctx commande the prototype returns to its console.
  const onSubmit = handleSubmit(() => {
    toast.success(t('briefToastEnvoye').replace('{n}', String(selected.length)));
    selectionActions.clear();
    onOpenChange(false);
    if (ctx) navigate('/commandes/' + ctx.id);
  });

  return (
    <>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100vh-48px)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-[22px] bg-background p-0 shadow-[0_30px_70px_rgba(20,30,45,.4)] ring-0 sm:max-w-[760px]"
      >
        {/* header */}
        <div className="flex flex-none items-center justify-between gap-3.5 border-b border-de9-line bg-card px-4 py-[22px] sm:px-[26px]">
          <div className="flex items-center gap-[13px]">
            <div className="flex size-[46px] flex-none items-center justify-center rounded-[13px] bg-[#232838] text-[22px] text-white">
              📋
            </div>
            <div>
              <DialogTitle className="text-[19px] font-extrabold leading-normal text-de9-ink">
                {t('briefFormTitle')}
              </DialogTitle>
              <div className="text-[12.5px] text-de9-gray">
                {t('briefFormSub')} <b className="text-de9-teal">{selected.length}</b> {t('prestatairesContactes')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-[38px] flex-none cursor-pointer items-center justify-center rounded-[11px] bg-secondary text-[18px] text-de9-slate"
          >
            ✕
          </button>
        </div>

        {/* même brief strip */}
        <div className="flex-none border-b border-[#D7EFEC] bg-[#ECFAF8] px-4 py-[13px] dark:border-[#2C9C94]/40 dark:bg-[#2C9C94]/15 sm:px-[26px]">
          <div className="text-[11px] font-extrabold uppercase tracking-[.04em] text-[#2C9C94] dark:text-[#65CBC4]">{t('memeBrief')}</div>
          <div className="mt-1 text-[13px] font-bold text-de9-ink">{selected.map((p) => p.name).join(', ')}</div>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* body */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-[22px] sm:px-[26px]">
            <div>
              <div className={labelCls}>
                {t('fService')} <span className={hintCls}>· {t('depuisTaxo')}</span>
              </div>
              <Input {...register('service')} className={inputCls} />
            </div>
            <div>
              <div className={labelCls}>{t('fDescription')}</div>
              <Textarea {...register('description')} placeholder={t('phDescription')} className={textareaCls} />
            </div>
            <div>
              <div className={labelCls}>
                {t('fPhotos')} <span className={hintCls}>· {t('fPhotosHint')}</span>
              </div>
              <div className="flex flex-wrap gap-[9px]">
                {photos.map((name, i) => (
                  <FileChip
                    key={name + i}
                    icon="🖼️"
                    name={name}
                    onRemove={() => setPhotos((ps) => ps.filter((_, k) => k !== i))}
                  />
                ))}
                <AddFileChip
                  label={t('ajouterPhotos')}
                  accept="image/*"
                  onFiles={(names) => setPhotos((ps) => [...ps, ...names])}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className={labelCls}>{t('fBudgetMin')}</div>
                <Input type="number" {...register('budgetMin')} placeholder="—" className={inputCls} />
              </div>
              <div>
                <div className={labelCls}>{t('fBudgetMax')}</div>
                <Input type="number" {...register('budgetMax')} placeholder="—" className={inputCls} />
              </div>
              <div>
                <div className={labelCls}>{t('fSuperficie')}</div>
                <Input type="number" {...register('superficie')} placeholder="m²" className={inputCls} />
              </div>
            </div>
            <div>
              <div className={labelCls}>{t('fLocalisation')}</div>
              <Input {...register('adresse')} placeholder={t('phAdresse')} className={`${inputCls} mb-2.5`} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input {...register('commune')} placeholder={t('phCommune')} className={inputCls} />
                <Input {...register('wilaya')} placeholder={t('phWilaya')} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className={labelCls}>{t('fFrequence')}</div>
                <Input {...register('frequence')} className={inputCls} />
              </div>
              <div>
                <div className={labelCls}>{t('fDates')}</div>
                <Input {...register('dates')} placeholder={t('phDates')} className={inputCls} />
              </div>
            </div>
            <div>
              <div className={labelCls}>{t('fContraintes')}</div>
              <Textarea
                {...register('contraintes')}
                placeholder={t('phContraintes')}
                className={`${textareaCls} min-h-[60px]`}
              />
            </div>
            <div>
              <div className={labelCls}>
                {t('fDocs')} <span className={hintCls}>· {t('optionnel')}</span>
              </div>
              <div className="flex flex-wrap gap-[9px]">
                {docs.map((name, i) => (
                  <FileChip
                    key={name + i}
                    icon="📎"
                    name={name}
                    onRemove={() => setDocs((ds) => ds.filter((_, k) => k !== i))}
                  />
                ))}
                <AddFileChip label={t('joindreDoc')} onFiles={(names) => setDocs((ds) => [...ds, ...names])} />
              </div>
            </div>
          </div>

          {/* footer */}
          <div className="flex flex-none flex-wrap items-center gap-3 border-t border-de9-line bg-card px-4 py-4 sm:px-[26px]">
            <div className="flex-[1_1_180px] text-[12px] text-de9-gray">{t('briefFooter')}</div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer rounded-[13px] bg-secondary px-5 py-[13px] text-[13.5px] font-bold text-de9-slate"
            >
              {t('annuler')}
            </button>
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="cursor-pointer rounded-[13px] bg-de9-teal px-6 py-[13px] text-[13.5px] font-bold text-white shadow-[0_10px_22px_rgba(101,203,196,.45)] disabled:opacity-60"
            >
              {t('envoyerBrief')} ({selected.length})
            </button>
          </div>
        </form>
      </DialogContent>
    </>
  );
}
