// Brief — demande de devis détaillée (logic.ts requestQuotes/submitBrief,
// BriefModal.tsx design), sent through POST /appels-offres/demander-devis as
// multipart/form-data: the JSON `payload` plus every photo and document as a
// `files` part. The client comes from the search-context commande when there
// is one, else is picked among the worklist's clients.
import { useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useL, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDemanderDevis, type CtxCommande } from '../api/prestataires';
import { CADENCE, FREQUENCE, type DemandeDevisPayload } from '../schemas/demandeDevis';
import { SERVICE_CAT, TAXO, catObj, slugify } from '../lib/taxonomy';
import { selectionActions } from '../stores/selectionStore';

const nonBlank = (s: string): boolean => s.trim().length > 0;

const briefFormSchema = z.object({
  title: z.string().refine(nonBlank),
  categoryId: z.string().refine(nonBlank),
  // Disabled selects submit `undefined` (sub-category before a category is
  // picked, frequency while ponctuel) — optional so they don't block the form.
  sub: z.string().optional(),
  description: z.string(),
  message: z.string(),
  budgetMin: z.string(),
  budgetMax: z.string(),
  superficie: z.string(),
  adresse: z.string(),
  commune: z.string(),
  wilaya: z.string(),
  cadence: z.enum(['ponctuel', 'recurrent']),
  frequence: z.enum(['quotidienne', 'hebdomadaire', 'mensuelle']).optional(),
  dateSouhaitee: z.string(), // yyyy-mm-dd from the date input, '' when unset
  deadline: z.string(),
  contraintes: z.string(),
});
type BriefFormValues = z.infer<typeof briefFormSchema>;

/** The search page's active filters — defaults for category and location. */
export interface BriefFilters {
  cat: string;
  sub: string;
  wilaya: string;
  commune: string;
}

interface BriefModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Selected prestataires (the same brief goes to all of them); ids are company ids. */
  selected: { id: string; name: string }[];
  /** Search-context commande (`?ctx=`) — supplies the client and prefills the brief. */
  ctx: CtxCommande | null;
  filters: BriefFilters;
}

const labelCls = 'mb-1.5 text-[12px] font-bold text-de9-slate';
const hintCls = 'font-medium text-de9-gray';
const inputCls =
  'h-auto w-full rounded-xl border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-[14px] text-de9-ink shadow-none outline-none';
const textareaCls =
  'min-h-[84px] w-full resize-y rounded-xl border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-[13.5px] text-de9-ink shadow-none outline-none';
const invalidCls = 'border-de9-red';

/** « 2026-09-22 » from a date input → « 2026-09-22T00:00:00Z ». */
const isoDay = (day: string): string => `${day}T00:00:00Z`;

/** A number from a numeric input, or undefined when left empty. */
function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <div className={labelCls}>
        {label}
        {hint && <span className={hintCls}> · {hint}</span>}
      </div>
      {children}
      {error && <div className="mt-1 text-[11.5px] font-semibold text-de9-red">{error}</div>}
    </div>
  );
}

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
  onFiles: (files: File[]) => void;
}) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const fs = e.target.files;
    if (fs && fs.length) onFiles([...fs]);
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

/** Brief — demande de devis détaillée. */
export function BriefModal({ open, onOpenChange, selected, ctx, filters }: BriefModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open so each opening starts from fresh prefilled state. */}
      {open && <BriefModalContent onOpenChange={onOpenChange} selected={selected} ctx={ctx} filters={filters} />}
    </Dialog>
  );
}

