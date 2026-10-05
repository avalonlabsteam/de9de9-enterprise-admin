// Brief — demande de devis détaillée (logic.ts requestQuotes/submitBrief,
// BriefModal.tsx design), sent through POST /appels-offres/demander-devis as
// multipart/form-data: the JSON `payload` plus every photo and document as a
// `files` part. The client comes from the search-context commande when there
// is one, else is picked among the worklist's clients.
import { useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { type LucideIcon, ClipboardList, ImageIcon, Lock, Paperclip, Plus, TriangleAlert, X } from 'lucide-react';
import { useL, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Glyph } from '@/components/common/Glyph';
import { useCommunes, useWilayas } from '@/features/geo/api/geo';
import { findByNom } from '@/features/geo/lib/geo';
import { b2bRefusalOf, useDemanderDevis, type CtxCommande } from '../api/prestataires';
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
  'h-auto w-full rounded-md border border-de9-line bg-card px-3.5 py-3 text-[14px] text-de9-ink shadow-none outline-none';
const textareaCls =
  'min-h-[84px] w-full resize-y rounded-xs border border-outline bg-card px-3.5 py-3 text-[13.5px] text-de9-ink shadow-none outline-none';
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

function FileChip({ icon, name, onRemove }: { icon: LucideIcon; name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-[7px] rounded-sm border border-de9-line bg-card px-[11px] py-2">
      <Glyph icon={icon} className="text-[15px]" />
      <span className="max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold text-de9-slate">
        {name}
      </span>
      <button type="button" onClick={onRemove} className="cursor-pointer text-[13px] text-de9-faint">
        <Glyph icon={X} />
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
    <label className="flex cursor-pointer items-center gap-[7px] rounded-sm border border-dashed border-[#CBD3DB] bg-card px-[13px] py-2">
      <span className="text-[16px] text-de9-teal"><Glyph icon={Plus} /></span>
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
  // Recipients a send refused (B2B access suspended): out of the selection, named here.
  const [retires, setRetires] = useState<string[]>([]);

  const pick = (value: string): string => (value && value !== 'all' ? value : '');
  // Live context rows carry the taxonomy label as `service`, mock ones a service name.
  const ctxCategory = ctx?.service
    ? (TAXO.find((c) => c.fr === ctx.service)?.id ?? SERVICE_CAT[ctx.service])
    : undefined;

  const {
    register,
    handleSubmit,
    control,
    setValue,
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

  // Wilaya and commune are picked in the geo dictionary — the brief carries
  // their French `nom`, as the rows and the search params do. The communes
  // cascade from the wilaya's code. A prefill the dictionary spells otherwise
  // (« alger », typed when both were free text) is read as its entry.
  const wilayaValue = useWatch({ control, name: 'wilaya' });
  const communeValue = useWatch({ control, name: 'commune' });
  const { data: wilayas } = useWilayas();
  const wilaya = findByNom(wilayas, wilayaValue);
  const { data: communes } = useCommunes(wilaya?.code ?? null);
  const commune = findByNom(communes, communeValue);

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
        wilaya: findByNom(wilayas, v.wilaya)?.nom ?? v.wilaya.trim(),
        commune: findByNom(communes, v.commune)?.nom ?? v.commune.trim(),
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
      const refusal = b2bRefusalOf(err);
      if (refusal?.kind === 'prestataires') {
        // All-or-nothing: nobody was contacted. The closed recipients leave the
        // selection and the brief stays open, ready to go to the others.
        const closed = refusal.fermes.map((id) => id.toLowerCase());
        const names = selected.filter((p) => closed.includes(p.id.toLowerCase())).map((p) => p.name);
        setRetires((prev) => [...new Set([...prev, ...names])]);
        selectionActions.closeB2b(refusal.fermes);
        toast.error(problemMessage(err, () => t('briefErrPrestatairesB2b')));
        return;
      }
      if (refusal?.kind === 'client') {
        // The client's own access is suspended: nothing was created, and only « Accès » can reopen it.
        const client = ctx.clientName;
        toast.error(problemMessage(err, () => t('briefErrClientB2b')), {
          duration: 12_000,
          action: { label: t('accesOuvrir'), onClick: () => navigate('/acces?q=' + encodeURIComponent(client)) },
        });
        return;
      }
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
        className="flex max-h-[calc(100vh-48px)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-xl bg-background p-0 shadow-e3 ring-0 sm:max-w-[760px]"
      >
        {/* header */}
        <div className="flex flex-none items-center justify-between gap-3.5 border-b border-de9-line bg-card px-4 py-[22px] sm:px-[26px]">
          <div className="flex items-center gap-[13px]">
            <div className="flex size-[46px] flex-none items-center justify-center rounded-md bg-primary-container text-[22px] text-on-primary-container">
              <Glyph icon={ClipboardList} />
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
            className="flex size-[38px] flex-none cursor-pointer items-center justify-center rounded-full bg-secondary text-[18px] text-de9-slate"
          >
            <Glyph icon={X} />
          </button>
        </div>

        {/* même brief strip */}
        <div className="flex-none border-b border-[#D7EFEC] bg-[#ECFAF8] px-4 py-[13px] dark:border-[#2C9C94]/40 dark:bg-[#2C9C94]/15 sm:px-[26px]">
          <div className="text-[11px] font-extrabold uppercase tracking-[.04em] text-[#2C9C94] dark:text-[#65CBC4]">{t('memeBrief')}</div>
          <div className="mt-1 text-[13px] font-bold text-de9-ink">{selected.map((p) => p.name).join(', ') || '—'}</div>
        </div>

        {retires.length > 0 && (
          <div
            role="status"
            className="flex-none border-b border-[#F0E2C0] bg-[#FBF4E4] px-4 py-[11px] text-[12.5px] font-semibold text-[#92702A] dark:border-[#B68A2E]/40 dark:bg-[#B68A2E]/15 dark:text-[#D9B36A] sm:px-[26px]"
          >
            <Glyph icon={TriangleAlert} /> {t('briefRetiresB2b')} <bdi className="font-extrabold">{retires.join(', ')}</bdi>
          </div>
        )}

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
              <div className="rounded-md border border-dashed border-de9-line px-3.5 py-3 text-[12.5px] font-semibold text-de9-gray">
                <Glyph icon={Lock} /> {t('briefSansCommande')}
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
                      {l(c.fr, c.ar)}
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
                    icon={ImageIcon}
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
              {/* Both selects are controlled: their options arrive after the form
                  (the communes on demand), and an uncontrolled <select> would fall
                  back to its first option meanwhile. A value the dictionary does
                  not list stays selectable, so sending does not silently drop it. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="wilaya"
                  render={({ field }) => (
                    <select
                      ref={field.ref}
                      name={field.name}
                      value={wilaya?.nom ?? field.value}
                      onBlur={field.onBlur}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        setValue('commune', '');
                      }}
                      aria-label={t('fWilaya')}
                      className={inputCls}
                    >
                      <option value="">{t('phWilaya')}</option>
                      {field.value && !wilaya && <option value={field.value}>{field.value}</option>}
                      {(wilayas ?? []).map((w) => (
                        <option key={w.code} value={w.nom}>
                          {l(w.nom, w.nomAr)}
                        </option>
                      ))}
                    </select>
                  )}
                />
                <Controller
                  control={control}
                  name="commune"
                  render={({ field }) => (
                    <select
                      ref={field.ref}
                      name={field.name}
                      value={commune?.nom ?? field.value}
                      onBlur={field.onBlur}
                      onChange={(e) => field.onChange(e.target.value)}
                      disabled={!wilayaValue}
                      aria-label={t('fCommune')}
                      className={cn(inputCls, 'disabled:opacity-60')}
                    >
                      <option value="">{t('phCommune')}</option>
                      {field.value && !commune && <option value={field.value}>{field.value}</option>}
                      {(communes ?? []).map((c) => (
                        <option key={c.code} value={c.nom}>
                          {l(c.nom, c.nomAr)}
                        </option>
                      ))}
                    </select>
                  )}
                />
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
                    icon={Paperclip}
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
              className="cursor-pointer rounded-full bg-secondary px-5 py-[13px] text-[13.5px] font-bold text-de9-slate"
            >
              {t('annuler')}
            </button>
            <button
              type="submit"
              disabled={!ctx || demander.isPending || selected.length === 0}
              className="cursor-pointer rounded-full bg-de9-teal px-6 py-[13px] text-[13.5px] font-bold text-white disabled:opacity-60"
            >
              {demander.isPending ? t('briefEnvoiEnCours') : `${t('envoyerBrief')} (${selected.length})`}
            </button>
          </div>
        </form>
      </DialogContent>
    </>
  );
}