function BriefModalContent({ onOpenChange, selected, ctx, filters }: Omit<BriefModalProps, 'open'>) {
  const t = useT();
  const l = useL();
  const navigate = useNavigate();
  // The appel d'offres in the path owns the client, so the brief can only be
  // sent from a commande context (the S2 « Demander les devis » link opens it).
  const demander = useDemanderDevis(ctx?.id ?? '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);

  const pick = (value: string): string => (value && value !== 'all' ? value : '');
  // Live context rows carry the taxonomy label as `service`, mock ones a service name.
  const ctxCategory = ctx?.service
    ? (TAXO.find((c) => c.fr === ctx.service)?.id ?? SERVICE_CAT[ctx.service])
    : undefined;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BriefFormValues>({
    resolver: zodResolver(briefFormSchema),
    defaultValues: {
      title: ctx?.service ?? '',
      categoryId: ctxCategory ? String(ctxCategory) : pick(filters.cat),
      sub: ctx ? '' : pick(filters.sub),
      description: '',
      message: '',
      budgetMin: '',
      budgetMax: '',
      superficie: '',
      adresse: '',
      commune: ctx?.commune ?? pick(filters.commune),
      wilaya: ctx?.wilaya ?? pick(filters.wilaya),
      cadence: /r[ée]current/i.test(ctx?.cadence ?? '') ? 'recurrent' : 'ponctuel',
      frequence: 'quotidienne',
      dateSouhaitee: '',
      deadline: '',
      contraintes: '',
    },
  });
  const category = catObj(useWatch({ control, name: 'categoryId' }));
  const cadence = useWatch({ control, name: 'cadence' });
  const required = t('briefChampRequis');

  const onSubmit = handleSubmit(async (v) => {
    if (!ctx) return;
    const subs = category?.subs ?? [];
    const superficie = numberOrUndefined(v.superficie);
    const budgetMin = numberOrUndefined(v.budgetMin);
    const budgetMax = numberOrUndefined(v.budgetMax);
    const payload: DemandeDevisPayload = {
      prestataireCompanyIds: selected.map((p) => p.id),
      message: v.message.trim(),
      ...(budgetMin !== undefined ? { budgetMinCredits: budgetMin } : {}),
      ...(budgetMax !== undefined ? { budgetMaxCredits: budgetMax } : {}),
      brief: {
        title: v.title.trim(),
        description: v.description.trim(),
        categoryCode: category ? slugify(category.fr) : v.categoryId,
        subCategoryCodes: v.sub && subs.includes(v.sub) ? [slugify(v.sub)] : [],
        wilaya: v.wilaya.trim(),
        commune: v.commune.trim(),
        adresseExacte: v.adresse.trim(),
        ...(superficie !== undefined ? { superficieM2: superficie } : {}),
        cadence: CADENCE[v.cadence],
        ...(v.cadence === 'recurrent' ? { frequence: FREQUENCE[v.frequence ?? 'quotidienne'] } : {}),
        ...(v.dateSouhaitee ? { dateSouhaitee: isoDay(v.dateSouhaitee) } : {}),
        ...(v.deadline ? { deadline: isoDay(v.deadline) } : {}),
        contraintes: v.contraintes.trim(),
      },
    };
    try {
      await demander.mutateAsync({ payload, files: [...photos, ...docs] });
    } catch (err) {
      toast.error(problemMessage(err));
      return;
    }
    // logic.ts submitBrief — toast, clear selection, close; with a context
    // commande the prototype returns to its console.
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
            {ctx ? (
              <Field label={t('fClient')}>
                <div className={cn(inputCls, 'bg-secondary font-semibold')}>
                  {ctx.clientName}
                  {ctx.reference ? <span className="ms-2 font-medium text-de9-gray">· {ctx.reference}</span> : null}
                </div>
              </Field>
            ) : (
              <div className="rounded-xl border-[1.5px] border-dashed border-de9-line px-3.5 py-3 text-[12.5px] font-semibold text-de9-gray">
                🔒 {t('briefSansCommande')}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('briefFTitre')} error={errors.title ? required : undefined}>
                <Input {...register('title')} className={cn(inputCls, errors.title && invalidCls)} />
              </Field>
              <Field label={t('briefFCategorie')} hint={t('depuisTaxo')} error={errors.categoryId ? required : undefined}>
                <select {...register('categoryId')} className={cn(inputCls, errors.categoryId && invalidCls)}>
                  <option value="">{t('briefChoisir')}</option>
                  {TAXO.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.icon} {l(c.fr, c.ar)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label={t('briefFSousCategorie')}>
              <select {...register('sub')} disabled={!category} className={cn(inputCls, 'disabled:opacity-60')}>
                <option value="">{t('briefToutesSousCategories')}</option>
                {(category?.subs ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('fDescription')}>
              <Textarea {...register('description')} placeholder={t('phDescription')} className={textareaCls} />
            </Field>

            <Field label={t('briefFMessage')}>
              <Textarea
                {...register('message')}
                placeholder={t('briefPhMessage')}
                className={`${textareaCls} min-h-[60px]`}
              />
            </Field>

            <Field label={t('fPhotos')} hint={t('fPhotosHint')}>
              <div className="flex flex-wrap gap-[9px]">
                {photos.map((file, i) => (
                  <FileChip
                    key={file.name + i}
                    icon="🖼️"
                    name={file.name}
                    onRemove={() => setPhotos((ps) => ps.filter((_, k) => k !== i))}
                  />
                ))}
                <AddFileChip
                  label={t('ajouterPhotos')}
                  accept="image/*"
                  onFiles={(files) => setPhotos((ps) => [...ps, ...files])}
                />
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t('fBudgetMin')}>
                <Input type="number" min={0} {...register('budgetMin')} placeholder="—" className={inputCls} />
              </Field>
              <Field label={t('fBudgetMax')}>
                <Input type="number" min={0} {...register('budgetMax')} placeholder="—" className={inputCls} />
              </Field>
              <Field label={t('fSuperficie')}>
                <Input type="number" min={0} {...register('superficie')} placeholder="m²" className={inputCls} />
              </Field>
            </div>

            <Field label={t('fLocalisation')}>
              <Input {...register('adresse')} placeholder={t('phAdresse')} className={`${inputCls} mb-2.5`} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input {...register('commune')} placeholder={t('phCommune')} className={inputCls} />
                <Input {...register('wilaya')} placeholder={t('phWilaya')} className={inputCls} />
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('briefFCadence')}>
                <select {...register('cadence')} className={inputCls}>
                  <option value="ponctuel">{t('commonPonctuel')}</option>
                  <option value="recurrent">{t('commonRecurrent')}</option>
                </select>
              </Field>
              <Field label={t('fFrequence')}>
                <select
                  {...register('frequence')}
                  disabled={cadence !== 'recurrent'}
                  className={cn(inputCls, 'disabled:opacity-60')}
                >
                  <option value="quotidienne">{t('briefFrequenceQuotidienne')}</option>
                  <option value="hebdomadaire">{t('briefFrequenceHebdomadaire')}</option>
                  <option value="mensuelle">{t('briefFrequenceMensuelle')}</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('briefFDateSouhaitee')}>
                <Input type="date" {...register('dateSouhaitee')} className={inputCls} />
              </Field>
              <Field label={t('briefFDeadline')}>
                <Input type="date" {...register('deadline')} className={inputCls} />
              </Field>
            </div>

            <Field label={t('fContraintes')}>
              <Textarea
                {...register('contraintes')}
                placeholder={t('phContraintes')}
                className={`${textareaCls} min-h-[60px]`}
              />
            </Field>

            <Field label={t('fDocs')} hint={t('optionnel')}>
              <div className="flex flex-wrap gap-[9px]">
                {docs.map((file, i) => (
                  <FileChip
                    key={file.name + i}
                    icon="📎"
                    name={file.name}
                    onRemove={() => setDocs((ds) => ds.filter((_, k) => k !== i))}
                  />
                ))}
                <AddFileChip label={t('joindreDoc')} onFiles={(files) => setDocs((ds) => [...ds, ...files])} />
              </div>
            </Field>
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
              disabled={!ctx || demander.isPending || selected.length === 0}
              className="cursor-pointer rounded-[13px] bg-de9-teal px-6 py-[13px] text-[13.5px] font-bold text-white shadow-[0_10px_22px_rgba(101,203,196,.45)] disabled:opacity-60"
            >
              {demander.isPending ? t('briefEnvoiEnCours') : `${t('envoyerBrief')} (${selected.length})`}
            </button>
          </div>
        </form>
      </DialogContent>
    </>
  );
}
